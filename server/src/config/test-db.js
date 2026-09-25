import { DATABASE_URL } from "./env.js"

/**
 * Test-database derivation. CRUD integration tests run against an isolated
 * `estate_test` database on the same Neon project so they can never touch
 * production records. The URL is derived from the configured connection
 * string by swapping the database name — no credentials are hardcoded or
 * printed anywhere.
 */
export const TEST_DATABASE_NAME =
  process.env.TEST_DATABASE_NAME || "estate_test"

export function getTestDatabaseUrl() {
  if (!DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not configured — cannot derive the test database URL.",
    )
  }
  const url = new URL(DATABASE_URL)
  url.pathname = `/${TEST_DATABASE_NAME}`
  return url.toString()
}
