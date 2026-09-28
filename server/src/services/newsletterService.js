import { createHash, createHmac, randomUUID } from "node:crypto"
import { and, count, desc, eq, ilike } from "drizzle-orm"
import { getDb } from "../db/index.js"
import * as schema from "../db/schema/index.js"
import { HttpError } from "../errors/index.js"
import { ErrorCodes } from "../errors/error-codes.js"
import { translateDatabaseError } from "../errors/pg.js"
import { UNSUBSCRIBE_SECRET } from "../config/env.js"
import { sendEmail } from "./email/index.js"
import { renderWelcome, renderCampaign } from "./email/templates.js"
import { sanitizeHtml } from "./email/sanitize.js"

/**
 * Newsletter / campaign service (Phase 10).
 *
 * Subscription, unsubscribe and the campaign lifecycle. Recipient identity is
 * always the persisted `newsletter_subscribers.email` — the public subscribe
 * endpoint stores one; campaign sends read active rows; admin never types a
 * recipient address (the relationship decides).
 *
 * Unsubscribe tokens are deterministic HMACs of the subscriber id under the
 * server-side UNSUBSCRIBE_SECRET: they can be (re)derived when an email is
 * composed (welcome or campaign) yet only their SHA-256 hash is stored — a DB
 * leak never yields a usable link, and the raw token never appears in the API
 * response.
 *
 * Email delivery never blocks the business action: `sendEmail` records a
 * QUEUED→SENT/FAILED delivery row with the transport outcome and does not
 * throw, so a relay outage cannot lose subscriptions or campaigns.
 */

const { newsletterSubscribers, emailCampaigns, emailDeliveries } = schema

export function normalizeEmail(email) {
  return String(email).trim().toLowerCase()
}

export function hashToken(token) {
  return createHash("sha256").update(String(token)).digest("hex")
}

/** Deterministic, non-enumerable unsubscribe token for a subscriber id. */
export function unsubscribeTokenFor(subscriberId) {
  return createHmac("sha256", UNSUBSCRIBE_SECRET).update(String(subscriberId)).digest("hex")
}

function requireDb() {
  const db = getDb()
  if (!db)
    throw new HttpError(
      "Database is not configured",
      503,
      ErrorCodes.SERVICE_UNAVAILABLE,
    )
  return db
}

/** Run one DB call, translating predictable driver errors to HttpErrors. */
async function run(fn) {
  try {
    return await fn()
  } catch (err) {
    const translated = translateDatabaseError(err)
    if (translated) throw translated
    throw err
  }
}

function findSubscriberById(db, id) {
  return run(() =>
    db.query.newsletterSubscribers.findFirst({ where: eq(newsletterSubscribers.id, id) }),
  )
}

function findSubscriberByEmail(db, email) {
  return run(() =>
    db.query.newsletterSubscribers.findFirst({
      where: eq(newsletterSubscribers.email, email),
    }),
  )
}

const campaignInclude = {
  createdBy: { columns: { id: true, name: true } },
  deliveries: { columns: { id: true, status: true } },
}

function findCampaignById(db, campaignId, include = campaignInclude) {
  return run(() =>
    db.query.emailCampaigns.findFirst({
      where: eq(emailCampaigns.id, campaignId),
      ...(include ? { with: include } : {}),
    }),
  )
}

function unsubscribeUrl(subscriber, baseUrl) {
  return `${baseUrl}/api/v1/newsletter/unsubscribe?token=${unsubscribeTokenFor(subscriber.id)}`
}

async function sendWelcome(subscriber, baseUrl) {
  const siteUrl = baseUrl ?? ""
  const { subject, html, text } = renderWelcome({
    baseUrl: siteUrl,
    unsubscribeUrl: siteUrl ? unsubscribeUrl(subscriber, siteUrl) : null,
    siteUrl,
  })
  await sendEmail({ to: subscriber.email, subject, html, text, kind: "WELCOME" })
}

// ── Public subscription ────────────────────────────────────────────────

/**
 * Subscribe an email to the newsletter. Returns `{ subscriber, created }`;
 * `created` is false when the address was already on the list. Reactivating a
 * previously-unsubscribed address re-registers it (same deterministic token,
 * fresh welcome email).
 */
export async function subscribe(emailInput, { baseUrl } = {}) {
  const db = requireDb()
  const email = normalizeEmail(emailInput)

  // The id is generated client-side so the deterministic unsubscribe token
  // can be derived + hashed in the very same INSERT (no placeholder write).
  const id = randomUUID()
  const tokenHash = hashToken(unsubscribeTokenFor(id))

  let subscriber
  let created = false
  try {
    const [inserted] = await run(() =>
      db
        .insert(newsletterSubscribers)
        .values({ id, email, unsubscribeTokenHash: tokenHash })
        .returning(),
    )
    subscriber = inserted
    created = true
  } catch (err) {
    // A mapped constraint code means the email already exists — reconcile
    // instead of surfacing a conflict to a double-tapping subscriber.
    if (err?.code !== ErrorCodes.NEWSLETTER_SUBSCRIBER_EXISTS) throw err
    subscriber = await findSubscriberByEmail(db, email)
  }

  const reactivated = !created && subscriber.status === "UNSUBSCRIBED"
  if (reactivated) {
    await run(() =>
      db
        .update(newsletterSubscribers)
        .set({ status: "ACTIVE", unsubscribedAt: null, updatedAt: new Date() })
        .where(eq(newsletterSubscribers.id, subscriber.id)),
    )
    subscriber = await findSubscriberById(db, subscriber.id)
  }

  if (created || reactivated) await sendWelcome(subscriber, baseUrl)

  return { subscriber, created }
}

