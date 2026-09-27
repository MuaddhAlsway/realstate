import { asc } from "drizzle-orm"
import { getDb } from "../db/index.js"
import * as schema from "../db/schema/index.js"
import { HttpError } from "../errors/index.js"
import { ErrorCodes } from "../errors/error-codes.js"
import { translateDatabaseError } from "../errors/pg.js"

/**
 * Public advisor directory (Phase 11). Read-only catalog backed by the
 * agents table; no authentication, no mutations. The property-detail agent
 * slug matches these field names, so the same frontend mapping serves both.
 */

const { agents } = schema

function requireDb() {
  const db = getDb()
  if (!db)
    throw new HttpError(
      "Database is not configured",
      503,
      ErrorCodes.SERVICE_UNAVAILABLE,
    )
  return db
}

async function run(fn) {
  try {
    return await fn()
  } catch (err) {
    const translated = translateDatabaseError(err)
    if (translated) throw translated
    throw err
  }
}

export async function listPublicAgents() {
  const db = requireDb()
  return run(() =>
    db.query.agents.findMany({
      orderBy: asc(agents.name),
      columns: {
        id: true,
        name: true,
        role: true,
        languages: true,
        experienceYears: true,
        phone: true,
        email: true,
        imageUrl: true,
      },
    }),
  )
}