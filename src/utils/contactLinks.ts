/**
 * Reusable deep links for the agent contact actions — WhatsApp and Gmail
 * Compose. UI components stay responsible for rendering; URL building lives
 * here. Both builders return null when the required contact detail is absent,
 * so a missing phone/email never yields a degenerate link.
 */

/** Digits only (drops spaces, `+`, parentheses, dashes, leading 00). */
export function normalizeWhatsAppPhone(
  phone: string | null | undefined,
): string {
  if (!phone) return ""
  const digits = phone.replace(/\D+/g, "")
  return digits.startsWith("00") ? digits.slice(2) : digits
}

/**
 * https://wa.me/<digits>?text=<message> — international WhatsApp deep link.
 * Returns null when the phone yields no usable digits.
 */
export function createWhatsAppLink(
  phone: string | null | undefined,
  message: string,
): string | null {
  const digits = normalizeWhatsAppPhone(phone)
  if (!digits) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

export interface GmailComposeInput {
  to: string
  subject: string
  message: string
}

/**
 * Gmail Compose URL with To / Subject / Body prefilled. Returns null when the
 * recipient is empty. All parts are URL-encoded (URLSearchParams).
 */
export function createGmailComposeLink(
  input: GmailComposeInput,
): string | null {
  const to = input.to.trim()
  if (!to) return null
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to,
    su: input.subject,
    body: input.message,
  })
  return `https://mail.google.com/mail/?${params.toString()}`
}