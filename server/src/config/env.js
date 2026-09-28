import { loadEnvFile } from "node:process"
import { setDefaultResultOrder } from "node:dns"

// Some hosting egress stacks (notably free-tier Render) have no IPv6 route;
// Node resolves hostnames AAAA-first and SMTP connects then fail with
// ENETUNREACH on Gmail's IPv6 range. Prefer IPv4 for every socket in this
// process (HTTP API + SMTP + Postgres), falling back to IPv6 when absent.
setDefaultResultOrder("ipv4first")

// Load `.env` from the process working directory before any environment
// reads below. Missing files are fine (the API runs from shell env vars).
try {
  loadEnvFile()
} catch {
  /* no .env present — rely on the environment */
}

const isDefined = (v) => v !== undefined && v !== ""

export const APP_NAME = process.env.APP_NAME || "estate-api"
export const API_VERSION = process.env.API_VERSION || "v1"

export const NODE_ENV = process.env.NODE_ENV || "development"
export const IS_PRODUCTION = NODE_ENV === "production"
export const IS_TEST = NODE_ENV === "test"

export const PORT = Number(process.env.PORT || 4000)

// Neon PostgreSQL. Absent until a database is provisioned — the app boots
// without it (health reports db: skipped) and the connection layer throws a
// clear error on first real use.
export const DATABASE_URL = process.env.DATABASE_URL

// Force SSL from the driver when the URL does not already carry sslmode
// (Neon requires TLS; local Postgres usually does not).
export const DB_SSL = String(process.env.DB_SSL || "").toLowerCase() === "true"

// Allowed browser origins for CORS, comma-separated. When set, only the
// named origins are allowed. When unset, every browser origin is allowed:
// the API authenticates with bearer tokens (never cookies), so cross-origin
// callers still cannot act as a signed-in user without a valid token.
// Setting CORS_ORIGINS to a concrete list is the recommended hardening.
export const CORS_ORIGINS = isDefined(process.env.CORS_ORIGINS)
  ? String(process.env.CORS_ORIGINS)
      .split(",")
      .map((s) => s.trim())
      .map((s) => s.replace(/\/+$/, ""))
      .filter(Boolean)
  : ["*"]

// Phase 05 — JWT signing secret. Production refuses to boot without one; in
// development/test a stable dev-only secret is used so hashes stay valid
// across hot restarts (never store real secrets in code, and never in git).
export const JWT_SECRET = process.env.JWT_SECRET || "estate-dev-insecure-secret"
if (IS_PRODUCTION && !isDefined(process.env.JWT_SECRET)) {
  throw new Error("JWT_SECRET must be set in production")
}

// Phase 10 — Cloudinary media provider. Public identifiers (cloud name, API
// key) are allowed to reach the browser for signed direct uploads; the API
// SECRET must never be exposed to the frontend. Production refuses to boot
// without the full set so the admin media pipeline cannot silently degrade.
export const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET

export const CLOUDINARY_CONFIGURED =
  isDefined(CLOUDINARY_CLOUD_NAME) &&
  isDefined(CLOUDINARY_API_KEY) &&
  isDefined(CLOUDINARY_API_SECRET)

export const MEDIA_UPLOAD_MAX_BYTES = 10 * 1024 * 1024 // 10 MiB per image
export const MEDIA_UPLOAD_TTL_SECONDS = 10 * 60 // signature validity window
export const MEDIA_ORPHAN_AGE_HOURS = 24 // pending uploads older than this are eligible

if (
  IS_PRODUCTION &&
  (!isDefined(CLOUDINARY_CLOUD_NAME) ||
    !isDefined(CLOUDINARY_API_KEY) ||
    !isDefined(CLOUDINARY_API_SECRET))
) {
  throw new Error(
    "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set in production",
  )
}

// Phase 10 — admin bootstrap secret. The seeded admin account's password is
// never hardcoded into source control: in production the seed refuses to run
// without SEED_ADMIN_PASSWORD. Development/test fall back to a clearly
// non-production fixture so CI and local flows keep working.
export const SEED_ADMIN_PASSWORD =
  process.env.SEED_ADMIN_PASSWORD ||
  (IS_PRODUCTION ? undefined : "Estate-Dev-Admin-DevOnly!")

if (IS_PRODUCTION && (CORS_ORIGINS.length === 0 || CORS_ORIGINS[0] === "*")) {
  // eslint-disable-next-line no-console
  console.warn(
    "[env] CORS_ORIGINS is unset — accepting requests from any browser origin. " +
      "Set CORS_ORIGINS to a comma-separated origin list to restrict access.",
  )
}

