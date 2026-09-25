import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import * as schema from "./schema/index.js"
import { DATABASE_URL, DB_SSL, NODE_ENV } from "../config/env.js"

/**
 * Centralized Postgres connection. The rest of the application must import
 * the database from here — never create connections inside controllers or
 * routes.
 *
 * Connection is LAZY: the app boots without DATABASE_URL (health reports
 * `db: skipped`); the first real query creates the pool and fails loudly
 * with a configuration hint if the URL is missing.
 *
 * The URL is read from `process.env.DATABASE_URL` at connect time (falling
 * back to the env snapshot), so tests can inject a test database URL before
 * the first query without re-importing modules.
 */

let pool = null
let client = null

const activeUrl = () => process.env.DATABASE_URL ?? DATABASE_URL

export const hasDatabase = () => Boolean(activeUrl())

function requireUrl() {
  const url = activeUrl()
  if (!url) {
    throw new Error(
      "DATABASE_URL is not configured. Copy .env.example to .env and set " +
        "your Neon connection string, then run `pnpm db:migrate`.",
    )
  }
  return url
}

export function getPool() {
  if (!pool) {
    pool = postgres(requireUrl(), {
      max: NODE_ENV === "test" ? 1 : 10,
      idle_timeout: 20,
      // Neon (serverless) can take a moment to wake a suspended branch —
      // keep the connect timeout above the 5s cold-start floor.
      connect_timeout: 15,
      ...(DB_SSL ? { ssl: "require" } : {}),
    })
  }
  return pool
}

export function getDb() {
  if (!hasDatabase()) return null
  if (!client) client = drizzle(getPool(), { schema })
  return client
}

/** Cheap liveness probe: `SELECT 1`. Throws when the DB is unreachable. */
export async function pingDatabase() {
  await getPool()`select 1`
  return true
}

/** Close the pool (used during graceful shutdown / tests). */
export async function closeDatabase() {
  if (pool) {
    await pool.end({ timeout: 5 })
    pool = null
    client = null
  }
}
