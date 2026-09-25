import { afterAll, beforeAll, describe, expect, it } from "vitest"
import request from "supertest"
import { randomUUID } from "node:crypto"
import { app, cleanAuthUsers, getTestDb, bearer } from "./helpers.mjs"

/**
 * Phase 07 — /api/v1/viewings: viewing requests against listings.
 *
 * Runs against the isolated estate_test database only. Fixtures use the
 * `view-test-*` email/prefix family: a USER (U, via register), an AGENT
 * account (A, seeded directly like the auth suite), a third USER (T), an
 * agent-owned test property P, and seed properties S for requester-only rows.
 * Cleanup deletes `view-test-%` properties (requests cascade with the
 * property) plus requests left referencing our users on seed properties.
 */

const AUTH = "/api/v1/auth"
const URL = "/api/v1/viewings"
const PROPERTIES = "/api/v1/properties"

const uniqueEmail = (tag) =>
  `view-test-${tag}-${randomUUID().slice(0, 8)}@estate.test`
const futureDate = (days = 14) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

let uId, uToken
let aId, aToken, aAgentId
let tToken
let pId

const registerUser = async (email) =>
  request(app).post(`${AUTH}/register`).send({
    name: "Viewing Test User",
    email,
    password: "ViewTest-123",
  })

async function createAgent(email) {
  const db = getTestDb()
  const { users, agents } = await import("../src/db/schema/index.js")
  const { hashPassword } = await import("../src/auth/password.js")
  const password = "AgentPass-123"
  const inserted = await db
    .insert(users)
    .values({
      name: "Viewing Test Agent",
      email,
      passwordHash: await hashPassword(password),
      role: "AGENT",
    })
    .returning({ id: users.id })
  await db
    .insert(agents)
    .values({
      userId: inserted[0].id,
      name: "Viewing Test Agent",
      email: email.toLowerCase(),
      role: "AGENT",
    })
    .onConflictDoNothing()
  return { id: inserted[0].id, email, password }
}

const propertyPayload = (slug) => ({
  title: "Viewing Test Villa",
  slug,
  propertyType: "VILLA",
  price: 2400000,
  city: "Riyadh",
  district: "Al Olaya",
  bedrooms: 5,
  bathrooms: 4,
  description: "Created by the Phase 07 viewing suite.",
})

beforeAll(async () => {
  const u = await registerUser(uniqueEmail("user"))
  expect(u.status).toBe(201)
  uId = u.body.data.user.id
  uToken = u.body.data.accessToken

  const agent = await createAgent(uniqueEmail("agent"))
  aId = agent.id
  const aLogin = await request(app)
    .post(`${AUTH}/login`)
    .send({ email: agent.email, password: agent.password })
  expect(aLogin.status).toBe(200)
  aToken = aLogin.body.data.accessToken

  const t = await registerUser(uniqueEmail("third"))
  expect(t.status).toBe(201)
  tToken = t.body.data.accessToken

  // Resolve the agent profile id, then create the listing owned by that
  // agent (create accepts the documented `agentId` reference) so requests on
  // it land in the agent's inbox.
  const db = getTestDb()
  const { users } = await import("../src/db/schema/index.js")
  const { eq } = await import("drizzle-orm")
  const agentLink = await db.query.users.findFirst({
    where: eq(users.id, aId),
    columns: { id: true },
    with: { agent: { columns: { id: true } } },
  })
  aAgentId = agentLink.agent.id

  const created = await request(app)
    .post(PROPERTIES)
    .set(bearer(aToken))
    .send({
      ...propertyPayload(`view-test-${randomUUID().slice(0, 8)}`),
      agentId: aAgentId,
    })
  expect(created.status).toBe(201)
  pId = created.body.data.id
})

afterAll(async () => {
  const db = getTestDb()
  const { properties, viewingRequests } = await import(
    "../src/db/schema/index.js"
  )
  const { like, eq, inArray } = await import("drizzle-orm")
  const userIds = [uId, aId].filter(Boolean)
  if (userIds.length)
    await db
      .delete(viewingRequests)
      .where(inArray(viewingRequests.userId, userIds))
  if (aAgentId)
    await db
      .delete(viewingRequests)
      .where(eq(viewingRequests.agentId, aAgentId))
  await db.delete(properties).where(like(properties.slug, "view-test-%"))
  await cleanAuthUsers("view-test-")
})

