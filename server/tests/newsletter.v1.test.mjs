import { afterAll, beforeAll, describe, expect, it } from "vitest"
import request from "supertest"
import { randomUUID } from "node:crypto"
import {
  app,
  cleanAuthUsers,
  cleanDatabase,
  getTestDb,
  adminToken,
  bearer,
} from "./helpers.mjs"

/**
 * Phase 10 — newsletter + admin email campaigns.
 *
 * Covers the public subscribe/unsubscribe surface (dedupe, validation, rate
 * limiting, hash-verified token unsubscribe), the admin subscriber/campaign
 * reads, the campaign composer (DRAFT → test-send → broadcast with
 * per-recipient privacy), and the delivery ledger — including the guarantee
 * that a dead email transport never blocks a subscription or a campaign.
 *
 * The email transport stays on its default `log` writer for tests; a failure
 * path test injects a throwing transport via setTransportOverride.
 */

const NEWSLETTER = "/api/v1/newsletter"
const ADMIN = "/api/v1/admin/newsletter"
const AUTH = "/api/v1/auth"

const uniqueEmail = (name) =>
  `newsletter-test-${name}-${randomUUID().slice(0, 8)}@estate.test`

let admin

async function registerMember(email) {
  const res = await request(app)
    .post(`${AUTH}/register`)
    .send({ name: "Newsletter Member", email, password: "MemberPass-123" })
  expect(res.status).toBe(201)
  return res.body.data.accessToken
}

async function cleanupNewsletterRows() {
  const db = getTestDb()
  if (!db) return
  const { newsletterSubscribers, emailCampaigns, emailDeliveries } =
    await import("../src/db/schema/index.js")
  const { ilike, like } = await import("drizzle-orm")
  await db
    .delete(newsletterSubscribers)
    .where(ilike(newsletterSubscribers.email, "newsletter-test-%"))
  await db
    .delete(emailDeliveries)
    .where(ilike(emailDeliveries.recipientEmail, "newsletter-test-%"))
  await db
    .delete(emailCampaigns)
    .where(like(emailCampaigns.name, "Newsletter Test %"))
}

beforeAll(async () => {
  admin = await adminToken()
  await cleanupNewsletterRows()
  // Keep the shared IP bucket from overflowing across this file: the default
  // subscribe limiter (5/min) would otherwise throttle later assertions.
  app.locals.rateLimitOptions = { windowMs: 60_000, max: 1000 }
})

afterAll(async () => {
  delete app.locals.rateLimitOptions
  await cleanupNewsletterRows()
  await cleanDatabase("newsletter-test-")
  await cleanAuthUsers("newsletter-test-")
})

// ── Public subscription ────────────────────────────────────────────────

describe("POST /api/v1/newsletter/subscribe (public)", () => {
  it("registers a new subscriber with a welcome delivery", async () => {
    const email = uniqueEmail("fresh")
    const res = await request(app)
      .post(`${NEWSLETTER}/subscribe`)
      .send({ email })
    expect(res.status).toBe(201)
    expect(res.body.data.email).toBe(email.toLowerCase())
    expect(res.body.data.status).toBe("ACTIVE")
    expect(res.body.data.id).toBeTypeOf("string")
    // Token material must never leave the API.
    expect(res.body.data.unsubscribeTokenHash).toBeUndefined()
    expect(res.body.data.rawToken).toBeUndefined()

    const db = getTestDb()
    const { emailDeliveries } = await import("../src/db/schema/index.js")
    const { eq } = await import("drizzle-orm")
    const welcome = await db
      .select()
      .from(emailDeliveries)
      .where(eq(emailDeliveries.recipientEmail, email.toLowerCase()))
    expect(welcome.length).toBe(1)
    expect(welcome[0].kind).toBe("WELCOME")
    expect(welcome[0].status).toBe("SENT")
  })

  it("resubscribing an active address is a 200 with the same row, no duplicate welcome", async () => {
    const email = uniqueEmail("dedupe")
    const first = await request(app)
      .post(`${NEWSLETTER}/subscribe`)
      .send({ email })
    expect(first.status).toBe(201)
    const second = await request(app)
      .post(`${NEWSLETTER}/subscribe`)
      .send({ email })
    expect(second.status).toBe(200)
    expect(second.body.data.id).toBe(first.body.data.id)

    const db = getTestDb()
    const { emailDeliveries } = await import("../src/db/schema/index.js")
    const { eq } = await import("drizzle-orm")
    const welcome = await db
      .select()
      .from(emailDeliveries)
      .where(eq(emailDeliveries.recipientEmail, email.toLowerCase()))
    expect(welcome.filter((w) => w.kind === "WELCOME").length).toBe(1)
  })

  it("normalizes email casing and validates input", async () => {
    const email = "Newsletter-Test-Validation-2@estate.test"
    const res = await request(app)
      .post(`${NEWSLETTER}/subscribe`)
      .send({ email })
    expect(res.status).toBe(201)
    expect(res.body.data.email).toBe(email.toLowerCase())

    const bad = await request(app)
      .post(`${NEWSLETTER}/subscribe`)
      .send({ email: "not-an-email" })
    expect(bad.status).toBe(422)
    expect(bad.body.error.code).toBe("VALIDATION_ERROR")

    const noBody = await request(app).post(`${NEWSLETTER}/subscribe`).send({})
    expect(noBody.status).toBe(422)
  })

  it("rate-limits subscription spam", async () => {
    const previous = app.locals.rateLimitOptions
    app.locals.rateLimitOptions = { windowMs: 60_000, max: 2 }
    try {
      // Prior subscribes in this file already filled the per-IP bucket, so a
      // fresh subscribe under a max of 2 is deterministically over the limit.
      const blocked = await request(app)
        .post(`${NEWSLETTER}/subscribe`)
        .send({ email: uniqueEmail("rl-blocked") })
      expect(blocked.status).toBe(429)
      expect(blocked.body.error.code).toBe("RATE_LIMITED")
    } finally {
      app.locals.rateLimitOptions = previous
    }
  })
})

