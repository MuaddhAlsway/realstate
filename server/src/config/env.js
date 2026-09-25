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

// Allowed browser origins for CORS, comma-separated. Falls back to `*` for
// local development only; production must name the deployed frontend origin
// explicitly so unauthenticated wildcard access can never ship.
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

if (
  IS_PRODUCTION &&
  (!isDefined(process.env.CORS_ORIGINS) ||
    CORS_ORIGINS.length === 0 ||
    CORS_ORIGINS[0] === "*")
) {
  throw new Error(
    "CORS_ORIGINS must be set to the deployed frontend origin(s) in production",
  )
}
