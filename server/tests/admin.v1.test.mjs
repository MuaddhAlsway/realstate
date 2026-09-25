import { beforeAll, afterAll, describe, expect, it } from "vitest"
import request from "supertest"
import { randomUUID } from "node:crypto"
import {
  app,
  cleanDatabase,
  cleanAuthUsers,
  uniqueSlug,
  adminToken,
  bearer,
} from "./helpers.mjs"

/**
 * Phase 09 — /api/v1/admin: RBAC, dashboard aggregation and management
 * lists. Runs against the isolated estate_test database only.
 *
 * Authz matrix: every admin route returns 401 without a token and 403 for
 * a non-admin (USER) token; the seeded admin account exercises 200s.
 * Fixtures use the `admin-*`/`admin-test-*` families.
 */

const ADMIN = "/api/v1/admin"
const AUTH = "/api/v1/auth"
const PROPERTIES = "/api/v1/properties"

const uniqueEmail = (tag) =>
  `admin-test-${tag}-${randomUUID().slice(0, 8)}@estate.test`

let token
let userToken

const ADMIN_ROUTES = [
  ["GET", "/dashboard"],
  ["GET", "/properties"],
  ["GET", "/viewings"],
  ["GET", "/agents"],
  ["GET", "/users"],
  ["GET", "/amenities"],
  ["GET", "/neighborhoods"],
]

beforeAll(async () => {
  token = await adminToken()
  const reg = await request(app)
    .post(`${AUTH}/register`)
    .send({
      name: "Admin Test User",
      email: uniqueEmail("user"),
      password: "AdminTest-123",
    })
  expect(reg.status).toBe(201)
  userToken = reg.body.data.accessToken
})

afterAll(async () => {
  await cleanDatabase("admin-")
  await cleanAuthUsers("admin-test-")
})

describe("RBAC on /api/v1/admin", () => {
  it.each(ADMIN_ROUTES)("%s %s → 401 without a token", async (method, path) => {
    const res = await request(app)[method.toLowerCase()](`${ADMIN}${path}`)
      .expect(401)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe("UNAUTHORIZED")
  })

  it.each(ADMIN_ROUTES)(
    "%s %s → 403 for a non-admin user",
    async (method, path) => {
      const res = await request(app)[method.toLowerCase()](`${ADMIN}${path}`)
        .set(bearer(userToken))
        .expect(403)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe("FORBIDDEN")
    },
  )

  it("rejects a malformed Bearer token with 401", async () => {
    await request(app).get(`${ADMIN}/dashboard`).set(bearer("junk")).expect(401)
  })
})

describe("GET /api/v1/admin/dashboard", () => {
  it("returns aggregated counts in a stable shape", async () => {
    const res = await request(app)
      .get(`${ADMIN}/dashboard`)
      .set(bearer(token))
      .expect(200)
    const d = res.body.data
    expect(d.properties.total).toBeTypeOf("number")
    expect(d.properties.byStatus).toMatchObject({
      AVAILABLE: expect.any(Number),
      PENDING: expect.any(Number),
      DRAFT: expect.any(Number),
      SOLD: expect.any(Number),
      RENTED: expect.any(Number),
    })
    expect(d.properties.byPurpose.SALE).toBeTypeOf("number")
    expect(d.properties.byPurpose.RENT).toBeTypeOf("number")
    expect(d.users).toBeTypeOf("number")
    expect(d.agents).toBeTypeOf("number")
    expect(d.neighborhoods).toBeTypeOf("number")
    expect(d.amenities).toBeTypeOf("number")
    expect(d.viewingRequests.byStatus).toMatchObject({
      PENDING: expect.any(Number),
      CONFIRMED: expect.any(Number),
      COMPLETED: expect.any(Number),
      CANCELLED: expect.any(Number),
    })
  })
})

