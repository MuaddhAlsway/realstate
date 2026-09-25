import { fileURLToPath } from "node:url"
import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import { getTestDatabaseUrl } from "../config/test-db.js"
import { closeDatabase } from "./index.js"

/**
 * One-time (idempotent) dev/test setup: applies migrations AND seeds the
 * isolated `estate_test` database so the CRUD suite runs against realistic
 * fixtures — without ever touching the production database.
 *
 * `pnpm db:test:prepare`
 */

const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url))

const sql = postgres(getTestDatabaseUrl(), { max: 1, connect_timeout: 15 })
try {
  await migrate(drizzle(sql), { migrationsFolder })
  console.log("test database migrated")
} finally {
  await sql.end()
}

// Seed against the test database by pointing the shared seed script at it.
const { getTestDatabaseUrl: getUrl } = await import("../config/test-db.js")
process.env.DATABASE_URL = getUrl()
const { default: seed } = await import("./seed.js")
// seed.js runs its transaction at import time (top-level await) — done.
await closeDatabase()
console.log("test database seed complete")
