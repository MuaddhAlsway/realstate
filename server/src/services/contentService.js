import { eq } from "drizzle-orm"
import { getDb } from "../db/index.js"
import * as schema from "../db/schema/index.js"
import { HttpError } from "../errors/index.js"
import { ErrorCodes } from "../errors/error-codes.js"
import { translateDatabaseError } from "../errors/pg.js"
import { CONTENT_SECTIONS } from "../content/defaults.js"

/**
 * Site-content service (Phase 09 — CMS).
 *
 * Reads coalesce one row per (section, key) into a plain values object.
 * Writes replace a whole section atomically: all keys are upserted and any
 * key that existed in the DB but is absent from the validated payload is
 * deleted, so the stored section always matches the last saved form exactly.
 * Values are JSONB — strings, numbers and arrays arrive as-is.
 */

const { siteContent } = schema

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

/** Run one DB call, translating predictable driver errors to HttpErrors. */
async function run(fn) {
  try {
    return await fn()
  } catch (err) {
    const translated = translateError(err)
    if (translated) throw translated
    throw err
  }
}

/** All sections, ordered by the canonical registry. */
export async function listAllContent() {
  const db = requireDb()
  const rows = await run(() =>
    db.select().from(siteContent).orderBy(siteContent.section, siteContent.key),
  )
  const bySection = Object.fromEntries(
    CONTENT_SECTIONS.map((name) => [name, {}]),
  )
  for (const row of rows) {
    if (!bySection[row.section]) bySection[row.section] = {}
    bySection[row.section][row.key] = row.value
  }
  return bySection
}

/** Values for one known section (empty object when nothing stored yet). */
export async function getSectionContent(name) {
  const db = requireDb()
  if (!CONTENT_SECTIONS.includes(name)) {
    throw new HttpError(
      "Content section not found",
      404,
      ErrorCodes.NOT_FOUND,
    )
  }
  const rows = await run(() =>
    db
      .select({ key: siteContent.key, value: siteContent.value })
      .from(siteContent)
      .where(eq(siteContent.section, name)),
  )
  return Object.fromEntries(rows.map((row) => [row.key, row.value]))
}

/**
 * Replace an entire section with a validated values object. Deletes any
 * existing keys in the section that are not part of the payload so the
 * database never drifts from the admin form. Runs in one transaction.
 */
export async function replaceSectionContent(name, values) {
  const db = requireDb()
  if (!CONTENT_SECTIONS.includes(name)) {
    throw new HttpError(
      "Content section not found",
      404,
      ErrorCodes.NOT_FOUND,
    )
  }
  const entries = Object.entries(values)
  await db.transaction(async (tx) => {
    await tx.delete(siteContent).where(eq(siteContent.section, name))
    if (entries.length > 0) {
      await tx.insert(siteContent).values(
        entries.map(([key, value]) => ({
          section: name,
          key,
          value,
          updatedAt: new Date(),
        })),
      )
    }
  })
  return getSectionContent(name)
}