// Phase 10 — transactional + campaign email delivery.
//
// Provider is pluggable:
//   `log`  (default) — writes a printable receipt to stdout and never touches
//          the network. Used in development and tests so the whole pipeline
//          (deliveries, failure recording) can be exercised without SMTP.
//   `smtp` — Nodemailer against SMTP_HOST (STARTTLS on 587 when SMTP_SECURE is
//          false; implicit TLS on 465 when true). The standard production path.
//   `resend` — HTTPS call to the Resend API (POST api.resend.com/emails). The
//          fallback transport for hosts whose egress blocks SMTP (EngineYard
//          Render free tier is one example) — HTTPS egress is always allowed.
//
// Credentials are server-side only: they are read here and are never exposed
// to the browser. Production boots with `log` only after a loud warning — a
// free tier Render instance has no persistent outbound mail guarantee, but
// the delivery ledger still records every attempt honestly.
export const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || "log"

export const SMTP_HOST = process.env.SMTP_HOST
export const SMTP_PORT = Number(process.env.SMTP_PORT || 587)
export const SMTP_USER = process.env.SMTP_USER
export const SMTP_PASS = process.env.SMTP_PASS
// SMTP_SECURE must become a real boolean — `Boolean("false") === true`, so
// only the literal "true" enables implicit TLS on 465. Every other value
// (the string "false", empty, unset) parses to false = STARTTLS on 587.
export const SMTP_SECURE =
  String(process.env.SMTP_SECURE || "").toLowerCase() === "true"
export const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL
export const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME

// Resend HTTPS provider. The API key is server-only. The From address must be
// an identity Resend accepts: `onboarding@resend.dev` for testing, or a
// verified domain you own — a personal Gmail address CANNOT be the From.
export const RESEND_API_KEY = process.env.RESEND_API_KEY
export const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL
export const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME

// Outward-facing base URL used to build links inside emails (unsubscribe,
// site). Falls back to the request origin when a request is available.
export const EMAIL_BASE_URL = process.env.EMAIL_BASE_URL

export const EMAIL_LOG_TRANSPORT = EMAIL_PROVIDER === "log"
export const EMAIL_CONFIGURED =
  EMAIL_PROVIDER === "smtp" || EMAIL_PROVIDER === "resend"

// HMAC key for deterministic unsubscribe tokens (see newsletterService).
// Production refuses to boot without it; dev/test use a stable fixture.
export const UNSUBSCRIBE_SECRET =
  process.env.UNSUBSCRIBE_SECRET || "estate-dev-unsubscribe-secret"
if (IS_PRODUCTION && !isDefined(process.env.UNSUBSCRIBE_SECRET)) {
  throw new Error("UNSUBSCRIBE_SECRET must be set in production")
}

if (IS_PRODUCTION && EMAIL_PROVIDER === "smtp") {
  if (!isDefined(SMTP_HOST) || !isDefined(SMTP_FROM_EMAIL)) {
    throw new Error(
      "SMTP_HOST + SMTP_FROM_EMAIL must be set when EMAIL_PROVIDER=smtp",
    )
  }
}
if (IS_PRODUCTION && EMAIL_PROVIDER === "resend") {
  if (!isDefined(RESEND_API_KEY) || !isDefined(RESEND_FROM_EMAIL)) {
    throw new Error(
      "RESEND_API_KEY + RESEND_FROM_EMAIL must be set when EMAIL_PROVIDER=resend",
    )
  }
}
if (IS_PRODUCTION && EMAIL_LOG_TRANSPORT) {
  // eslint-disable-next-line no-console
  console.warn(
    "[env] EMAIL_PROVIDER is unset (log transport) — campaign/agent emails will " +
      "be recorded in the delivery ledger but not delivered. Set EMAIL_PROVIDER=smtp " +
      "(SMTP_HOST/SMTP_PORT/SMTP_SECURE/SMTP_FROM_EMAIL) or EMAIL_PROVIDER=resend " +
      "(RESEND_API_KEY/RESEND_FROM_EMAIL) to enable real delivery.",
  )
}

// Safe startup diagnostics — confirm WHICH provider + settings the running
// process is actually using, without ever printing credentials (SMTP_PASS,
// RESEND_API_KEY, DATABASE_URL, JWT_SECRET, UNSUBSCRIBE_SECRET are all
// excluded here). Intentionally skipped under test to keep runner output clean.
if (!IS_TEST) {
  if (EMAIL_PROVIDER === "smtp") {
    // eslint-disable-next-line no-console
    console.log(
      `[env] email provider=smtp host=${SMTP_HOST} port=${SMTP_PORT} ` +
        `secure=${SMTP_SECURE} tlsEnabled=${
          SMTP_SECURE ? "implicit-465" : "STARTTLS-587"
        } ` +
        `fromConfigured=${isDefined(SMTP_FROM_EMAIL)}`,
    )
  } else if (EMAIL_PROVIDER === "resend") {
    // eslint-disable-next-line no-console
    console.log(
      `[env] email provider=resend fromConfigured=${isDefined(RESEND_FROM_EMAIL)} ` +
        `keyConfigured=${isDefined(RESEND_API_KEY)}`,
    )
  } else {
    // eslint-disable-next-line no-console
    console.log("[env] email provider=log (no real delivery)")
  }
}
