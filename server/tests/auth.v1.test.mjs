import { afterAll, beforeAll, describe, expect, it } from "vitest"
import request from "supertest"
import { randomUUID } from "node:crypto"
import {
  app,
  cleanAuthUsers,
  uniqueSlug,
  getTestDb,
  adminToken,
  bearer,
} from "./helpers.mjs"

/**
 * Phase 05 — /api/v1/auth: registration, login, refresh-token rotation with
 * reuse detection, logout, /me, and the role gate on property mutations.
 *
 * Runs against the isolated estate_test database only. All rows created are
 * scoped to the `auth-test-` email family; nothing seeded or owned by the
 * Phase 03/04 suites is touched.
 */

const AUTH = "/api/v1/auth"
const PROPERTIES = "/api/v1/properties"

const uniqueEmail = (name) =>
  `auth-test-${name}-${randomUUID().slice(0, 8)}@estate.test`

const validRegistration = (email) => ({
  name: "Auth Test User",
  email,
  password: "AuthTest-123",
})

/** Bypass the API for one fixture: an AGENT account (register only makes USERs). */
async function createAgent(email) {
  const db = getTestDb()
  const { users, agents } = await import("../src/db/schema/index.js")
  const { hashPassword } = await import("../src/auth/password.js")
  const password = "AgentPass-123"
  const inserted = await db
    .insert(users)
    .values({
      name: "Auth Test Agent",
      email,
      passwordHash: await hashPassword(password),
      role: "AGENT",
    })
    .returning({ id: users.id })
  await db
    .insert(agents)
    .values({
      userId: inserted[0].id,
      name: "Auth Test Agent",
      email: email.toLowerCase(),
      role: "AGENT",
    })
    .onConflictDoNothing()
  return { id: inserted[0].id, email, password }
}

const propertyPayload = (slug) => ({
  title: "Auth Test Villa",
  slug,
  propertyType: "VILLA",
  price: 1800000,
  city: "Riyadh",
  district: "Al Olaya",
  bedrooms: 4,
  bathrooms: 4,
  description: "Created by the Phase 05 auth suite.",
})

let agent
let agentSlug

beforeAll(async () => {
  agent = await createAgent(uniqueEmail("agent"))
  agentSlug = uniqueSlug("auth-test")
})

afterAll(async () => {
  const { properties } = await import("../src/db/schema/index.js")
  const { like } = await import("drizzle-orm")
  const db = getTestDb()
  await db.delete(properties).where(like(properties.slug, "auth-test-%"))
  await cleanAuthUsers()
})

describe("register", () => {
  it("201: creates a USER account and returns tokens", async () => {
    const email = uniqueEmail("register")
    const res = await request(app)
      .post(`${AUTH}/register`)
      .send(validRegistration(email))
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.user).toMatchObject({
      email,
      name: "Auth Test User",
      role: "USER",
    })
    expect(res.body.data.user).not.toHaveProperty("passwordHash")
    expect(typeof res.body.data.accessToken).toBe("string")
    expect(res.body.data.accessToken.split(".")).toHaveLength(3)
    expect(typeof res.body.data.refreshToken).toBe("string")
  })

  it("409 EMAIL_CONFLICT: duplicate email", async () => {
    const email = uniqueEmail("dup")
    const first = await request(app)
      .post(`${AUTH}/register`)
      .send(validRegistration(email))
    expect(first.status).toBe(201)

    const second = await request(app)
      .post(`${AUTH}/register`)
      .send(validRegistration(email))
    expect(second.status).toBe(409)
    expect(second.body).toMatchObject({
      success: false,
      error: { code: "EMAIL_CONFLICT" },
    })
  })

  it("422 VALIDATION_ERROR: weak password", async () => {
    const res = await request(app)
      .post(`${AUTH}/register`)
      .send({ name: "Weak", email: uniqueEmail("weak"), password: "short" })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
  })

  it("422 VALIDATION_ERROR: stray role is rejected (strict schema)", async () => {
    const res = await request(app)
      .post(`${AUTH}/register`)
      .send({ ...validRegistration(uniqueEmail("role")), role: "AGENT" })
    expect(res.status).toBe(422)
  })

  it("422 VALIDATION_ERROR: malformed email / missing name", async () => {
    const badEmail = await request(app)
      .post(`${AUTH}/register`)
      .send({ name: "X", email: "not-an-email", password: "AuthTest-123" })
    expect(badEmail.status).toBe(422)

    const noName = await request(app)
      .post(`${AUTH}/register`)
      .send({ email: uniqueEmail("noname"), password: "AuthTest-123" })
    expect(noName.status).toBe(422)
  })
})

describe("login", () => {
  it("200: issues tokens for correct credentials", async () => {
    const email = uniqueEmail("login")
    await request(app).post(`${AUTH}/register`).send(validRegistration(email))
    const res = await request(app)
      .post(`${AUTH}/login`)
      .send({ email, password: "AuthTest-123" })
    expect(res.status).toBe(200)
    expect(res.body.data.user).toMatchObject({ email, role: "USER" })
    expect(typeof res.body.data.accessToken).toBe("string")
    expect(typeof res.body.data.refreshToken).toBe("string")
  })

  it("401 UNAUTHORIZED: wrong password", async () => {
    const email = uniqueEmail("wrongpw")
    await request(app).post(`${AUTH}/register`).send(validRegistration(email))
    const res = await request(app)
      .post(`${AUTH}/login`)
      .send({ email, password: "WrongPass-999" })
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe("UNAUTHORIZED")
  })

  it("401 UNAUTHORIZED: unknown email", async () => {
    const res = await request(app)
      .post(`${AUTH}/login`)
      .send({ email: uniqueEmail("missing"), password: "AuthTest-123" })
    expect(res.status).toBe(401)
  })

  it("422: invalid login payload", async () => {
    const res = await request(app)
      .post(`${AUTH}/login`)
      .send({ email: "x@y.com" })
    expect(res.status).toBe(422)
  })
})