// ── Unsubscribe ────────────────────────────────────────────────────────

describe("GET /api/v1/newsletter/unsubscribe (token)", () => {
  let subscriberId
  let token

  beforeAll(async () => {
    const { unsubscribeTokenFor } = await import(
      "../src/services/newsletterService.js"
    )
    const email = uniqueEmail("unsub")
    const res = await request(app)
      .post(`${NEWSLETTER}/subscribe`)
      .send({ email })
    subscriberId = res.body.data.id
    token = unsubscribeTokenFor(subscriberId)
  })

  it("unsubscribes through a verified token", async () => {
    const res = await request(app)
      .get(`${NEWSLETTER}/unsubscribe`)
      .query({ token })
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(subscriberId)
    expect(res.body.data.status).toBe("UNSUBSCRIBED")
  })

  it("stores only the SHA-256 hash of the token, never the token", async () => {
    const db = getTestDb()
    const { newsletterSubscribers } = await import("../src/db/schema/index.js")
    const { eq } = await import("drizzle-orm")
    const rows = await db
      .select()
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.id, subscriberId))
    expect(rows[0].unsubscribeTokenHash).toBeTypeOf("string")
    expect(rows[0].unsubscribeTokenHash).not.toBe(token)
    const { hashToken } = await import("../src/services/newsletterService.js")
    expect(rows[0].unsubscribeTokenHash).toBe(hashToken(token))
  })

  it("repeated unsubscribe links are idempotent", async () => {
    const res = await request(app)
      .get(`${NEWSLETTER}/unsubscribe`)
      .query({ token })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe("UNSUBSCRIBED")
  })

  it("rejects unknown or malformed tokens", async () => {
    const bad = await request(app)
      .get(`${NEWSLETTER}/unsubscribe`)
      .query({ token: "a".repeat(64) })
    expect(bad.status).toBe(404)
    expect(bad.body.error.code).toBe("INVALID_UNSUBSCRIBE_TOKEN")

    const short = await request(app)
      .get(`${NEWSLETTER}/unsubscribe`)
      .query({ token: "tiny" })
    expect(short.status).toBe(422)
    expect(short.body.error.code).toBe("INVALID_QUERY")
  })
})

// ── Admin: subscribers, stats, campaigns ───────────────────────────────