describe("GET /api/v1/admin/properties", () => {
  it("lists every status with meta, anchored on a seeded row", async () => {
    const res = await request(app)
      .get(`${ADMIN}/properties`)
      .set(bearer(token))
      .expect(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.meta.total).toBeTypeOf("number")
    const seeded = res.body.data.find(
      (p) => !p.slug.startsWith("api-test-") && !p.slug.startsWith("admin-"),
    )
    expect(seeded).toBeTruthy()
    expect(seeded.status).toBeTypeOf("string")
  })

  it("filters by status and search", async () => {
    const slug = uniqueSlug("admin")
    const created = await request(app)
      .post(PROPERTIES)
      .set(bearer(token))
      .send({
        title: "Admin Draft Villa",
        slug,
        propertyType: "VILLA",
        price: 1500000,
        city: "Riyadh",
        district: "Al Nakheel",
        status: "DRAFT",
      })
      .expect(201)

    const res = await request(app)
      .get(`${ADMIN}/properties?status=DRAFT&search=Admin%20Draft`)
      .set(bearer(token))
      .expect(200)
    expect(res.body.data.some((p) => p.id === created.body.data.id)).toBe(true)
    expect(res.body.data.every((p) => p.status === "DRAFT")).toBe(true)
  })

  it("rejects a malformed status query with 422 INVALID_QUERY", async () => {
    const res = await request(app)
      .get(`${ADMIN}/properties?status=NO_SUCH_STATUS`)
      .set(bearer(token))
      .expect(422)
    expect(res.body.error.code).toBe("INVALID_QUERY")
  })
})

describe("GET /api/v1/admin/agents", () => {
  it("returns agent profiles (without login secrets)", async () => {
    const res = await request(app)
      .get(`${ADMIN}/agents`)
      .set(bearer(token))
      .expect(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    const first = res.body.data[0]
    expect(first).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      role: expect.anything(),
    })
    expect(first.passwordHash).toBeUndefined()
  })
})

describe("PATCH /api/v1/admin/agents/:id", () => {
  it("updates editable profile fields", async () => {
    const list = await request(app)
      .get(`${ADMIN}/agents`)
      .set(bearer(token))
      .expect(200)
    const agent = list.body.data[0]

    const res = await request(app)
      .patch(`${ADMIN}/agents/${agent.id}`)
      .set(bearer(token))
      .send({
        role: "Managing Director",
        experienceYears: 11,
        languages: "Arabic, English",
      })
      .expect(200)
    expect(res.body.data.id).toBe(agent.id)
    expect(res.body.data.role).toBe("Managing Director")
    expect(res.body.data.experienceYears).toBe(11)
    expect(res.body.data.languages).toBe("Arabic, English")
  })

  it("404s for an unknown agent", async () => {
    const res = await request(app)
      .patch(`${ADMIN}/agents/${randomUUID()}`)
      .set(bearer(token))
      .send({ name: "Nobody" })
      .expect(404)
    expect(res.body.error.code).toBe("AGENT_NOT_FOUND")
  })

  it("422s for an empty update body", async () => {
    const list = await request(app)
      .get(`${ADMIN}/agents`)
      .set(bearer(token))
      .expect(200)
    const res = await request(app)
      .patch(`${ADMIN}/agents/${list.body.data[0].id}`)
      .set(bearer(token))
      .send({})
      .expect(422)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
  })
})

describe("GET /api/v1/admin/users", () => {
  it("lists users without password hashes or tokens", async () => {
    const res = await request(app)
      .get(`${ADMIN}/users`)
      .set(bearer(token))
      .expect(200)
    expect(res.body.meta.total).toBeTypeOf("number")
    expect(Array.isArray(res.body.data)).toBe(true)
    for (const user of res.body.data) {
      expect(user.passwordHash).toBeUndefined()
      expect(user.refreshTokens).toBeUndefined()
    }
  })

  it("supports name/email search", async () => {
    const res = await request(app)
      .get(`${ADMIN}/users?search=Demo`)
      .set(bearer(token))
      .expect(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    expect(res.body.data[0].email).toBe("demo@estate.sa")
  })
})

describe("Admin reference catalogs", () => {
  it("GET /admin/amenities returns the amenity catalog", async () => {
    const res = await request(app)
      .get(`${ADMIN}/amenities`)
      .set(bearer(token))
      .expect(200)
    const names = res.body.data.map((a) => a.name)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(names.length).toBeGreaterThanOrEqual(1)
    expect(names).toEqual([...new Set(names)])
  })

  it("GET /admin/neighborhoods returns neighborhood options", async () => {
    const res = await request(app)
      .get(`${ADMIN}/neighborhoods`)
      .set(bearer(token))
      .expect(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    expect(res.body.data[0]).toMatchObject({ id: expect.any(String), name: expect.any(String) })
  })

  it("GET /admin/viewings returns the admin inbox", async () => {
    const res = await request(app)
      .get(`${ADMIN}/viewings`)
      .set(bearer(token))
      .expect(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.meta.total).toBeTypeOf("number")
  })
})