// ── Unsubscribe ────────────────────────────────────────────────────────

/**
 * Verify a raw unsubscribe token and flip the row to UNSUBSCRIBED.
 * Idempotent: a repeated link (already UNSUBSCRIBED) resolves 200.
 */
export async function unsubscribeToken(rawToken) {
  const db = requireDb()

  if (typeof rawToken !== "string" || rawToken.length < 20) {
    throw new HttpError(
      "This unsubscribe link is not valid",
      404,
      ErrorCodes.INVALID_UNSUBSCRIBE_TOKEN,
    )
  }

  const tokenHash = hashToken(rawToken)
  const row = await run(() =>
    db.query.newsletterSubscribers.findFirst({
      where: eq(newsletterSubscribers.unsubscribeTokenHash, tokenHash),
    }),
  )
  if (!row)
    throw new HttpError(
      "This unsubscribe link is not valid or has already been used",
      404,
      ErrorCodes.INVALID_UNSUBSCRIBE_TOKEN,
    )
  if (row.status !== "UNSUBSCRIBED") {
    await run(() =>
      db
        .update(newsletterSubscribers)
        .set({ status: "UNSUBSCRIBED", unsubscribedAt: new Date(), updatedAt: new Date() })
        .where(eq(newsletterSubscribers.id, row.id)),
    )
  }
  return findSubscriberById(db, row.id)
}

// ── Admin reads ────────────────────────────────────────────────────────

export async function listSubscribers(query = {}) {
  const db = requireDb()
  const page = query.page ?? 1
  const limit = query.limit ?? 20

  const filters = []
  if (query.status) filters.push(eq(newsletterSubscribers.status, query.status))
  if (query.q) filters.push(ilike(newsletterSubscribers.email, `%${query.q}%`))
  const where = filters.length ? and(...filters) : undefined

  const [rows, totals] = await Promise.all([
    run(() =>
      db.query.newsletterSubscribers.findMany({
        where,
        orderBy: desc(newsletterSubscribers.subscribedAt),
        limit,
        offset: (page - 1) * limit,
      }),
    ),
    run(() => db.select({ n: count() }).from(newsletterSubscribers).where(where)),
  ])

  const total = totals[0]?.n ?? 0
  return {
    items: rows,
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.max(1, Math.ceil(total / limit)),
  }
}

export async function newsletterStats() {
  const db = requireDb()

  const [totalRows, activeRows, unsubscribedRows, sentRows, failedRows, recent] =
    await Promise.all([
      run(() => db.select({ n: count() }).from(newsletterSubscribers)),
      run(() =>
        db
          .select({ n: count() })
          .from(newsletterSubscribers)
          .where(eq(newsletterSubscribers.status, "ACTIVE")),
      ),
      run(() =>
        db
          .select({ n: count() })
          .from(newsletterSubscribers)
          .where(eq(newsletterSubscribers.status, "UNSUBSCRIBED")),
      ),
      run(() =>
        db
          .select({ n: count() })
          .from(emailDeliveries)
          .where(eq(emailDeliveries.status, "SENT")),
      ),
      run(() =>
        db
          .select({ n: count() })
          .from(emailDeliveries)
          .where(eq(emailDeliveries.status, "FAILED")),
      ),
      run(() =>
        db.query.newsletterSubscribers.findMany({
          orderBy: desc(newsletterSubscribers.subscribedAt),
          limit: 5,
        }),
      ),
    ])

  return {
    subscribers: {
      total: totalRows[0]?.n ?? 0,
      active: activeRows[0]?.n ?? 0,
      unsubscribed: unsubscribedRows[0]?.n ?? 0,
    },
    emails: {
      sent: sentRows[0]?.n ?? 0,
      failed: failedRows[0]?.n ?? 0,
    },
    recentSubscribers: recent,
  }
}

// ── Campaigns ──────────────────────────────────────────────────────────

export async function createCampaign(userId, input) {
  const db = requireDb()
  const [inserted] = await run(() =>
    db
      .insert(emailCampaigns)
      .values({
        name: input.name,
        subject: input.subject,
        htmlContent: sanitizeHtml(input.htmlContent),
        textContent: input.textContent,
        createdByUserId: userId,
      })
      .returning({ id: emailCampaigns.id }),
  )
  return findCampaignById(db, inserted.id)
}

