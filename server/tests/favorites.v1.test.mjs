import { afterAll, beforeAll, describe, expect, it } from "vitest"
import request from "supertest"
import { randomUUID } from "node:crypto"
import { app, cleanAuthUsers, getTestDb, bearer } from "./helpers.mjs"

/**
 * Phase 06 — /api/v1/favorites: the signed-in user's saved properties.
 *
 * Runs against the isolated estate_test database only. Favorites live on a
 * throwaway account (`fav-test-*` email family). The suite provisions its own
 * agent (seeded directly, like the viewings suite) and two `fav-test-*`
 * properties so saved rows never alias fixtures that concurrent suites create
 * or delete. Cleanup deletes the properties (favorites cascade) plus the
 * `fav-test-*` accounts.
 */

const AUTH = "/api/v1/auth"
const URL = "/api/v1/favorites"
const PROPERTIES = "/api/v1/properties"

const uniqueEmail = (tag = "") =>
  `fav-test-${tag}${randomUUID().slice(0, 8)}@estate.test`

let token
let seededPropertyIds = []

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function createAgent(email) {
  const db = getTestDb()
  const { users, agents } = await import("../src/db/schema/index.js")
  const { hashPassword } = await import("../src/auth/password.js")
  const password = "AgentPass-123"
  const inserted = await db
    .insert(users)
    .values({
      name: "Favorites Test Agent",
      email,
      passwordHash: await hashPassword(password),
      role: "AGENT",
    })
    .returning({ id: users.id })
  await db
    .insert(agents)
    .values({
      userId: inserted[0].id,
      name: "Favorites Test Agent",
      email: email.toLowerCase(),
      role: "AGENT",
    })
    .onConflictDoNothing()
  return { id: inserted[0].id, email, password }
}

beforeAll(async () => {
  const res = await request(app).post(`${AUTH}/register`).send({
    name: "Fav Test User",
    email: uniqueEmail(),
    password: "FavTest-123",
  })
  expect(res.status).toBe(201)
  token = res.body.data.accessToken

  // Own throwaway listing so no concurrent suite can remove it mid-run.
  const agent = await createAgent(uniqueEmail("agent"))
  const aLogin = await request(app)
    .post(`${AUTH}/login`)
    .send({ email: agent.email, password: agent.password })
  expect(aLogin.status).toBe(200)
  const aToken = aLogin.body.data.accessToken

  const db = getTestDb()
  const { users } = await import("../src/db/schema/index.js")
  const { eq } = await import("drizzle-orm")
  const agentLink = await db.query.users.findFirst({
    where: eq(users.id, agent.id),
    columns: { id: true },
    with: { agent: { columns: { id: true } } },
  })

  for (let i = 0; i < 2; i++) {
    const created = await request(app)
      .post(PROPERTIES)
      .set(bearer(aToken))
      .send({
        title: `Favorites Test Villa ${i}`,
        slug: `fav-test-${randomUUID().slice(0, 8)}`,
        propertyType: "VILLA",
        price: 2400000,
        city: "Jeddah",
        district: "Al Shati",
        bedrooms: 5,
        bathrooms: 4,
        description: "Created by the favorites suite.",
        agentId: agentLink.agent.id,
      })
    expect(created.status).toBe(201)
    seededPropertyIds.push(created.body.data.id)
  }

  // Guarantee distinct savedAt timestamps when the ordering test saves later.
  await sleep(20)
})

afterAll(async () => {
  const { properties } = await import("../src/db/schema/index.js")
  const { like } = await import("drizzle-orm")
  const db = getTestDb()
  await db.delete(properties).where(like(properties.slug, "fav-test-%"))
  await cleanAuthUsers("fav-test-")
})

describe("auth guard", () => {
  it("401s every route without a token", async () => {
    const anonGet = await request(app).get(URL)
    expect(anonGet.status).toBe(401)

    const anonPut = await request(app).put(`${URL}/${randomUUID()}`)
    expect(anonPut.status).toBe(401)

    const anonDelete = await request(app).delete(`${URL}/${randomUUID()}`)
    expect(anonDelete.status).toBe(401)
  })
})

