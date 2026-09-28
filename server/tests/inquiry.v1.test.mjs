import { afterAll, beforeAll, describe, expect, it } from "vitest"
import request from "supertest"
import { randomUUID } from "node:crypto"
import {
  app,
  cleanAuthUsers,
  cleanDatabase,
  uniqueSlug,
  getTestDb,
  adminToken,
  bearer,
} from "./helpers.mjs"

/**
 * Phase 11 — inquiry / deal workflow.
 *
 * Covers the full lifecycle: public inquiry creation (guest + signed-in),
 * role-scoped visibility (agent inbox vs. customer), the status workflow
 * PENDING → IN_PROGRESS → COMPLETED (+ CANCELLED), conversations/messages,
 * notifications, and deal completion flipping properties (SALE → SOLD /
 * RENT → RENTED) so they leave the public catalog.
 *
 * Fixtures are property rows (slug family `inquiry-test-`) and user rows
 * (`inquiry-test-*@estate.test`) in a unique city so public-catalog
 * assertions are deterministic.
 */

const PROPERTIES = "/api/v1/properties"
const AUTH = "/api/v1/auth"
const ADMIN = "/api/v1/admin"
const AGENT = "/api/v1/agent"
const ME = "/api/v1/me"

const TEST_CITY = "Phase 11 Test City"
const uniqueEmail = (name) =>
  `inquiry-test-${name}-${randomUUID().slice(0, 8)}@estate.test`
const uniqueName = () => `Inquiry Tester ${randomUUID().slice(0, 6)}`

const inquiryPayload = (overrides = {}) => ({
  name: uniqueName(),
  email: uniqueEmail("guest"),
  phone: "+966 55 000 0000",
  message: "I would like to know more about this property.",
  preferredContactMethod: "WHATSAPP",
  viewingDate: "2026-10-15",
  viewingTime: "14:30",
  ...overrides,
})

let admin
let agentA
let agentB
let customer
let propertyA // SALE  / assigned to agentA / AVAILABLE
let propertyB // RENT  / assigned to agentB / AVAILABLE
let propertyDraft

async function register(email) {
  const res = await request(app)
    .post(`${AUTH}/register`)
    .send({ name: uniqueName(), email, password: "InquiryTest-123" })
  expect(res.status).toBe(201)
  return { token: res.body.data.accessToken, user: res.body.data.user }
}

async function createAgentFixture(email) {
  const db = getTestDb()
  const { users, agents } = await import("../src/db/schema/index.js")
  const { hashPassword } = await import("../src/auth/password.js")
  const password = "AgentPass-123"
  const inserted = await db
    .insert(users)
    .values({
      name: "Agent Fixture",
      email,
      passwordHash: await hashPassword(password),
      role: "AGENT",
    })
    .returning({ id: users.id })
  const agent = await db
    .insert(agents)
    .values({
      userId: inserted[0].id,
      name: "Agent Fixture",
      email: email.toLowerCase(),
      role: "Agent",
    })
    .returning({ id: agents.id })
  const login = await request(app)
    .post(`${AUTH}/login`)
    .send({ email, password })
  expect(login.status).toBe(200)
  return {
    id: agent[0].id,
    user: inserted[0].id,
    email,
    password,
    token: login.body.data.accessToken,
  }
}

async function createProperty(token, overrides = {}) {
  const res = await request(app)
    .post(PROPERTIES)
    .set(bearer(token))
    .send({
      title: uniqueName(),
      slug: uniqueSlug("inquiry-test"),
      purpose: "SALE",
      propertyType: "VILLA",
      price: 2_500_000,
      city: TEST_CITY,
      district: "Test District",
      bedrooms: 4,
      bathrooms: 4,
      ...overrides,
    })
  expect(res.status).toBe(201)
  return res.body.data
}

beforeAll(async () => {
  admin = await adminToken()
  agentA = await createAgentFixture(uniqueEmail("agent-a"))
  agentB = await createAgentFixture(uniqueEmail("agent-b"))
  const customerAccount = await register(uniqueEmail("customer"))
  customer = customerAccount

  propertyA = await createProperty(admin, {
    purpose: "SALE",
    agentId: agentA.id,
  })
  propertyB = await createProperty(admin, {
    purpose: "RENT",
    agentId: agentB.id,
    price: 45_000,
  })
  propertyDraft = await createProperty(admin, {
    purpose: "SALE",
    status: "DRAFT",
  })
})

afterAll(async () => {
  await cleanDatabase("inquiry-test-")
  await cleanAuthUsers("inquiry-test-")
})

// ── Public inquiry creation ────────────────────────────────────────────

