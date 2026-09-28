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
  RESEND_API_KEY,
  RESEND_FROM_EMAIL,
  RESEND_FROM_NAME,
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
 * `resend`: HTTPS fallback for hosts that block SMTP egress. One POST to
 * api.resend.com/emails with the API key in the Authorization header; the key
 * is never included in the body or printed. Resolves with Resend's message id.
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
  if (EMAIL_PROVIDER === "resend") return resendTransport
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
    // Bound the whole send so a silent relay (e.g. egress filtering) fails in
    // seconds — Nodemailer's 2-minute defaults would otherwise block
    // subscribes/broadcasts for minutes before surfacing the ETIMEDOUT.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
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

/**
 * Resend HTTPS transport — resolves `{ messageId }` or throws. Uses only the
 * global `fetch` (Node >= 18), so no SDK dependency is needed. The API key
 * travels only in the Authorization header. Settings mirror the SMTP path's
 * bounds: a dead/filtered endpoint fails in ~15s, never minutes.
 */
const RESEND_API_URL = "https://api.resend.com/emails"
const RESEND_TIMEOUT_MS = 15_000

export async function resendTransport(payload) {
  const { to, subject, html, text } = payload
  if (!RESEND_API_KEY)
    throw new Error("resendTransport requires RESEND_API_KEY")
  const fromEmail = RESEND_FROM_EMAIL
  if (!fromEmail) throw new Error("resendTransport requires RESEND_FROM_EMAIL")
  const fromName = RESEND_FROM_NAME || "Estate"
  const from = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS)
  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html: html ?? undefined,
        text: text ?? undefined,
      }),
    })
    if (!response.ok) {
      let detail = `resend HTTP ${response.status}`
      try {
        const body = await response.json()
        if (body?.message) detail = `${detail}: ${String(body.message)}`
      } catch {
        /* response body was not JSON */
      }
      throw new Error(detail.slice(0, 500))
    }
    let data = null
    try {
      data = await response.json()
    } catch {
      /* empty success body — fall through with messageId null */
    }
    return { messageId: data?.id ?? null }
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(
        `[ETIMEDOUT] resend request timed out after ${RESEND_TIMEOUT_MS}ms`,
      )
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
