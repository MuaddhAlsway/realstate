import { escapeHtml, sanitizeHtml, paragraphize } from "./sanitize.js"

/**
 * Email templates (Phase 10) — each `render*` returns `{ subject, html, text }`
 * ready for the transport. Content assembled here carries no raw user input:
 * anything that came from the browser was already trimmed by Zod, sanitized on
 * the way in, and is re-escaped when interpolated.
 */

const DISCLAIMER =
  "You are receiving this because you subscribed to the Estate newsletter."

function shell({ title, bodyHtml, unsubscribeUrl, baseUrl }) {
  const brand = "ESTATE"
  const unsub = unsubscribeUrl
    ? `<a href="${unsubscribeUrl}" style="color:#8a8378;text-decoration:underline;">Unsubscribe</a>`
    : ""
  const footer = unsub
    ? `<p style="margin:0;color:#8a8378;font-size:12px;line-height:1.6;">
         ${DISCLAIMER} · ${unsub}${baseUrl ? ` · <a href="${escapeHtml(baseUrl)}" style="color:#8a8378;">${escapeHtml(baseUrl)}</a>` : ""}
       </p>`
    : ""
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f5f0e8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#0f0f0d;padding:28px 40px;">
          <span style="color:#c9a96e;font-size:20px;letter-spacing:8px;font-weight:300;">${brand}</span>
        </td></tr>
        <tr><td style="padding:36px 40px;font-family:Arial,Helvetica,sans-serif;color:#1a1a17;font-size:15px;line-height:1.7;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:20px 40px 32px;border-top:1px solid #e7e0d2;">
          ${footer}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/** Welcome/intro email for a new newsletter subscriber. */
export function renderWelcome({ name, baseUrl, unsubscribeUrl, siteUrl }) {
  const heading = name ? `Welcome, ${escapeHtml(name)}` : "Welcome"
  const bodyHtml = `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:400;">${heading}</h1>
    <p style="margin:0 0 16px;">Thank you for subscribing to the Estate newsletter. You will receive curated listings, market insights and exclusive previews.</p>
    <p style="margin:0;">You can change your mind any time with the link below.</p>`
  const html = shell({
    title: "Welcome to Estate",
    bodyHtml,
    unsubscribeUrl,
    baseUrl: siteUrl,
  })
  const text = `${heading}\n\nThank you for subscribing to the Estate newsletter. You will receive curated listings, market insights and exclusive previews.\n\n${unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : ""}`
  return { subject: "Welcome to the Estate newsletter", html, text }
}

/** Campaign broadcast — fills per-recipient placeholders then wraps. */
export function renderCampaign({
  subject,
  htmlContent,
  textContent,
  baseUrl,
  email,
  unsubscribeUrl,
  siteUrl,
}) {
  const subs = { "{{EMAIL}}": email, "{{UNSUBSCRIBE_URL}}": unsubscribeUrl }
  const fill = (value) =>
    Object.entries(subs).reduce((acc, [k, v]) => acc.replaceAll(k, v), value)
  const bodyHtml = sanitizeHtml(fill(htmlContent))
  const html = shell({
    title: subject,
    bodyHtml,
    unsubscribeUrl,
    baseUrl: siteUrl,
  })
  const text = `${fill(textContent)}
${unsubscribeUrl ? `\nUnsubscribe: ${unsubscribeUrl}` : ""}`
  return { subject, html, text }
}

/** Agent → client message, built from plain text to a safe HTML email. */
export function renderAgentMessage({
  subject,
  agentName,
  body,
  baseUrl,
  siteUrl,
}) {
  const bodyHtml = `${paragraphize(body)}
    <p style="margin:24px 0 0;color:#666;font-size:13px;">This email was sent on behalf of ${escapeHtml(agentName)} regarding your enquiry at Estate. Please respond to ${escapeHtml(agentName)} directly — or reply to this message.</p>`
  const html = shell({
    title: subject,
    bodyHtml,
    unsubscribeUrl: null,
    baseUrl: siteUrl,
  })
  return {
    subject,
    html,
    text: `Hello,\n\n${body}\n\n— ${agentName}, Estate${baseUrl ? `\n${baseUrl}` : ""}`,
  }
}