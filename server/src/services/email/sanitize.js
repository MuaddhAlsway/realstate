/**
 * Minimal HTML sanitizer for outbound email content (Phase 10).
 *
 * The repository has no HTML-parser dependency, and email HTML is typed by a
 * trusted ADMIN (or an agent's plain-text message converted to <p>), so this
 * is a conservative tag/attribute whitelist — defense in depth. It strips
 * script/style/iframe/object elements and every event handler, and only keeps
 * `<a href>` links whose scheme is http(s)/mailto. Disallowed elements have
 * their tags removed while the text content survives (it is inert by then).
 */

const WHITELISTED_TAGS = new Set([
  "p",
  "br",
  "b",
  "i",
  "u",
  "em",
  "strong",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "span",
  "div",
  "a",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "img",
])

const VOID_TAGS = new Set(["br", "hr", "img"])

const ALLOWED_ATTRS = new Set([
  "href",
  "title",
  "alt",
  "src",
  "width",
  "height",
])

const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:"])

function safeHref(value) {
  const trimmed = value.trim().toLowerCase()
  if (!/^[a-z][a-z0-9+.-]*:/.test(trimmed)) return true
  return SAFE_SCHEMES.has(trimmed)
}

function safeSrc(value) {
  const trimmed = value.trim()
  if (trimmed.startsWith("data:")) return false
  if (/^(https?:)?\/\//.test(trimmed)) return true
  return false
}

/**
 * Returns sanitized HTML. `allowImages` gates <img src> (campaign content may
 * include hosted images; agent messages never have any).
 */
export function sanitizeHtml(input, { allowImages = true } = {}) {
  if (!input) return ""
  let html = String(input)

  // Remove scripts/styles and whole subtrees first so their content cannot
  // survive as markup later.
  html = html
    .replace(
      /<\s*(script|style|iframe|object|embed|frame|frameset|base|meta|link|form|input|button|select|textarea)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      "",
    )
    .replace(
      /<\s*\/?\s*(script|style|iframe|object|embed|frame|frameset|base|meta|link)[^>]*>/gi,
      "",
    )

  // Strip every attribute that is not explicitly allowed (and drop on*
  // handlers + javascript: URLs before we even look at href).
  html = html
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(
      /\s([a-zA-Z:_-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/g,
      (match, name, rawValue) => {
        const value = rawValue.replace(/^["']|["']$/g, "")
        if (!ALLOWED_ATTRS.has(name.toLowerCase())) return ""
        if (name.toLowerCase() === "href" && !safeHref(value)) return ""
        if (name.toLowerCase() === "src" && !safeSrc(value)) return ""
        return match
      },
    )

  // Unwhitelisted tags: drop the tags, keep the text.
  html = html.replace(
    /<\s*\/?\s*([a-zA-Z][a-zA-Z0-9]*)\s*[^>]*>/g,
    (match, tag) => (WHITELISTED_TAGS.has(tag.toLowerCase()) ? match : ""),
  )

  // Close atomic image handling:
  if (!allowImages) {
    html = html.replace(/<\s*img[^>]*>/gi, "")
  }

  return html
}

/**
 * Escape a plain text snippet into a safe inline HTML fragment (used for
 * agent message bodies and text fallbacks).
 */
export function escapeHtml(input) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** Convert a plain-text message to a simple <p>-wrapped HTML body. */
export function paragraphize(input) {
  return String(input ?? "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => `<p>${escapeHtml(line.trim())}</p>`)
    .join("\n")
}
