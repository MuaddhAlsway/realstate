import { desc, eq } from "drizzle-orm"
import { getDb } from "../db/index.js"
import * as schema from "../db/schema/index.js"
import { HttpError } from "../errors/index.js"
import { ErrorCodes } from "../errors/error-codes.js"
import { translateDatabaseError } from "../errors/pg.js"
import { resolveMyAgentId } from "./inquiryService.js"
import { sendEmail } from "./email/index.js"
import { renderAgentMessage } from "./email/templates.js"

/**
 * Agent → client email service (Phase 10).
 *
 * Recipient identity is ALWAYS the lead's own `customerEmail` — never a value
 * supplied by the client (the inbound schema carries no address field) — and
 * the action is scoped the same way as the rest of the agent portal: an AGENT
 * may only email leads assigned to their own profile (403 otherwise), ADMIN
 * sees everything. Every send is recorded twice for honest reporting: the
 * `agent_messages` history row (per lead) and an `email_deliveries` ledger row
 * (kind AGENT) with the transport outcome.
 */

const { inquiries, agentMessages } = schema

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

function findInquiryForEmail(db, inquiryId) {
  return run(() =>
    db.query.inquiries.findFirst({
      where: eq(inquiries.id, inquiryId),
      columns: {
        id: true,
        agentId: true,
        customerName: true,
        customerEmail: true,
        propertyId: true,
      },
      with: {
        agent: { columns: { id: true, name: true } },
        property: { columns: { id: true, title: true } },
      },
    }),
  )
}

async function assertAgentAccess(db, inquiry, userId, role) {
  if (!inquiry)
    throw new HttpError("This inquiry does not exist", 404, ErrorCodes.INQUIRY_NOT_FOUND)
  if (role === "ADMIN") return inquiry
  if (role === "AGENT") {
    const myAgentId = await resolveMyAgentId(db, userId)
    if (!myAgentId)
      throw new HttpError("Your account has no agent profile", 403, ErrorCodes.FORBIDDEN)
    if (inquiry.agentId === myAgentId) return inquiry
  }
  throw new HttpError(
    "You are not authorized to email this lead",
    403,
    ErrorCodes.FORBIDDEN,
  )
}

/** Scope a lead down to the caller's inbox (mirrors conversationFor). */
export async function sendAgentMessage({ inquiryId, userId, role, input, baseUrl }) {
  const db = requireDb()
  const inquiry = await findInquiryForEmail(db, inquiryId)
  await assertAgentAccess(db, inquiry, userId, role)

  const recipient = inquiry.customerEmail
  if (!recipient) {
    throw new HttpError(
      "This lead has no contact email to send to",
      422,
      ErrorCodes.VALIDATION_ERROR,
    )
  }

  const agentName = inquiry.agent?.name ?? "Estate Agent"
  const siteUrl = baseUrl ?? ""
  const { subject, html, text } = renderAgentMessage({
    subject: input.subject,
    agentName,
    body: input.body,
    baseUrl: siteUrl,
    siteUrl,
  })

  const [saved] = await run(() =>
    db
      .insert(agentMessages)
      .values({
        agentId: inquiry.agentId,
        inquiryId: inquiry.id,
        recipientEmail: recipient,
        subject,
        body: input.body,
        status: "QUEUED",
      })
      .returning({ id: agentMessages.id }),
  )

  const result = await sendEmail({ to: recipient, subject, html, text, kind: "AGENT" })

  await run(() =>
    db
      .update(agentMessages)
      .set({
        status: result.status,
        providerMessageId: result.providerMessageId,
        errorMessage: result.errorMessage,
        sentAt: result.status === "SENT" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(agentMessages.id, saved.id)),
  )

  return findAgentEmailById(db, saved.id)
}

function findAgentEmailById(db, id) {
  return run(() =>
    db.query.agentMessages.findFirst({ where: eq(agentMessages.id, id) }),
  )
}

/** Email history for one lead, newest first (scoped to the caller's inbox). */
export async function listAgentEmails({ inquiryId, userId, role }) {
  const db = requireDb()
  const inquiry = await findInquiryForEmail(db, inquiryId)
  await assertAgentAccess(db, inquiry, userId, role)

  return run(() =>
    db.query.agentMessages.findMany({
      where: eq(agentMessages.inquiryId, inquiryId),
      orderBy: desc(agentMessages.createdAt),
    }),
  )
}