describe("refresh rotation", () => {
  it("200: rotates the refresh token into a new family member", async () => {
    const email = uniqueEmail("rotate")
    await request(app).post(`${AUTH}/register`).send(validRegistration(email))
    const login = await request(app)
      .post(`${AUTH}/login`)
      .send({ email, password: "AuthTest-123" })
    const first = login.body.data.refreshToken

    const res = await request(app)
      .post(`${AUTH}/refresh`)
      .send({ refreshToken: first })
    expect(res.status).toBe(200)
    expect(res.body.data.refreshToken).not.toBe(first)
    expect(typeof res.body.data.accessToken).toBe("string")
  })

  it("401 + family revocation: presenting a rotated token is reuse", async () => {
    const email = uniqueEmail("rotate")
    await request(app).post(`${AUTH}/register`).send(validRegistration(email))
    const login = await request(app)
      .post(`${AUTH}/login`)
      .send({ email, password: "AuthTest-123" })
    expect(login.status).toBe(200)
    const rotated = login.body.data.refreshToken

    // Consume it — this mints the replacement.
    const rotate = await request(app)
      .post(`${AUTH}/refresh`)
      .send({ refreshToken: rotated })
    expect(rotate.status).toBe(200)
    const replacement = rotate.body.data.refreshToken

    // Replay the OLD token → reuse → family revoked.
    const reuse = await request(app)
      .post(`${AUTH}/refresh`)
      .send({ refreshToken: rotated })
    expect(reuse.status).toBe(401)
    expect(reuse.body.error.code).toBe("UNAUTHORIZED")

    // Even the legitimate replacement is now dead (whole family revoked).
    const after = await request(app)
      .post(`${AUTH}/refresh`)
      .send({ refreshToken: replacement })
    expect(after.status).toBe(401)
  })

  it("401: unknown / garbage refresh token", async () => {
    const res = await request(app)
      .post(`${AUTH}/refresh`)
      .send({ refreshToken: "garbage-token-value" })
    expect(res.status).toBe(401)
  })

  it("422: missing refreshToken", async () => {
    const res = await request(app).post(`${AUTH}/refresh`).send({})
    expect(res.status).toBe(422)
  })
})

describe("logout", () => {
  it("204: revokes the whole family", async () => {
    const email = uniqueEmail("logout")
    await request(app).post(`${AUTH}/register`).send(validRegistration(email))
    const login = await request(app)
      .post(`${AUTH}/login`)
      .send({ email, password: "AuthTest-123" })
    const token = login.body.data.refreshToken

    const out = await request(app)
      .post(`${AUTH}/logout`)
      .send({ refreshToken: token })
    expect(out.status).toBe(204)

    const after = await request(app)
      .post(`${AUTH}/refresh`)
      .send({ refreshToken: token })
    expect(after.status).toBe(401)
  })
})

describe("me", () => {
  it("200: returns the session user", async () => {
    const email = uniqueEmail("me")
    const registered = await request(app)
      .post(`${AUTH}/register`)
      .send(validRegistration(email))
    const token = registered.body.data.accessToken

    const res = await request(app).get(`${AUTH}/me`).set(bearer(token))
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ email, role: "USER" })
    expect(res.body.data.agent).toBeNull()
  })

  it("401: no / invalid token", async () => {
    const none = await request(app).get(`${AUTH}/me`)
    expect(none.status).toBe(401)

    const garbage = await request(app)
      .get(`${AUTH}/me`)
      .set(bearer("not.a.jwt"))
    expect(garbage.status).toBe(401)
  })
})

describe("property mutation role gate", () => {
  it("401: mutation without a token", async () => {
    const res = await request(app)
      .post(PROPERTIES)
      .send(propertyPayload(agentSlug))
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe("UNAUTHORIZED")
  })

  it("403 FORBIDDEN: USER cannot create", async () => {
    const email = uniqueEmail("user403")
    const res = await request(app)
      .post(`${AUTH}/register`)
      .send(validRegistration(email))
    const userToken = res.body.data.accessToken
    const denied = await request(app)
      .post(PROPERTIES)
      .set(bearer(userToken))
      .send(propertyPayload(agentSlug))
    expect(denied.status).toBe(403)
    expect(denied.body.error.code).toBe("FORBIDDEN")
  })

  it("201: ADMIN demo account is allowed", async () => {
    const token = await adminToken()
    const res = await request(app)
      .post(PROPERTIES)
      .set(bearer(token))
      .send(propertyPayload(agentSlug))
    expect(res.status).toBe(201)
  })

  it("201: AGENT can create", async () => {
    const login = await request(app)
      .post(`${AUTH}/login`)
      .send({ email: agent.email, password: agent.password })
    expect(login.status).toBe(200)
    const agentToken = login.body.data.accessToken

    const res = await request(app)
      .post(PROPERTIES)
      .set(bearer(agentToken))
      .send(propertyPayload(uniqueSlug("auth-test")))
    expect(res.status).toBe(201)
    expect(res.body.data.slug).toMatch(/^auth-test-/)
  })

  it("GET stays public without a token", async () => {
    const res = await request(app).get(`${PROPERTIES}?limit=5`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})