describe("POST /api/v1/properties/:id/inquiries (public)", () => {
  it("rejects inquiries on non-available properties", async () => {
    const draft = await request(app)
      .post(`${PROPERTIES}/${propertyDraft.id}/inquiries`)
      .send(inquiryPayload())
    expect(draft.status).toBe(403)
    expect(draft.body.error.code).toBe("FORBIDDEN")
  })

  it("rejects inquiries on a sold property", async () => {
    await request(app)
      .patch(`${PROPERTIES}/${propertyDraft.id}`)
      .set(bearer(admin))
      .send({ status: "SOLD" })
      .expect(200)
    const sold = await request(app)
      .post(`${PROPERTIES}/${propertyDraft.id}/inquiries`)
      .send(inquiryPayload())
    expect(sold.status).toBe(403)
  })

  it("400/404: unknown property", async () => {
    const res = await request(app)
      .post(`${PROPERTIES}/00000000-0000-0000-0000-000000000000/inquiries`)
      .send(inquiryPayload())
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe("PROPERTY_NOT_FOUND")
  })

  it("422: missing required fields", async () => {
    const res = await request(app)
      .post(`${PROPERTIES}/${propertyA.id}/inquiries`)
      .send({ message: "hi" })
    expect(res.status).toBe(422)
  })

  it("forwards the inquiry to the property's assigned agent + notifies them", async () => {
    const payload = inquiryPayload({ name: "Guest Alpha" })
    const res = await request(app)
      .post(`${PROPERTIES}/${propertyA.id}/inquiries`)
      .send(payload)
    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe("PENDING")
    expect(res.body.data.agent.id).toBe(agentA.id)
    expect(res.body.data.customerName).toBe("Guest Alpha")
    expect(Array.isArray(res.body.data.thread)).toBe(true)
    expect(res.body.data.history.some((h) => h.toStatus === "PENDING")).toBe(
      true,
    )

    const inbox = await request(app)
      .get(`${AGENT}/inquiries`)
      .set(bearer(agentA.token))
      .expect(200)
    expect(inbox.body.data.some((i) => i.id === res.body.data.id)).toBe(true)

    const notifs = await request(app)
      .get(`${AGENT}/notifications`)
      .set(bearer(agentA.token))
      .expect(200)
    expect(
      notifs.body.data.some(
        (n) => n.type === "INQUIRY" && n.title === "New inquiry received",
      ),
    ).toBe(true)
  })

  it("links a signed-in customer's inquiry to their account", async () => {
    const payload = inquiryPayload({ email: customer.user.email })
    const res = await request(app)
      .post(`${PROPERTIES}/${propertyB.id}/inquiries`)
      .set(bearer(customer.token))
      .send(payload)
    expect(res.status).toBe(201)
    expect(res.body.data.customer.id).toBe(customer.user.id)

    const mine = await request(app)
      .get(`${ME}/inquiries`)
      .set(bearer(customer.token))
      .expect(200)
    expect(mine.body.data.some((i) => i.id === res.body.data.id)).toBe(true)
  })
})

// ── Visibility & authorization ─────────────────────────────────────────

describe("Authorization boundaries", () => {
  let customerInquiry
  let agentAInquiry

  beforeAll(async () => {
    const c = await request(app)
      .post(`${PROPERTIES}/${propertyB.id}/inquiries`)
      .set(bearer(customer.token))
      .send(inquiryPayload({ name: "Boundary Customer" }))
    customerInquiry = c.body.data
    const g = await request(app)
      .post(`${PROPERTIES}/${propertyA.id}/inquiries`)
      .send(inquiryPayload({ name: "Boundary Guest" }))
    agentAInquiry = g.body.data
  })

  it("agent sees only their own assigned inquiries", async () => {
    const inbox = await request(app)
      .get(`${AGENT}/inquiries`)
      .set(bearer(agentA.token))
      .expect(200)
    expect(inbox.body.data.some((i) => i.id === agentAInquiry.id)).toBe(true)
    expect(inbox.body.data.some((i) => i.id === customerInquiry.id)).toBe(false)
  })

  it("cross-agent detail/messages access is denied", async () => {
    const detail = await request(app)
      .get(`${AGENT}/inquiries/${agentAInquiry.id}`)
      .set(bearer(agentB.token))
    expect(detail.status).toBe(403)
    const messages = await request(app)
      .get(`${AGENT}/inquiries/${agentAInquiry.id}/messages`)
      .set(bearer(agentB.token))
    expect(messages.status).toBe(403)
  })

  it("cross-agent status updates are denied", async () => {
    const res = await request(app)
      .patch(`${AGENT}/inquiries/${agentAInquiry.id}/status`)
      .set(bearer(agentB.token))
      .send({ toStatus: "IN_PROGRESS" })
    expect(res.status).toBe(403)
  })

  it("a customer cannot act on another customer's inquiry", async () => {
    const other = await register(uniqueEmail("customer-2"))
    const detail = await request(app)
      .get(`${ME}/inquiries/${customerInquiry.id}`)
      .set(bearer(other.token))
    expect(detail.status).toBe(403)
  })

  it("unauthenticated access to the account surface is rejected", async () => {
    expect((await request(app).get(`${ME}/inquiries`)).status).toBe(401)
    expect((await request(app).get(`${AGENT}/inquiries`)).status).toBe(401)
    expect((await request(app).get(`${ME}/notifications`)).status).toBe(401)
  })

  it("agents cannot reach the admin inquiries/deals endpoints", async () => {
    expect(
      (await request(app).get(`${ADMIN}/inquiries`).set(bearer(agentA.token)))
        .status,
    ).toBe(403)
    expect(
      (await request(app).get(`${ADMIN}/deals`).set(bearer(agentA.token)))
        .status,
    ).toBe(403)
  })
})