export async function listCampaigns(query = {}) {
  const db = requireDb()
  const page = query.page ?? 1
  const limit = query.limit ?? 20

  const [rows, totals] = await Promise.all([
    run(() =>
      db.query.emailCampaigns.findMany({
        with: campaignInclude,
        orderBy: desc(emailCampaigns.createdAt),
        limit,
        offset: (page - 1) * limit,
      }),
    ),
    run(() => db.select({ n: count() }).from(emailCampaigns)),
  ])

  const total = totals[0]?.n ?? 0
  return {
    items: rows,
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.max(1, Math.ceil(total / limit)),
  }
}

async function assertDraftCampaign(db, campaignId) {
  const campaign = await findCampaignById(db, campaignId, null)
  if (!campaign)
    throw new HttpError(
      "This campaign does not exist",
      404,
      ErrorCodes.CAMPAIGN_NOT_FOUND,
    )
  if (campaign.status !== "DRAFT") {
    throw new HttpError(
      `Campaign status is ${campaign.status} — only a DRAFT campaign can be sent`,
      409,
      ErrorCodes.CAMPAIGN_ALREADY_SENT,
    )
  }
  return campaign
}

/**
 * Send a DRAFT campaign to an explicit admin-provided test list. Each send is
 * recorded in the delivery ledger (test deliveries have no unsubscribe link).
 */
export async function sendTestCampaign(campaignId, testEmails, { baseUrl } = {}) {
  const db = requireDb()
  const campaign = await assertDraftCampaign(db, campaignId)
  const siteUrl = baseUrl ?? ""
  const results = []

  for (const email of testEmails) {
    const { subject, html, text } = renderCampaign({
      subject: campaign.subject,
      htmlContent: campaign.htmlContent,
      textContent: campaign.textContent,
      baseUrl: siteUrl,
      email,
      unsubscribeUrl: null,
      siteUrl,
    })
    results.push(
      await sendEmail({ to: email, subject, html, text, kind: "CAMPAIGN", campaignId }),
    )
  }

  return results
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/**
 * Broadcast a DRAFT campaign to every ACTIVE subscriber. Recipients are
 * carried in per-recipient deliveries with batching (5 concurrent) so a slow
 * relay never pins the whole send. Each email only ever interpolates its own
 * subscriber's {{EMAIL}} / {{UNSUBSCRIBE_URL}} (per-recipient privacy).
 */
export async function sendCampaignToSubscribers(campaignId, { baseUrl } = {}) {
  const db = requireDb()
  const campaign = await assertDraftCampaign(db, campaignId)

  await run(() =>
    db
      .update(emailCampaigns)
      .set({ status: "SENDING", updatedAt: new Date() })
      .where(eq(emailCampaigns.id, campaignId)),
  )

  const active = await run(() =>
    db.query.newsletterSubscribers.findMany({
      where: eq(newsletterSubscribers.status, "ACTIVE"),
      columns: { id: true, email: true },
    }),
  )

  if (active.length === 0) {
    await run(() =>
      db
        .update(emailCampaigns)
        .set({ status: "SENT", sentAt: new Date(), updatedAt: new Date() })
        .where(eq(emailCampaigns.id, campaignId)),
    )
    return { sent: 0, failed: 0, total: 0 }
  }

  const siteUrl = baseUrl ?? ""
  const outcomes = await mapLimit(active, 5, async (subscriber) => {
    const { subject, html, text } = renderCampaign({
      subject: campaign.subject,
      htmlContent: campaign.htmlContent,
      textContent: campaign.textContent,
      baseUrl: siteUrl,
      email: subscriber.email,
      unsubscribeUrl: siteUrl ? unsubscribeUrl(subscriber, siteUrl) : null,
      siteUrl,
    })
    return sendEmail({
      to: subscriber.email,
      subject,
      html,
      text,
      kind: "CAMPAIGN",
      campaignId,
    })
  })

  const sent = outcomes.filter((o) => o.status === "SENT").length
  const failed = outcomes.length - sent

  const allFailed = sent === 0 && failed > 0
  await run(() =>
    db
      .update(emailCampaigns)
      .set({
        status: allFailed ? "FAILED" : "SENT",
        failedReason: allFailed ? "Every recipient delivery failed" : null,
        sentAt: allFailed ? null : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(emailCampaigns.id, campaignId)),
  )

  return { sent, failed, total: active.length, status: allFailed ? "FAILED" : "SENT" }
}

// ── Delivery history ───────────────────────────────────────────────────

export async function listDeliveries(query = {}) {
  const db = requireDb()
  const page = query.page ?? 1
  const limit = query.limit ?? 20

  const filters = []
  if (query.kind) filters.push(eq(emailDeliveries.kind, query.kind))
  if (query.status) filters.push(eq(emailDeliveries.status, query.status))
  if (query.q) filters.push(ilike(emailDeliveries.recipientEmail, `%${query.q}%`))
  const where = filters.length ? and(...filters) : undefined

  const [rows, totals] = await Promise.all([
    run(() =>
      db.query.emailDeliveries.findMany({
        where,
        orderBy: desc(emailDeliveries.createdAt),
        limit,
        offset: (page - 1) * limit,
      }),
    ),
    run(() => db.select({ n: count() }).from(emailDeliveries).where(where)),
  ])

  const total = totals[0]?.n ?? 0
  return {
    items: rows,
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.max(1, Math.ceil(total / limit)),
  }
}