describe("auth guard", () => {
  it("401s every route without a token", async () => {
    expect((await request(app).post(URL).send({})).status).toBe(401)
    expect((await request(app).get(URL)).status).toBe(401)
    expect(
      (
        await request(app)
          .patch(`${URL}/${randomUUID()}`)
          .send({ status: "CONFIRMED" })
      ).status,
    ).toBe(401)
    expect((await request(app).delete(`${URL}/${randomUUID()}`)).status).toBe(
      401,
    )
  })
})

describe("create", () => {
  it("201: a user requests a viewing and the property's agent is assigned", async () => {
    const res = await request(app).post(URL).set(bearer(uToken)).send({
      propertyId: pId,
      date: futureDate(),
      time: "10:30",
      message: "Morning slot preferred.",
    })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toMatchObject({
      status: "PENDING",
      date: futureDate(),
      time: "10:30",
      message: "Morning slot preferred.",
      property: { id: pId },
      agent: { id: aAgentId },
      requester: { id: uId },
    })
    expect(res.body.data.id).toBeTruthy()
    expect(res.body.data.createdAt).toBeTruthy()
  })

  it("422: invalid property id, date, time or stray fields", async () => {
    const base = { propertyId: pId, date: futureDate() }

    const badUuid = await request(app)
      .post(URL)
      .set(bearer(uToken))
      .send({ ...base, propertyId: "nope" })
    expect(badUuid.status).toBe(422)

    const badDate = await request(app)
      .post(URL)
      .set(bearer(uToken))
      .send({ ...base, date: "2026-02-30" })
    expect(badDate.status).toBe(422)

    const badTime = await request(app)
      .post(URL)
      .set(bearer(uToken))
      .send({ ...base, time: "25:99" })
    expect(badTime.status).toBe(422)

    const stray = await request(app)
      .post(URL)
      .set(bearer(uToken))
      .send({ ...base, status: "CONFIRMED" })
    expect(stray.status).toBe(422)
  })

  it("404: unknown property", async () => {
    const res = await request(app)
      .post(URL)
      .set(bearer(uToken))
      .send({ propertyId: randomUUID(), date: futureDate() })
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe("PROPERTY_NOT_FOUND")
  })
})

describe("list", () => {
  it("a user sees their own requests, not other users'", async () => {
    const mine = await request(app).get(URL).set(bearer(uToken))
    expect(mine.status).toBe(200)
    expect(mine.body.meta).toMatchObject({ total: 1, totalPages: 1 })
    expect(mine.body.data[0]).toMatchObject({
      property: { id: pId },
      requester: { id: uId },
    })

    const third = await request(app).get(URL).set(bearer(tToken))
    expect(third.status).toBe(200)
    expect(third.body.data).toEqual([])
    expect(third.body.meta.total).toBe(0)
  })

  it("an assigned agent sees the request in their inbox", async () => {
    const inbox = await request(app).get(URL).set(bearer(aToken))
    expect(inbox.status).toBe(200)
    const row = inbox.body.data.find(
      (item) => item.property.id === pId && item.requester.id === uId,
    )
    expect(row).toBeTruthy()
    expect(row.agent).toMatchObject({ id: aAgentId })
    expect(row.status).toBe("PENDING")
  })

  it("supports a strict status filter", async () => {
    const pending = await request(app)
      .get(`${URL}?status=PENDING`)
      .set(bearer(uToken))
    expect(pending.status).toBe(200)
    expect(pending.body.data.every((item) => item.status === "PENDING")).toBe(
      true,
    )

    const none = await request(app)
      .get(`${URL}?status=COMPLETED`)
      .set(bearer(uToken))
    expect(none.status).toBe(200)
    expect(none.body.data).toEqual([])

    const bad = await request(app).get(`${URL}?status=DONE`).set(bearer(uToken))
    expect(bad.status).toBe(422)
  })
})

