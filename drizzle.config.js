import { defineConfig } from "drizzle-kit"

/**
 * Drizzle Kit configuration.
 *
 * - `schema`: the relational schema above (plain ESM JS, shared with runtime)
 * - `out`: directory where generated SQL migrations land
 * - `dbCredentials.url`: reads DATABASE_URL — credentials are never hardcoded.
 *   `pnpm db:generate` does not need a database; `pnpm db:migrate` and
 *   `pnpm db:studio` require DATABASE_URL in .env.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./server/src/db/schema/index.js",
  out: "./server/src/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
})
