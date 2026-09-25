import { eq } from "drizzle-orm"
import { getDb } from "../db/index.js"
import * as schema from "../db/schema/index.js"
import { HttpError } from "../errors/index.js"
import { ErrorCodes } from "../errors/error-codes.js"
import { translateDatabaseError } from "../errors/pg.js"
import { CONTENT_SECTIONS } from "../content/defaults.js"
import { deleteAsset } from "./mediaService.js"

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
    const translated = translateDatabaseError(err)
    if (translated) throw translated
    throw err
  }
}

/**
 * Provider refs are private (used to delete replaced provider assets). A
 * `…PublicId` sibling is dropped from every public read of the CMS.
 */
function stripMediaRefs(section) {
  const out = {}
  for (const [key, value] of Object.entries(section)) {
    if (/PublicId$/i.test(key)) continue
    out[key] = value
  }
  return out
}

/** All sections, ordered by the canonical registry — media refs stripped. */
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
  return Object.fromEntries(
    Object.entries(bySection).map(([name, values]) => [
      name,
      stripMediaRefs(values),
    ]),
  )
}

/** Values for one known section — media refs stripped for public exposure. */
export async function getSectionContent(name) {
  const db = requireDb()
  if (!CONTENT_SECTIONS.includes(name)) {
    throw new HttpError("Content section not found", 404, ErrorCodes.NOT_FOUND)
  }
  const rows = await run(() =>
    db.select({ key: siteContent.key, value: siteContent.value })
      .from(siteContent)
      .where(eq(siteContent.section, name)),
  )
  return stripMediaRefs(
    Object.fromEntries(rows.map((row) => [row.key, row.value])),
  )
}

/**
 * Raw (unstripped) values for one known section — internal reads need the
 * provider refs so replaced assets can be destroyed at the provider.
 */
async function readSectionRaw(name) {
  const db = requireDb()
  const rows = await run(() =>
    db.select({ key: siteContent.key, value: siteContent.value })
      .from(siteContent)
      .where(eq(siteContent.section, name)),
  )
  return Object.fromEntries(rows.map((row) => [row.key, row.value]))
}

/**
 * Replace an entire section with a validated values object. Deletes any
 * existing keys in the section that are not part of the payload so the
 * database never drifts from the admin form. Runs in one transaction.
 *
 * Phase 10 — replaced or removed managed assets are destroyed at the
 * provider best-effort, after the DB commit succeeds.
 */
export async function replaceSectionContent(name, values) {
  const db = requireDb()
  if (!CONTENT_SECTIONS.includes(name)) {
    throw new HttpError("Content section not found", 404, ErrorCodes.NOT_FOUND)
  }
  const previous = await readSectionRaw(name)
  const entries = Object.entries(values)
  await run(() =>
    db.transaction(async (tx) => {
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
    }),
  )
  reconcileRetiredMedia(previous, values)
  return getSectionContent(name)
}

/**
 * Best-effort destroy of provider assets that were referenced by the
 * previous section version but no longer point at the same asset.
 */
function reconcileRetiredMedia(previous, values) {
  for (const [key, oldValue] of Object.entries(previous)) {
    if (!/PublicId$/i.test(key)) continue
    if (typeof oldValue !== "string" || !oldValue.trim()) continue
    if (oldValue === values[key]) continue
    deleteAsset(oldValue).catch((err) => {
      console.error(
        `[media] failed to delete retired CMS asset ${oldValue}:`,
        err,
      )
    })
  }
}
