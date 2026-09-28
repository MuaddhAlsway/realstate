import nodemailer from "nodemailer"
import {
  EMAIL_PROVIDER,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_SECURE,
  SMTP_FROM_EMAIL,
  SMTP_FROM_NAME,
} from "../../config/env.js"

/**
 * Email transports (Phase 10) — one function per provider, each resolving to
 * `{ messageId: string|null }` or throwing.
 *
 * `log` (default): prints a printable receipt to stdout and resolves. This is
 * the transport used in development and under test — the API pipeline
 * (delivery ledger, failure recording, unsubscribe flows) stays fully
 * exercisable without touching the network.
 *
 * `smtp`: Nodemailer against the configured relay (STARTTLS on 587 or implicit
 * TLS on 465 via SMTP_SECURE). It sends a proper `From:` with the configured
 * display name and resolves with Nodemailer's `messageId`. Certificate
 * verification stays on by default.
 *
 * Tests can force a specific transport (e.g. one that always rejects) with
 * `setTransportOverride`.
 */

let override = null

export function setTransportOverride(transport) {
  override = transport
}

export function getTransport() {
  if (override) return override
  if (EMAIL_PROVIDER === "smtp") return smtpTransport
  return logTransport
}

/** Log transport — prints a receipt for ops/tests, never leaves the box. */
export async function logTransport(payload) {
  const { to, subject } = payload
  // eslint-disable-next-line no-console
  console.log(
    `[email:log] To=${to} Subject="${subject}" (no delivery in dev/test)`,
  )
  return { messageId: null }
}

/**
 * One lazily-created, cached Nodemailer transporter for the configured relay.
 * External mutable transports make the pipeline hard to test, so the cache is
 * module-local and the override hook keeps tests deterministic.
 */
let transporter = null

function getTransporter() {
  if (transporter) return transporter
  if (!SMTP_HOST) throw new Error("smtpTransport requires SMTP_HOST")
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    ...(SMTP_USER && SMTP_PASS
      ? { auth: { user: SMTP_USER, pass: SMTP_PASS } }
      : {}),
  })
  return transporter
}

/** Nodemailer SMTP transport — resolves `{ messageId }` or throws. */
export async function smtpTransport(payload) {
  const { to, subject, html, text } = payload
  const fromName = SMTP_FROM_NAME || "Estate"
  const fromEmail = SMTP_FROM_EMAIL || "no-reply@localhost"
  const info = await getTransporter().sendMail({
    from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
    to,
    subject,
    html: html ?? undefined,
    text: text ?? undefined,
  })
  return { messageId: info?.messageId ?? null }
}