// ── Status workflow ────────────────────────────────────────────────────

describe("Inquiry status workflow", () => {
  it("agent advances PENDING → IN_PROGRESS", async () => {
    const created = await request(app)
      .post(`${PROPERTIES}/${propertyA.id}/inquiries`)
      .send(inquiryPayload())
    const res = await request(app)
      .patch(`${AGENT}/inquiries/${created.body.data.id}/status`)
      .set(bearer(agentA.token))
      .send({ toStatus: "IN_PROGRESS", note: "Contacted customer" })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe("IN_PROGRESS")
  })

  it("customer can cancel their own PENDING inquiry", async () => {
    const created = await request(app)
      .post(`${PROPERTIES}/${propertyB.id}/inquiries`)
      .set(bearer(customer.token))
      .send(inquiryPayload())
    const res = await request(app)
      .patch(`${ME}/inquiries/${created.body.data.id}/status`)
      .set(bearer(customer.token))
      .send({ toStatus: "CANCELLED" })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe("CANCELLED")
  })

  it("customer cannot advance status beyond cancel", async () => {
    const created = await request(app)
      .post(`${PROPERTIES}/${propertyB.id}/inquiries`)
      .set(bearer(customer.token))
      .send(inquiryPayload())
    const res = await request(app)
      .patch(`${ME}/inquiries/${created.body.data.id}/status`)
      .set(bearer(customer.token))
      .send({ toStatus: "IN_PROGRESS" })
    expect(res.status).toBe(403)
  })

  it("PENDING can never be re-entered", async () => {
    const created = await request(app)
      .post(`${PROPERTIES}/${propertyA.id}/inquiries`)
      .send(inquiryPayload())
    await request(app)
      .patch(`${AGENT}/inquiries/${created.body.data.id}/status`)
      .set(bearer(agentA.token))
      .send({ toStatus: "IN_PROGRESS" })
      .expect(200)
    const res = await request(app)
      .patch(`${AGENT}/inquiries/${created.body.data.id}/status`)
      .set(bearer(agentA.token))
      .send({ toStatus: "PENDING" })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe("INVALID_STATUS_TRANSITION")
  })

  it("invalid transition from a terminal state is rejected", async () => {
    const created = await request(app)
      .post(`${PROPERTIES}/${propertyA.id}/inquiries`)
      .send(inquiryPayload())
    await request(app)
      .patch(`${AGENT}/inquiries/${created.body.data.id}/status`)
      .set(bearer(agentA.token))
      .send({ toStatus: "COMPLETED" })
      .expect(200)
    const res = await request(app)
      .patch(`${AGENT}/inquiries/${created.body.data.id}/status`)
      .set(bearer(agentA.token))
      .send({ toStatus: "IN_PROGRESS" })
    expect(res.status).toBe(409)
  })
})

// ── Conversation / messaging ───────────────────────────────────────────

