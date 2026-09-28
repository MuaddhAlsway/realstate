import { eq } from "drizzle-orm"
import { getDb } from "../../db/index.js"
import * as schema from "../../db/schema/index.js"
import { HttpError } from "../../errors/index.js"
import { ErrorCodes } from "../../errors/error-codes.js"
import { translateDatabaseError } from "../../errors/pg.js"
import { EMAIL_BASE_URL } from "../../config/env.js"
import { getTransport } from "./transports.js"

/**
 * Email delivery facade (Phase 10).
 *
 * The single choke-point for outbound mail. Every call:
 *   1. Persists a QUEUED `email_deliveries` row (the DB is the source of truth),
 *   2. Asks the configured transport to deliver,
 *   3. Records SENT/FAILED with the provider id or the failure reason.
 *
 * It NEVER throws on a transport failure — the caller (newsletter or agent
 * email service) keeps the business action committed and the ledger holds an
 * honest FAILED row. Delivery is thus decoupled from the transport: a relay
 * outage cannot take down subscription or campaign writes.
 */

const { emailDeliveries } = schema

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

/**
 * Base URL for links inside emails. Derived from the API request when
 * available; `EMAIL_BASE_URL` provides a stable outward-facing default.
 */
export function baseUrlFromRequest(req) {
  if (!req) return EMAIL_BASE_URL ?? ""
  if (EMAIL_BASE_URL) return EMAIL_BASE_URL.replace(/\/+$/, "")
  return `${req.protocol}://${req.get("host")}`
}

/**
 * Deliver one email + record the outcome. Resolves with
 * `{ status: "SENT"|"FAILED", providerMessageId, errorMessage }` — does not
 * throw for provider failures.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  kind,
  campaignId = null,
}) {
  const db = requireDb()

  const [queued] = await run(() =>
    db.insert(emailDeliveries)
      .values({
        campaignId,
        kind,
        recipientEmail: to,
        subject,
        status: "QUEUED",
      })
      .returning({ id: emailDeliveries.id }),
  )

  const transport = getTransport()
  let status = "FAILED"
  let providerMessageId = null
  let errorMessage = null

  try {
    const result = await transport({ to, subject, html, text })
    status = "SENT"
    providerMessageId = result?.messageId ?? null
  } catch (err) {
    // Surface the real reason (code + message) so a FAILED delivery row is
    // actually actionable; fall back only when the transport threw nothing.
    const detail = [
      err?.code ? String(err.code) : "",
      String(err?.message ?? err),
    ]
      .filter(Boolean)
      .join(" ")
      .trim()
    errorMessage = (detail || "email transport failed").slice(0, 500)
    console.error(
      `[email] delivery failed to ${to} (subject "${subject}"): ${errorMessage}`,
    )
  }

  await run(() =>
    db.update(emailDeliveries)
      .set({
        status,
        providerMessageId,
        errorMessage,
        sentAt: status === "SENT" ? new Date() : null,
      })
      .where(eq(emailDeliveries.id, queued.id)),
  )

  return run(() =>
    db.query.emailDeliveries.findFirst({
      where: eq(emailDeliveries.id, queued.id),
    }),
  )
}