describe("list", () => {
  it("returns an empty saved list with metadata for a fresh user", async () => {
    const res = await request(app).get(URL).set(bearer(token))
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toEqual([])
    expect(res.body.meta).toMatchObject({ total: 0, totalPages: 0 })
  })

  it("paginates like the catalog", async () => {
    const res = await request(app)
      .get(`${URL}?limit=1&page=2`)
      .set(bearer(token))
    expect(res.status).toBe(200)
    expect(res.body.meta).toMatchObject({ page: 2, limit: 1 })
  })

  it("422 INVALID_QUERY: unknown or malformed query keys", async () => {
    const res = await request(app).get(`${URL}?type=VILLA`).set(bearer(token))
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe("INVALID_QUERY")
  })
})

describe("add", () => {
  it("200: saves a property and reports savedAt", async () => {
    const res = await request(app)
      .put(`${URL}/${seededPropertyIds[0]}`)
      .set(bearer(token))
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      propertyId: seededPropertyIds[0],
      isFavorite: true,
    })
    expect(typeof res.body.data.savedAt).toBe("string")
  })

  it("200 (idempotent): saving the same property twice keeps one row", async () => {
    const once = await request(app)
      .put(`${URL}/${seededPropertyIds[0]}`)
      .set(bearer(token))
    const twice = await request(app)
      .put(`${URL}/${seededPropertyIds[0]}`)
      .set(bearer(token))
    expect(once.status).toBe(200)
    expect(twice.status).toBe(200)

    const list = await request(app).get(URL).set(bearer(token))
    const matches = list.body.data.filter(
      (item) => item.id === seededPropertyIds[0],
    )
    expect(matches).toHaveLength(1)
    expect(list.body.meta.total).toBe(1)
  })

  it("404 PROPERTY_NOT_FOUND for an unknown property", async () => {
    const res = await request(app)
      .put(`${URL}/${randomUUID()}`)
      .set(bearer(token))
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe("PROPERTY_NOT_FOUND")
  })

  it("422 for a malformed propertyId", async () => {
    const res = await request(app).put(`${URL}/not-a-uuid`).set(bearer(token))
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
  })
})

describe("saved list contents + ordering", () => {
  it("lists saved items as property summaries with savedAt, newest first", async () => {
    await sleep(20)
    await request(app).put(`${URL}/${seededPropertyIds[1]}`).set(bearer(token))

    const res = await request(app).get(URL).set(bearer(token))
    expect(res.status).toBe(200)
    expect(res.body.meta.total).toBe(2)

    const [latest, earlier] = res.body.data
    expect(latest.id).toBe(seededPropertyIds[1])
    expect(earlier.id).toBe(seededPropertyIds[0])
    expect(latest).toMatchObject({
      title: expect.any(String),
      slug: expect.any(String),
      price: expect.any(Number),
    })
    expect(typeof latest.savedAt).toBe("string")
    expect(latest.savedAt >= earlier.savedAt).toBe(true)
  })
})

describe("remove", () => {
  it("204 removes a saved property", async () => {
    const res = await request(app)
      .delete(`${URL}/${seededPropertyIds[1]}`)
      .set(bearer(token))
    expect(res.status).toBe(204)

    const list = await request(app).get(URL).set(bearer(token))
    expect(
      list.body.data.some((item) => item.id === seededPropertyIds[1]),
    ).toBe(false)
  })

  it("404 FAVORITE_NOT_FOUND when removing something not saved", async () => {
    const res = await request(app)
      .delete(`${URL}/${seededPropertyIds[1]}`)
      .set(bearer(token))
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe("FAVORITE_NOT_FOUND")
  })

  it("422 for a malformed propertyId", async () => {
    const res = await request(app)
      .delete(`${URL}/not-a-uuid`)
      .set(bearer(token))
    expect(res.status).toBe(422)
  })
})
