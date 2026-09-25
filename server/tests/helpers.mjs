import { randomUUID } from "node:crypto"
import request from "supertest"
import { getTestDatabaseUrl } from "../src/config/test-db.js"

/**
 * Test bootstrap — database safety boundary.
 *
 * Before ANY server module is imported we point the connection at the
 * isolated `estate_test` database (never the production database) and pin
 * NODE_ENV=test. `env.js`'s loadEnvFile does not override already-set
 * values, so .env's DATABASE_URL stays untouched here.
 */
process.env.NODE_ENV = "test"
process.env.DATABASE_URL = getTestDatabaseUrl()

const { createApp } = await import("../src/app.js")
const { getDb } = await import("../src/db/index.js")

export const app = createApp()
export const getTestDb = getDb

export function uniqueSlug(prefix = "api-test") {
  return `${prefix}-${randomUUID().slice(0, 8)}`
}

// Phase 05: property mutations require an authenticated AGENT/ADMIN. The
// test database is freshly seeded with the demo accounts (server/src/db/
// seed.js) — the admin credentials below match its constants, and logging in
// through the real /login endpoint keeps the suite honest. Phase 10: the
// seed reads the admin password from SEED_ADMIN_PASSWORD (dev/test fall back
// to the fixture below; production requires an explicit value).
export const ADMIN_EMAIL = "admin@estate.sa"
export const ADMIN_PASSWORD = "Estate-Dev-Admin-DevOnly!"

let adminTokenPromise = null

/** Access token for the seeded admin account (cached per run). */
export function adminToken() {
  if (!adminTokenPromise) {
    adminTokenPromise = request(app)
      .post("/api/v1/auth/login")
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .then((res) => {
        if (res.status !== 200) {
          throw new Error(
            `seeded admin login failed (${res.status}): the test database must be seeded with the Phase 05 seed`,
          )
        }
        return res.body.data.accessToken
      })
  }
  return adminTokenPromise
}

export const bearer = (token) => ({ Authorization: `Bearer ${token}` })

/** Cleanup of rows created by a test suite. Each suite owns a slug prefix
 * (Phase 03: `api-test-`, Phase 04: `query-test-`, auth: `auth-test-`) so
 * concurrently-running files never delete each other's fixtures. Runs even on
 * assertion failure. */
export async function cleanDatabase(prefix = "api-test-") {
  const db = getDb()
  if (!db) return
  const { properties } = await import("../src/db/schema/index.js")
  const { like } = await import("drizzle-orm")
  await db.delete(properties).where(like(properties.slug, `${prefix}%`))
  const { closeDatabase } = await import("../src/db/index.js")
  await closeDatabase()
}

/** Cleanup for rows created by the auth suite (users cascade to sessions). */
export async function cleanAuthUsers(emailPrefix = "auth-test-") {
  const db = getDb()
  if (!db) return
  const { users } = await import("../src/db/schema/index.js")
  const { like } = await import("drizzle-orm")
  await db.delete(users).where(like(users.email, `${emailPrefix}%`))
  const { closeDatabase } = await import("../src/db/index.js")
  await closeDatabase()
}
