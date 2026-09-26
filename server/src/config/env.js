import { loadEnvFile } from "node:process"

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

if (
  IS_PRODUCTION &&
  (CORS_ORIGINS.length === 0 || CORS_ORIGINS[0] === "*")
) {
  // eslint-disable-next-line no-console
  console.warn(
    "[env] CORS_ORIGINS is unset — accepting requests from any browser origin. " +
      "Set CORS_ORIGINS to a comma-separated origin list to restrict access.",
  )
}