describe("status transitions", () => {
  it("a requester can cancel their own PENDING request", async () => {
    const req = await request(app)
      .post(URL)
      .set(bearer(uToken))
      .send({ propertyId: pId, date: futureDate(3) })
    expect(req.status).toBe(201)
    const id = req.body.data.id

    const cancelled = await request(app)
      .patch(`${URL}/${id}`)
      .set(bearer(uToken))
      .send({ status: "CANCELLED" })
    expect(cancelled.status).toBe(200)
    expect(cancelled.body.data.status).toBe("CANCELLED")

    const again = await request(app)
      .patch(`${URL}/${id}`)
      .set(bearer(uToken))
      .send({ status: "CANCELLED" })
    expect(again.status).toBe(403)
  })

  it("a requester cannot confirm or set PENDING", async () => {
    const req = await request(app)
      .post(URL)
      .set(bearer(uToken))
      .send({ propertyId: pId, date: futureDate(5) })
    expect(req.status).toBe(201)
    const id = req.body.data.id

    const confirm = await request(app)
      .patch(`${URL}/${id}`)
      .set(bearer(uToken))
      .send({ status: "CONFIRMED" })
    expect(confirm.status).toBe(403)

    const toPending = await request(app)
      .patch(`${URL}/${id}`)
      .set(bearer(uToken))
      .send({ status: "PENDING" })
    expect(toPending.status).toBe(403)

    const cancelled = await request(app)
      .patch(`${URL}/${id}`)
      .set(bearer(uToken))
      .send({ status: "CANCELLED" })
    expect(cancelled.status).toBe(200)
  })

  it("the assigned agent can confirm then complete", async () => {
    const req = await request(app)
      .post(URL)
      .set(bearer(uToken))
      .send({ propertyId: pId, date: futureDate(7) })
    const id = req.body.data.id

    const confirmed = await request(app)
      .patch(`${URL}/${id}`)
      .set(bearer(aToken))
      .send({ status: "CONFIRMED" })
    expect(confirmed.status).toBe(200)
    expect(confirmed.body.data.status).toBe("CONFIRMED")

    const completed = await request(app)
      .patch(`${URL}/${id}`)
      .set(bearer(aToken))
      .send({ status: "COMPLETED" })
    expect(completed.status).toBe(200)
    expect(completed.body.data.status).toBe("COMPLETED")
  })

  it("403: an unrelated actor cannot change status", async () => {
    const req = await request(app)
      .post(URL)
      .set(bearer(uToken))
      .send({ propertyId: pId, date: futureDate(9) })
    const id = req.body.data.id
    const res = await request(app)
      .patch(`${URL}/${id}`)
      .set(bearer(tToken))
      .send({ status: "CANCELLED" })
    expect(res.status).toBe(403)
  })

  it("404: unknown id; 422: malformed id, bad status, stray fields", async () => {
    const unknown = await request(app)
      .patch(`${URL}/${randomUUID()}`)
      .set(bearer(uToken))
      .send({ status: "CANCELLED" })
    expect(unknown.status).toBe(404)
    expect(unknown.body.error.code).toBe("VIEWING_NOT_FOUND")

    expect(
      (
        await request(app)
          .patch(`${URL}/not-a-uuid`)
          .set(bearer(uToken))
          .send({ status: "CANCELLED" })
      ).status,
    ).toBe(422)

    expect(
      (
        await request(app)
          .patch(`${URL}/${randomUUID()}`)
          .set(bearer(uToken))
          .send({ status: "NUKED" })
      ).status,
    ).toBe(422)

    expect(
      (
        await request(app)
          .patch(`${URL}/${randomUUID()}`)
          .set(bearer(uToken))
          .send({ status: "CANCELLED", note: "hi" })
      ).status,
    ).toBe(422)
  })
})

describe("delete", () => {
  it("204: the requester can delete their own request; 404 afterwards", async () => {
    const req = await request(app)
      .post(URL)
      .set(bearer(uToken))
      .send({ propertyId: pId, date: futureDate(11) })
    const id = req.body.data.id

    const del = await request(app).delete(`${URL}/${id}`).set(bearer(uToken))
    expect(del.status).toBe(204)

    const again = await request(app).delete(`${URL}/${id}`).set(bearer(uToken))
    expect(again.status).toBe(404)
  })

  it("204: the assigned agent can remove requests in their inbox", async () => {
    const req = await request(app)
      .post(URL)
      .set(bearer(uToken))
      .send({ propertyId: pId, date: futureDate(12) })
    const id = req.body.data.id

    const del = await request(app).delete(`${URL}/${id}`).set(bearer(aToken))
    expect(del.status).toBe(204)
  })

  it("403: an unrelated actor cannot delete", async () => {
    const req = await request(app)
      .post(URL)
      .set(bearer(uToken))
      .send({ propertyId: pId, date: futureDate(13) })
    const id = req.body.data.id
    const res = await request(app).delete(`${URL}/${id}`).set(bearer(tToken))
    expect(res.status).toBe(403)
  })
})
