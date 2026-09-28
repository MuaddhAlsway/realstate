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
  uniqueSlug,
} from "./helpers.mjs"

/**
 * Phase 10 — agent → client email on leads.
 *
 * Recipient identity must come from the lead's assigned relationship only:
 * the inbound body carries no address field, a lead is only addressable by
 * its own property's agent (or an admin), and every send lands in both the
 * agent_messages history and the email_deliveries ledger (kind AGENT). A
 * dead transport still records an honest FAILED history row without breaking
 * the API call.
 */

const PROPERTIES = "/api/v1/properties"
const AUTH = "/api/v1/auth"
const AGENT = "/api/v1/agent"

const uniqueEmail = (name) =>
  `agent-email-test-${name}-${randomUUID().slice(0, 8)}@estate.test`
const uniqueName = () => `Agent Email Tester ${randomUUID().slice(0, 6)}`

let admin
let agentA
let agentB
let propertyA

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
    token: login.body.data.accessToken,
  }
}

async function createProperty(token, overrides = {}) {
  const res = await request(app)
    .post(PROPERTIES)
    .set(bearer(token))
    .send({
      title: uniqueName(),
      slug: uniqueSlug("agent-email-test"),
      purpose: "SALE",
      propertyType: "VILLA",
      price: 1_500_000,
      city: "Agent Email Test City",
      district: "Test District",
      bedrooms: 3,
      bathrooms: 3,
      ...overrides,
    })
  expect(res.status).toBe(201)
  return res.body.data
}

async function createInquiry(propertyId, overrides = {}) {
  const res = await request(app)
    .post(`${PROPERTIES}/${propertyId}/inquiries`)
    .send({
      name: uniqueName(),
      email: uniqueEmail("lead"),
      message: "Please email me the property details.",
      ...overrides,
    })
  expect(res.status).toBe(201)
  return res.body.data
}

async function cleanupEmailRows() {
  const db = getTestDb()
  if (!db) return
  const { agentMessages, emailDeliveries } = await import(
    "../src/db/schema/index.js"
  )
  const { like } = await import("drizzle-orm")
  await db
    .delete(agentMessages)
    .where(like(agentMessages.recipientEmail, "agent-email-test-%"))
  await db
    .delete(emailDeliveries)
    .where(like(emailDeliveries.recipientEmail, "agent-email-test-%"))
}

beforeAll(async () => {
  admin = await adminToken()
  agentA = await createAgentFixture(uniqueEmail("agent-a"))
  agentB = await createAgentFixture(uniqueEmail("agent-b"))
  propertyA = await createProperty(admin, { agentId: agentA.id })
  await cleanupEmailRows()
})

afterAll(async () => {
  await cleanupEmailRows()
  await cleanDatabase("agent-email-test-")
  await cleanAuthUsers("agent-email-test-")
})