describe("Admin newsletter surface", () => {
  const stableEmail = uniqueEmail("admin-view")

  beforeAll(async () => {
    await request(app)
      .post(`${NEWSLETTER}/subscribe`)
      .send({ email: stableEmail })
  })

  it("rejects non-admin roles", async () => {
    const member = await registerMember(uniqueEmail("member"))
    const blocked = await request(app)
      .get(`${ADMIN}/subscribers`)
      .set(bearer(member))
    expect(blocked.status).toBe(403)

    const anon = await request(app).get(`${ADMIN}/subscribers`)
    expect(anon.status).toBe(401)
  })

  it("lists subscribers with search", async () => {
    // Search digits of the uuid so the fixture is deterministic vs. the seed.
    const res = await request(app)
      .get(`${ADMIN}/subscribers`)
      .query({ q: "newsletter-test-admin-view" })
      .set(bearer(admin))
      .expect(200)
    expect(
      res.body.data.some((s) => s.email === stableEmail.toLowerCase()),
    ).toBe(true)
  })

  it("aggregates newsletter stats", async () => {
    const res = await request(app)
      .get(`${ADMIN}/stats`)
      .set(bearer(admin))
      .expect(200)
    expect(res.body.data.subscribers.total).toBeGreaterThanOrEqual(1)
    expect(res.body.data.subscribers.active).toBeGreaterThanOrEqual(1)
    expect(res.body.data.emails.sent).toBeGreaterThanOrEqual(1)
    expect(Array.isArray(res.body.data.recentSubscribers)).toBe(true)
  })

  it("creates a DRAFT campaign and sanitizes stored HTML", async () => {
    const res = await request(app)
      .post(`${ADMIN}/campaigns`)
      .set(bearer(admin))
      .send({
        name: `Newsletter Test Campaign ${randomUUID().slice(0, 6)}`,
        subject: "A new listing season",
        htmlContent:
          '<p onclick="steal()">Hello {{EMAIL}}</p><script>alert(1)</script>',
        textContent: "Hello",
      })
      .expect(201)
    expect(res.body.data.status).toBe("DRAFT")
    expect(res.body.data.createdBy.name).toBe("Site Administrator")
    expect(res.body.data.htmlContent).not.toContain("<script")
    expect(res.body.data.htmlContent).not.toContain("onclick")
    expect(res.body.data.htmlContent).toContain("{{EMAIL}}")
  })

  it("sends a test to explicit addresses and records deliveries", async () => {
    const created = await request(app)
      .post(`${ADMIN}/campaigns`)
      .set(bearer(admin))
      .send({
        name: `Newsletter Test Campaign ${randomUUID().slice(0, 6)}`,
        subject: "Test run",
        htmlContent: "<p>{{EMAIL}}</p>",
        textContent: "Test run",
      })
      .expect(201)
    const testEmails = [uniqueEmail("t1"), uniqueEmail("t2")]
    const res = await request(app)
      .post(`${ADMIN}/campaigns/${created.body.data.id}/send-test`)
      .set(bearer(admin))
      .send({ testEmails })
      .expect(202)
    expect(res.body.data.length).toBe(2)
    expect(res.body.data.every((d) => d.status === "SENT")).toBe(true)
    expect(res.body.data.every((d) => d.kind === "CAMPAIGN")).toBe(true)
    expect(res.body.data.map((d) => d.recipientEmail).sort()).toEqual(
      testEmails.map((e) => e.toLowerCase()).sort(),
    )
  })

  it("validates test sends (emails only, limits)", async () => {
    const created = await request(app)
      .post(`${ADMIN}/campaigns`)
      .set(bearer(admin))
      .send({
        name: `Newsletter Test Campaign ${randomUUID().slice(0, 6)}`,
        subject: "Invalid test",
        htmlContent: "<p>hi</p>",
        textContent: "hi",
      })
      .expect(201)
    const bad = await request(app)
      .post(`${ADMIN}/campaigns/${created.body.data.id}/send-test`)
      .set(bearer(admin))
      .send({ testEmails: ["nope"] })
    expect(bad.status).toBe(422)

    const tooMany = await request(app)
      .post(`${ADMIN}/campaigns/${created.body.data.id}/send-test`)
      .set(bearer(admin))
      .send({ testEmails: Array.from({ length: 11 }, () => uniqueEmail("x")) })
    expect(tooMany.status).toBe(422)
  })
})

// ── Broadcast (controlled subscriber set) ──────────────────────────────

