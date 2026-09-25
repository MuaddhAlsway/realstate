import { afterAll, beforeAll, describe, expect, it } from "vitest"
import request from "supertest"
import {
  app,
  cleanDatabase,
  uniqueSlug,
  adminToken,
  bearer,
} from "./helpers.mjs"
import { setMediaClientForTests } from "../src/services/mediaService.js"

/**
 * Phase 10 — admin media surface: signed direct-upload authorization +
 * the orphan sweep. Runs against the isolated estate_test database via a
 * stub media client (no Cloudinary network access, ever).
 */

const AUTHORIZE = "/api/v1/admin/media/upload-authorize"
const ORPHANS = "/api/v1/admin/media/orphans"

// Deterministic stub — records provider calls so assertions can verify the
// app's provider collateral without a real Cloudinary account.
function recordingClient() {
  const calls = { destroy: [], removeTag: [], destroyMany: [] }
  const client = {
    calls,
    cloudName: "test-cloud",
    apiKey: "test-key",
    sign: () => "sig-test-only",
    destroy: async (publicId) => {
      calls.destroy.push(publicId)
      return { result: "ok" }
    },
    removeTag: async (publicIds) => {
      calls.removeTag.push(publicIds)
      return { result: "ok" }
    },
    destroyMany: async (publicIds) => {
      calls.destroyMany.push(publicIds)
      return calls.destroyMany.at(-1)
    },
    listPending: async () => [],
  }
  return client
}

let token
let userToken
let client

const registerUser = async () => {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({
      name: "Media Test User",
      email: `media-test-${Math.random().toString(36).slice(2, 10)}@estate.test`,
      password: "MediaTest-123",
    })
  return res.body.data.accessToken
}

beforeAll(async () => {
  client = recordingClient()
  setMediaClientForTests(client)
  token = await adminToken()
  userToken = await registerUser()
})

afterAll(async () => {
  setMediaClientForTests(null)
  await cleanDatabase("media-")
})

describe("POST /api/v1/admin/media/upload-authorize (ADMIN only)", () => {
  it("401 without a token, 403 for a non-admin role", async () => {
    await request(app).post(AUTHORIZE).send({ purpose: "property" }).expect(401)
    await request(app)
      .post(AUTHORIZE)
      .set(bearer(userToken))
      .send({ purpose: "property" })
      .expect(403)
  })

  it("returns a signed authorization for the property purpose", async () => {
    const res = await request(app)
      .post(AUTHORIZE)
      .set(bearer(token))
      .send({ purpose: "property" })
      .expect(200)

    expect(res.body.success).toBe(true)
    const data = res.body.data
    expect(data.signature).toBe("sig-test-only")
    expect(data.cloudName).toBeTypeOf("string")
    expect(data.apiKey).toBeTypeOf("string")
    expect(data.uploadUrl).toMatch(/^https:\/\/api\.cloudinary\.com\/v1_\d+\//)
    expect(data.params.folder).toBe("estate/property")
    expect(data.params.tags).toEqual(["estate-property", "estate-pending"])
    expect(data.params.expires_at).toBeGreaterThan(
      Math.floor(Date.now() / 1000),
    )
  })

  it("signs a cms-purpose authorization into the cms folder", async () => {
    const res = await request(app)
      .post(AUTHORIZE)
      .set(bearer(token))
      .send({ purpose: "cms" })
      .expect(200)
    expect(res.body.data.params.folder).toBe("estate/cms")
  })

  it("never leaks the API secret to the browser", async () => {
    const res = await request(app)
      .post(AUTHORIZE)
      .set(bearer(token))
      .send({ purpose: "property" })
      .expect(200)
    const raw = JSON.stringify(res.body)
    expect(raw).not.toMatch(/api_secret|apiSecret|"secret"/i)
    expect(res.body.data.apiSecret).toBeUndefined()
  })

  it("422s for an unknown purpose and for an empty body", async () => {
    const unknown = await request(app)
      .post(AUTHORIZE)
      .set(bearer(token))
      .send({ purpose: "widget" })
      .expect(422)
    expect(unknown.body.error.code).toBe("VALIDATION_ERROR")

    const empty = await request(app)
      .post(AUTHORIZE)
      .set(bearer(token))
      .send({})
      .expect(422)
    expect(empty.body.error.code).toBe("VALIDATION_ERROR")
  })

  it("429s when the per-account signing limit is crossed", async () => {
    app.locals.rateLimitOptions = { windowMs: 60_000, max: 0 }
    try {
      // max:0 ⇒ the very first signed request is already over the budget;
      // this deterministically exercises the 429 path on a live shared
      // limiter (buckets persist across the tests above).
      const blocked = await request(app)
        .post(AUTHORIZE)
        .set(bearer(token))
        .send({ purpose: "property" })
      expect(blocked.status).toBe(429)
      expect(blocked.body.error.code).toBe("RATE_LIMITED")
    } finally {
      delete app.locals.rateLimitOptions
    }
  })
})

describe("GET/DELETE /api/v1/admin/media/orphans", () => {
  it("lists and destroys pending, unreferenced, old assets", async () => {
    const old = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
    client.listPending = async () => [
      { public_id: "estate/property/orphan1", created_at: old },
      { public_id: "estate/property/orphan2", created_at: old },
      {
        public_id: "estate/property/recent",
        created_at: new Date().toISOString(),
      },
    ]

    const list = await request(app).get(ORPHANS).set(bearer(token)).expect(200)
    expect(list.body.data.count).toBe(2)
    expect(list.body.data.items.map((i) => i.publicId)).toContain(
      "estate/property/orphan1",
    )

    const clean = await request(app)
      .delete(ORPHANS)
      .set(bearer(token))
      .expect(200)
    expect(clean.body.data.destroyed).toBe(2)
    expect(clean.body.data.publicIds).toEqual([
      "estate/property/orphan1",
      "estate/property/orphan2",
    ])
    expect(client.calls.destroyMany).toHaveLength(1)
  })

  it("destroys nothing when every pending asset is referenced", async () => {
    const old = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
    const slug = uniqueSlug("media")
    const created = await request(app)
      .post("/api/v1/properties")
      .set(bearer(token))
      .send({
        title: "Orphan Guard Residence",
        slug,
        propertyType: "VILLA",
        price: 5000000,
        city: "Jeddah",
        district: "Ash Shati",
        images: [
          {
            url: "https://res.cloudinary.com/test-cloud/image/upload/v1/estate/property/kept.jpg",
            publicId: "estate/property/kept",
          },
        ],
      })
      .expect(201)
    expect(created.body.data.images[0].publicId).toBe("estate/property/kept")

    client.listPending = async () => [
      { public_id: "estate/property/kept", created_at: old },
    ]
    await request(app).delete(ORPHANS).set(bearer(token)).expect(200)

    // The referenced asset is skipped, and post-commit the upload tag was
    // removed (attachment) — none destroyed.
    expect(client.calls.destroyMany).toHaveLength(1) // from the prior test
    expect(client.calls.removeTag.flat()).toContain("estate/property/kept")
  })
})