describe("Inquiry conversation", () => {
  let inquiryId

  beforeAll(async () => {
    const created = await request(app)
      .post(`${PROPERTIES}/${propertyA.id}/inquiries`)
      .set(bearer(customer.token))
      .send(inquiryPayload({ name: "Thread Customer" }))
    inquiryId = created.body.data.id
  })

  it("a customer message is visible to the assigned agent", async () => {
    const sent = await request(app)
      .post(`${ME}/inquiries/${inquiryId}/messages`)
      .set(bearer(customer.token))
      .send({ content: "Is the price negotiable?" })
      .expect(201)
    expect(sent.body.data.senderRole).toBe("CUSTOMER")

    const thread = await request(app)
      .get(`${AGENT}/inquiries/${inquiryId}/messages`)
      .set(bearer(agentA.token))
      .expect(200)
    expect(thread.body.data.some((m) => m.id === sent.body.data.id)).toBe(true)

    const notifs = await request(app)
      .get(`${AGENT}/notifications`)
      .set(bearer(agentA.token))
      .expect(200)
    expect(notifs.body.data.some((n) => n.type === "MESSAGE" && !n.read)).toBe(
      true,
    )
  })

  it("the agent's reply returns to the customer", async () => {
    const reply = await request(app)
      .post(`${AGENT}/inquiries/${inquiryId}/messages`)
      .set(bearer(agentA.token))
      .send({ content: "We can discuss this at the viewing." })
      .expect(201)
    expect(reply.body.data.senderRole).toBe("AGENT")

    const thread = await request(app)
      .get(`${ME}/inquiries/${inquiryId}/messages`)
      .set(bearer(customer.token))
      .expect(200)
    expect(
      thread.body.data.some(
        (m) => m.id === reply.body.data.id && m.senderRole === "AGENT",
      ),
    ).toBe(true)
  })

  it("rejects empty messages", async () => {
    const res = await request(app)
      .post(`${ME}/inquiries/${inquiryId}/messages`)
      .set(bearer(customer.token))
      .send({ content: "   " })
    expect(res.status).toBe(422)
  })

  it("marks notifications read", async () => {
    await request(app)
      .patch(`${AGENT}/notifications/read`)
      .set(bearer(agentA.token))
      .send({ all: true })
      .expect(200)
    const notifs = await request(app)
      .get(`${AGENT}/notifications`)
      .set(bearer(agentA.token))
      .expect(200)
    expect(notifs.body.data.every((n) => n.read)).toBe(true)
  })
})

// ── Deals / property lifecycle ─────────────────────────────────────────

describe("Deal completion", () => {
  it("SALE deal with confirmTransaction flips the property to SOLD and removes it from the public catalog", async () => {
    const created = await request(app)
      .post(`${PROPERTIES}/${propertyA.id}/inquiries`)
      .send(inquiryPayload({ name: "Sale Customer" }))
    expect(created.status).toBe(201)

    const sold = await request(app)
      .patch(`${AGENT}/inquiries/${created.body.data.id}/status`)
      .set(bearer(agentA.token))
      .send({ toStatus: "COMPLETED", confirmTransaction: true })
    expect(sold.status).toBe(200)
    expect(sold.body.data.status).toBe("COMPLETED")
    expect(sold.body.data.completedAt).not.toBeNull()

    const listing = await request(app)
      .get(`${PROPERTIES}?purpose=SALE&city=${encodeURIComponent(TEST_CITY)}`)
      .expect(200)
    expect(listing.body.data.some((p) => p.id === propertyA.id)).toBe(false)
  })

  it("RENT deal (completed by admin) flips the property to RENTED", async () => {
    const created = await request(app)
      .post(`${PROPERTIES}/${propertyB.id}/inquiries`)
      .send(inquiryPayload({ name: "Rent Customer" }))
    expect(created.status).toBe(201)

    const rented = await request(app)
      .patch(`${AGENT}/inquiries/${created.body.data.id}/status`)
      .set(bearer(admin))
      .send({ toStatus: "COMPLETED", confirmTransaction: true })
    expect(rented.status).toBe(200)

    const listing = await request(app)
      .get(`${PROPERTIES}?purpose=RENT&city=${encodeURIComponent(TEST_CITY)}`)
      .expect(200)
    expect(listing.body.data.some((p) => p.id === propertyB.id)).toBe(false)
  })

  it("the closed deals are recorded with their completion metadata", async () => {
    const deals = await request(app)
      .get(`${ADMIN}/deals`)
      .set(bearer(admin))
      .expect(200)
    expect(deals.body.data.length).toBeGreaterThanOrEqual(2)
    for (const deal of deals.body.data) {
      expect(deal.completedAt).toBeTypeOf("string")
      expect(deal.property).toBeTruthy()
      expect(deal.agent).toBeTruthy()
    }
  })

  it("completed deals appear as COMPLETED inquiries to admins", async () => {
    const res = await request(app)
      .get(`${ADMIN}/inquiries?status=COMPLETED`)
      .set(bearer(admin))
      .expect(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(2)
    expect(res.body.data.every((i) => i.status === "COMPLETED")).toBe(true)
  })
})
