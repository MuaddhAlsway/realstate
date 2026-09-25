import postgres from "postgres"
import { DATABASE_URL } from "../config/env.js"

/**
 * One-time dev tool: provisions an isolated `estate_test` database (with a
 * safe-guarded override via TEST_DATABASE_NAME) on the same Neon project as
 * the production database. CRUD integration tests run against this database
 * so they can never accidentally destroy production records.
 *
 * Requires CREATE DATABASE privileges. If the pooled (pgBouncer) endpoint
 * rejects the DDL it falls back to the direct host by stripping `-pooler`.
 */

const dbName = process.env.TEST_DATABASE_NAME || "estate_test"
if (!/^[a-z_][a-z0-9_]*$/.test(dbName)) {
  console.error(`Invalid TEST_DATABASE_NAME: ${dbName}`)
  process.exit(1)
}
if (!DATABASE_URL) {
  console.error(
    "DATABASE_URL is not configured — nothing to provision against.",
  )
  process.exit(1)
}

function buildUrl(host) {
  const u = new URL(DATABASE_URL)
  u.hostname = host
  u.pathname = "/postgres" // maintenance database for CREATE DATABASE
  return u.toString()
}

async function tryCreate(sql, via) {
  const exists = await sql`select 1 from pg_database where datname = ${dbName}`
  if (exists.length) {
    console.log(`database "${dbName}" already exists (via ${via})`)
    await sql.end()
    return true
  }
  await sql.unsafe(`create database ${dbName}`)
  console.log(`database "${dbName}" created (via ${via})`)
  await sql.end()
  return true
}

const pooledHost = new URL(DATABASE_URL).hostname
try {
  await tryCreate(postgres(buildUrl(pooledHost), { max: 1 }), pooledHost)
} catch (err) {
  if (!pooledHost.includes("-pooler.")) throw err
  const directHost = pooledHost.replace("-pooler", "")
  console.log(
    `pooled endpoint rejected DDL (${err.code || err.message}) — retrying via direct host ${directHost}`,
  )
  await tryCreate(postgres(buildUrl(directHost), { max: 1 }), directHost)
}
