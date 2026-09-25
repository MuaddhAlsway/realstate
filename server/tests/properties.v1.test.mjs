import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import request from "supertest"
import { randomUUID } from "node:crypto"
import {
  app,
  cleanDatabase,
  uniqueSlug,
  adminToken,
  bearer,
} from "./helpers.mjs"

/**
 * Phase 03 — /api/v1/properties CRUD, exercised across the HTTP boundary.
 * Runs against the isolated estate_test database only.
 *
 * Phase 05: mutations require an authenticated AGENT/ADMIN access token, so
 * every write below sends the seeded admin's Bearer token.
 */

const URL = "/api/v1/properties"

let token
beforeEach(async () => {
  token = await adminToken()
})

const validPayload = (slug) => ({
  title: "API Test Villa",
  slug,
  propertyType: "VILLA",
  price: 2500000,
  city: "Jeddah",
  district: "Al Hamra",
  bedrooms: 5,
  bathrooms: 6,
  description: "Created by the Phase 03 test suite.",
})

let seededId = null
let seededSlug = null

afterAll(async () => {
  await cleanDatabase()
})

describe("GET /api/v1/properties", () => {
  it("lists seeded properties with a predictable envelope", async () => {
    const res = await request(app).get(URL).expect(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThanOrEqual(6)
    // Parallel suites (Phase 04/05) may interleave filtered fixtures, so anchor
    // shape assertions and the shared id/slug on a row from the seed rather
    // than data[0] (which may be an agent-less fixture from a concurrent file).
    const seeded = res.body.data.find(
      (p) =>
        !p.slug.startsWith("api-test-") &&
        !p.slug.startsWith("query-test-") &&
        !p.slug.startsWith("auth-test-"),
    )
    expect(seeded).toBeTruthy()
    expect(seeded).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      slug: expect.any(String),
      price: expect.any(Number),
      propertyType: expect.any(String),
      neighborhood: expect.any(Object),
      agent: expect.anything(),
    })
    seededId = seeded.id
    seededSlug = seeded.slug
  })

  it("has an unknown-route 404 on the v1 scope", async () => {
    const res = await request(app).get("/api/v1/nope").expect(404)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe("NOT_FOUND")
  })
})

describe("GET /api/v1/properties/:id", () => {
  it("returns a full detail resource for a seeded property", async () => {
    expect(seededId).toBeTruthy()
    const res = await request(app).get(`${URL}/${seededId}`).expect(200)
    expect(res.body.data.id).toBe(seededId)
    expect(Array.isArray(res.body.data.images)).toBe(true)
    expect(Array.isArray(res.body.data.amenities)).toBe(true)
    expect(res.body.data.neighborhood).toBeTruthy()
  })

  it("404s with PROPERTY_NOT_FOUND for a missing property", async () => {
    const res = await request(app).get(`${URL}/${randomUUID()}`).expect(404)
    expect(res.body.error.code).toBe("PROPERTY_NOT_FOUND")
  })

  it("422s with VALIDATION_ERROR for a malformed id", async () => {
    const res = await request(app).get(`${URL}/not-a-uuid`).expect(422)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
  })
})

describe("POST /api/v1/properties", () => {
  it("creates a property and persists it", async () => {
    const slug = uniqueSlug()
    const create = await request(app)
      .post(URL)
      .set(bearer(token))
      .send(validPayload(slug))
      .expect(201)
    expect(create.body.data.slug).toBe(slug)
    const id = create.body.data.id
    const read = await request(app).get(`${URL}/${id}`).expect(200)
    expect(read.body.data.title).toBe("API Test Villa")
    expect(read.body.data.price).toBe(2500000)
  })

  it("422s when a required field is missing", async () => {
    const res = await request(app)
      .post(URL)
      .set(bearer(token))
      .send({ ...validPayload(uniqueSlug()), title: undefined })
      .expect(422)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
    expect(res.body.error.message).toMatch(/title/i)
  })

  it("409s with PROPERTY_SLUG_CONFLICT for a duplicate slug", async () => {
    expect(seededSlug).toBeTruthy()
    const res = await request(app)
      .post(URL)
      .set(bearer(token))
      .send(validPayload(seededSlug))
      .expect(409)
    expect(res.body.error.code).toBe("PROPERTY_SLUG_CONFLICT")
  })

  it("422s with INVALID_REFERENCE for a bad agentId", async () => {
    const res = await request(app)
      .post(URL)
      .set(bearer(token))
      .send({ ...validPayload(uniqueSlug()), agentId: randomUUID() })
      .expect(422)
    expect(res.body.error.code).toBe("INVALID_REFERENCE")
  })

  it("422s when an invalid enum value reaches validation", async () => {
    const res = await request(app)
      .post(URL)
      .set(bearer(token))
      .send({ ...validPayload(uniqueSlug()), propertyType: "CASTLE" })
      .expect(422)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
  })
})

describe("PATCH /api/v1/properties/:id", () => {
  it("partially updates and returns the updated resource", async () => {
    const slug = uniqueSlug()
    const created = await request(app)
      .post(URL)
      .set(bearer(token))
      .send(validPayload(slug))
      .expect(201)
    const id = created.body.data.id

    const res = await request(app)
      .patch(`${URL}/${id}`)
      .set(bearer(token))
      .send({ price: 3150000, status: "PENDING" })
      .expect(200)
    expect(res.body.data.price).toBe(3150000)
    expect(res.body.data.status).toBe("PENDING")
    expect(res.body.data.title).toBe("API Test Villa") // untouched
  })

  it("422s for an empty update body", async () => {
    const slug = uniqueSlug()
    const created = await request(app)
      .post(URL)
      .set(bearer(token))
      .send(validPayload(slug))
      .expect(201)
    const res = await request(app)
      .patch(`${URL}/${created.body.data.id}`)
      .set(bearer(token))
      .send({})
      .expect(422)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
  })

  it("404s when patching a missing property", async () => {
    const res = await request(app)
      .patch(`${URL}/${randomUUID()}`)
      .set(bearer(token))
      .send({ price: 1 })
      .expect(404)
    expect(res.body.error.code).toBe("PROPERTY_NOT_FOUND")
  })
})

describe("DELETE /api/v1/properties/:id", () => {
  it("204s, removes the row, cascades to dependent rows", async () => {
    const slug = uniqueSlug()
    const created = await request(app)
      .post(URL)
      .set(bearer(token))
      .send(validPayload(slug))
      .expect(201)
    const id = created.body.data.id

    await request(app).delete(`${URL}/${id}`).set(bearer(token)).expect(204)
    await request(app).get(`${URL}/${id}`).expect(404)
  })

  it("404s when deleting a missing property", async () => {
    const res = await request(app)
      .delete(`${URL}/${randomUUID()}`)
      .set(bearer(token))
      .expect(404)
    expect(res.body.error.code).toBe("PROPERTY_NOT_FOUND")
  })
})