describe("POST /api/v1/agent/inquiries/:id/email", () => {
  let lead
  const messageBody = {
    subject: "Property details",
    body: "Here is the brochure.",
  }

  beforeAll(async () => {
    lead = await createInquiry(propertyA.id)
  })

  it("emails the lead's own customer address from the assigned agent", async () => {
    const res = await request(app)
      .post(`${AGENT}/inquiries/${lead.id}/email`)
      .set(bearer(agentA.token))
      .send(messageBody)
      .expect(201)

    expect(res.body.data.recipientEmail).toBe(lead.customerEmail)
    expect(res.body.data.subject).toBe("Property details")
    expect(res.body.data.body).toBe(messageBody.body)
    expect(res.body.data.leadId).toBe(lead.id)
    expect(res.body.data.status).toBe("SENT")
  })

  it("persists a history row and a delivery ledger row (kind AGENT)", async () => {
    const db = getTestDb()
    const { agentMessages, emailDeliveries } = await import(
      "../src/db/schema/index.js"
    )
    const { eq } = await import("drizzle-orm")
    const history = await db
      .select()
      .from(agentMessages)
      .where(eq(agentMessages.inquiryId, lead.id))
    expect(history.length).toBe(1)
    expect(history[0].recipientEmail).toBe(lead.customerEmail.toLowerCase())
    expect(history[0].status).toBe("SENT")

    const ledger = await db
      .select()
      .from(emailDeliveries)
      .where(
        eq(emailDeliveries.recipientEmail, lead.customerEmail.toLowerCase()),
      )
    expect(ledger.some((l) => l.kind === "AGENT" && l.status === "SENT")).toBe(
      true,
    )
  })

  it("cannot forge a recipient — the body carries no address field", async () => {
    const res = await request(app)
      .post(`${AGENT}/inquiries/${lead.id}/email`)
      .set(bearer(agentA.token))
      .send({ ...messageBody, recipientEmail: "evil@example.com" })
    expect(res.status).toBe(422)
  })

  it("rejects empty messages", async () => {
    const res = await request(app)
      .post(`${AGENT}/inquiries/${lead.id}/email`)
      .set(bearer(agentA.token))
      .send({ subject: "   ", body: "   " })
    expect(res.status).toBe(422)
  })

  it("rejects cross-agent sends (scoping)", async () => {
    const res = await request(app)
      .post(`${AGENT}/inquiries/${lead.id}/email`)
      .set(bearer(agentB.token))
      .send(messageBody)
    expect(res.status).toBe(403)
  })

  it("gives admins access to any lead", async () => {
    const res = await request(app)
      .post(`${AGENT}/inquiries/${lead.id}/email`)
      .set(bearer(admin))
      .send({ subject: "Admin follow-up", body: "Our team will be in touch." })
      .expect(201)
    expect(res.body.data.status).toBe("SENT")
  })

  it("rejects unknown leads with 404", async () => {
    const res = await request(app)
      .post(`${AGENT}/inquiries/00000000-0000-0000-0000-000000000000/email`)
      .set(bearer(agentA.token))
      .send(messageBody)
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe("INQUIRY_NOT_FOUND")
  })

  it("is unreachable for plain USER accounts", async () => {
    const member = await request(app)
      .post(`${AUTH}/register`)
      .send({
        name: "Plain Member",
        email: uniqueEmail("member"),
        password: "MemberPass-123",
      })
      .expect(201)
    const res = await request(app)
      .post(`${AGENT}/inquiries/${lead.id}/email`)
      .set(bearer(member.body.data.accessToken))
      .send(messageBody)
    expect(res.status).toBe(403)
  })
})

describe("GET /api/v1/agent/inquiries/:id/emails (history)", () => {
  let lead

  beforeAll(async () => {
    lead = await createInquiry(propertyA.id)
    await request(app)
      .post(`${AGENT}/inquiries/${lead.id}/email`)
      .set(bearer(agentA.token))
      .send({ subject: "First", body: "One" })
      .expect(201)
    await request(app)
      .post(`${AGENT}/inquiries/${lead.id}/email`)
      .set(bearer(agentA.token))
      .send({ subject: "Second", body: "Two" })
      .expect(201)
  })

  it("lists the lead's email history newest-first for the owning agent", async () => {
    const res = await request(app)
      .get(`${AGENT}/inquiries/${lead.id}/emails`)
      .set(bearer(agentA.token))
      .expect(200)
    expect(res.body.data.map((e) => e.subject)).toEqual(["Second", "First"])
  })

  it("hides history from other agents", async () => {
    const res = await request(app)
      .get(`${AGENT}/inquiries/${lead.id}/emails`)
      .set(bearer(agentB.token))
    expect(res.status).toBe(403)
  })
})

describe("Transport outage on agent email", () => {
  it("records a FAILED history row and still responds 201", async () => {
    const { setTransportOverride } = await import(
      "../src/services/email/transports.js"
    )
    setTransportOverride(async () => {
      throw new Error("relay down")
    })
    try {
      const lead = await createInquiry(propertyA.id)
      const res = await request(app)
        .post(`${AGENT}/inquiries/${lead.id}/email`)
        .set(bearer(agentA.token))
        .send({ subject: "Doomed", body: "Will not arrive" })
        .expect(201)
      expect(res.body.data.status).toBe("FAILED")
      expect(res.body.data.errorMessage).toContain("relay down")

      const db = getTestDb()
      const { agentMessages } = await import("../src/db/schema/index.js")
      const { eq } = await import("drizzle-orm")
      const rows = await db
        .select()
        .from(agentMessages)
        .where(eq(agentMessages.inquiryId, lead.id))
      expect(rows[0].status).toBe("FAILED")
    } finally {
      setTransportOverride(null)
    }
  })
})