describe("Campaign broadcast", () => {
  let campaignId
  let keep

  beforeAll(async () => {
    // Reset this suite's subscribers so the broadcast count is deterministic.
    const db = getTestDb()
    const { newsletterSubscribers } = await import("../src/db/schema/index.js")
    const { ilike } = await import("drizzle-orm")
    await db
      .delete(newsletterSubscribers)
      .where(ilike(newsletterSubscribers.email, "newsletter-test-%"))

    keep = uniqueEmail("keep-a")
    const drop = uniqueEmail("drop-b")
    await request(app).post(`${NEWSLETTER}/subscribe`).send({ email: keep })
    await request(app).post(`${NEWSLETTER}/subscribe`).send({ email: drop })
    const { unsubscribeTokenFor } = await import(
      "../src/services/newsletterService.js"
    )
    const { data: dropRow } = (
      await request(app)
        .get(`${NEWSLETTER}/unsubscribe`)
        .query({
          token: unsubscribeTokenFor(
            // resolve the drop subscriber's id via the list
            (
              await request(app)
                .get(`${ADMIN}/subscribers`)
                .set(bearer(admin))
                .query({ q: drop })
                .expect(200)
            ).body.data.find((s) => s.email === drop.toLowerCase()).id,
          ),
        })
    ).body
    expect(dropRow.status).toBe("UNSUBSCRIBED")

    const created = await request(app)
      .post(`${ADMIN}/campaigns`)
      .set(bearer(admin))
      .send({
        name: `Newsletter Test Broadcast ${randomUUID().slice(0, 6)}`,
        subject: "The big drop",
        htmlContent: "<p>{{EMAIL}} — see {{UNSUBSCRIBE_URL}}</p>",
        textContent: "{{EMAIL}}",
      })
      .expect(201)
    campaignId = created.body.data.id
  })

  it("sends only to ACTIVE subscribers with per-recipient deliveries", async () => {
    const res = await request(app)
      .post(`${ADMIN}/campaigns/${campaignId}/send`)
      .set(bearer(admin))
      .expect(202)
    expect(res.body.data).toMatchObject({ sent: 1, failed: 0, total: 1 })

    const db = getTestDb()
    const { emailDeliveries, emailCampaigns } = await import(
      "../src/db/schema/index.js"
    )
    const { eq } = await import("drizzle-orm")
    const campaign = await db
      .select()
      .from(emailCampaigns)
      .where(eq(emailCampaigns.id, campaignId))
    expect(campaign[0].status).toBe("SENT")
    expect(campaign[0].sentAt).toBeTypeOf("object")

    const deliveries = await db
      .select()
      .from(emailDeliveries)
      .where(eq(emailDeliveries.campaignId, campaignId))
    // Exactly the one ACTIVE subscriber received the broadcast (the
    // unsubscribed address was excluded).
    expect(
      deliveries
        .filter((d) => d.kind === "CAMPAIGN")
        .map((d) => d.recipientEmail),
    ).toEqual([keep.toLowerCase()])
    expect(deliveries.filter((d) => d.kind === "CAMPAIGN")[0].status).toBe(
      "SENT",
    )
  })

  it("refuses to broadcast a campaign twice", async () => {
    const res = await request(app)
      .post(`${ADMIN}/campaigns/${campaignId}/send`)
      .set(bearer(admin))
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe("CAMPAIGN_ALREADY_SENT")
  })

  it("hands an unknown campaign a 404", async () => {
    const res = await request(app)
      .post(`${ADMIN}/campaigns/00000000-0000-0000-0000-000000000000/send`)
      .set(bearer(admin))
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe("CAMPAIGN_NOT_FOUND")
  })

  it("exposes the delivery history to admins", async () => {
    const res = await request(app)
      .get(`${ADMIN}/history`)
      .set(bearer(admin))
      .query({ kind: "CAMPAIGN" })
      .expect(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    for (const row of res.body.data) {
      expect(row.kind).toBe("CAMPAIGN")
    }
  })
})

// ── Provider resilience ────────────────────────────────────────────────

describe("Transport outage resilience", () => {
  it("records a FAILED delivery without blocking the subscription", async () => {
    const { setTransportOverride } = await import(
      "../src/services/email/transports.js"
    )
    setTransportOverride(async () => {
      throw new Error("relay down")
    })
    try {
      const email = uniqueEmail("outage")
      const res = await request(app)
        .post(`${NEWSLETTER}/subscribe`)
        .send({ email })
      expect(res.status).toBe(201)
      expect(res.body.data.status).toBe("ACTIVE")

      const db = getTestDb()
      const { emailDeliveries } = await import("../src/db/schema/index.js")
      const { eq } = await import("drizzle-orm")
      const rows = await db
        .select()
        .from(emailDeliveries)
        .where(eq(emailDeliveries.recipientEmail, email.toLowerCase()))
      expect(
        rows.some((r) => r.kind === "WELCOME" && r.status === "FAILED"),
      ).toBe(true)
      expect(rows[0].errorMessage).toContain("relay down")
    } finally {
      setTransportOverride(null)
    }
  })
})
