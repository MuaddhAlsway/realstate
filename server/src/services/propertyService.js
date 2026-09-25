import { and, asc, count, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm"
import { getDb } from "../db/index.js"
import * as schema from "../db/schema/index.js"
import { HttpError } from "../errors/index.js"
import { ErrorCodes } from "../errors/error-codes.js"
import { translateDatabaseError } from "../errors/pg.js"

/**
 * Property service — owns all database access and property business rules
 * for the v1 API. Controllers translate HTTP → service calls and serialize
 * results; they never build SQL or touch the database directly.
 *
 * Transaction note: Phase 09 create/update accept images + amenity names
 * as a unit, so those mutations run inside a transaction — the property
 * row plus its property_images + property_amenities associations all
 * succeed or roll back together.
 */

const { properties, amenities, propertyImages, propertyAmenities } = schema

const NULLABLE = new Set([
  "description",
  "district",
  "address",
  "latitude",
  "longitude",
  "area",
  "agentId",
  "neighborhoodId",
])

// Keys that are handled transactionally as relational assets (not columns
// on the properties table itself).
const ASSET_KEYS = new Set(["images", "amenities"])

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

const listRelationColumns = {
  images: {
    orderBy: (img, { asc: ascOp }) => [ascOp(img.displayOrder)],
    columns: {
      id: true,
      url: true,
      altText: true,
      displayOrder: true,
      isCover: true,
    },
  },
  neighborhood: { columns: { id: true, name: true, slug: true } },
  agent: { columns: { id: true, name: true } },
}

const detailRelationColumns = {
  images: {
    orderBy: (img, { asc: ascOp }) => [ascOp(img.displayOrder)],
    columns: {
      id: true,
      url: true,
      altText: true,
      displayOrder: true,
      isCover: true,
    },
  },
  agent: {
    columns: {
      id: true,
      name: true,
      role: true,
      email: true,
      phone: true,
      imageUrl: true,
      experienceYears: true,
    },
  },
  neighborhood: {
    columns: {
      id: true,
      name: true,
      slug: true,
      tagline: true,
      description: true,
      imageUrl: true,
    },
  },
  // N:M amenities — fetched through the join table to avoid extra queries.
  propertyAmenities: {
    with: { amenity: { columns: { id: true, name: true, category: true } } },
  },
}

function buildCreateValues(input) {
  const values = {
    title: input.title,
    slug: input.slug,
    propertyType: input.propertyType,
    price: input.price,
    city: input.city,
  }
  // Nullable columns: accept explicit null, otherwise omit (DB fills defaults).
  for (const key of NULLABLE) {
    if (input[key] !== undefined) values[key] = input[key] ?? null
  }
  for (const key of [
    "purpose",
    "status",
    "currency",
    "bedrooms",
    "bathrooms",
    "featured",
  ]) {
    if (input[key] !== undefined) values[key] = input[key]
  }
  return values
}

function buildPatchValues(input) {
  const patch = {}
  for (const key of Object.keys(input)) {
    if (key === "id" || ASSET_KEYS.has(key)) continue
    patch[key] = NULLABLE.has(key) ? (input[key] ?? null) : input[key]
  }
  patch.updatedAt = new Date()
  return patch
}

// ── Phase 09: transactional images + amenity associations ──────────────

/** Reject input that would violate the database's one-cover constraint. */
function assertAtMostOneCover(images) {
  if (images.filter((img) => img.isCover === true).length > 1) {
    throw new HttpError(
      "At most one image can be marked as the cover",
      422,
      ErrorCodes.VALIDATION_ERROR,
    )
  }
}

/**
 * Normalize editor-provided images for storage: default `displayOrder` to
 * the array index and `isCover` to the first image when none is flagged
 * (mirrors how the seed data is shaped).
 */
function applyImageDefaults(images) {
  assertAtMostOneCover(images)
  const hasCover = images.some((img) => img.isCover === true)
  return images.map((img, index) => ({
    url: img.url,
    publicId: null,
    altText: img.altText ?? null,
    displayOrder: img.displayOrder ?? index,
    isCover: hasCover ? (img.isCover === true) : index === 0,
  }))
}

/**
 * Resolve amenity names to amenity ids inside a transaction: insert each
 * new name (unique constraint → ON CONFLICT DO NOTHING), then read ids.
 */
async function txResolveAmenities(tx, names) {
  await tx.insert(amenities).values(names.map((name) => ({ name }))).onConflictDoNothing()
  const rows = await tx
    .select({ id: amenities.id })
    .from(amenities)
    .where(inArray(amenities.name, names))
  return rows.map((row) => row.id)
}

async function txReplaceAmenities(tx, propertyId, names) {
  await tx
    .delete(propertyAmenities)
    .where(eq(propertyAmenities.propertyId, propertyId))
  const ids = await txResolveAmenities(tx, names)
  if (ids.length === 0) return
  await tx
    .insert(propertyAmenities)
    .values(ids.map((amenityId) => ({ propertyId, amenityId })))
    .onConflictDoNothing()
}

async function txReplaceImages(tx, propertyId, images) {
  await tx.delete(propertyImages).where(eq(propertyImages.propertyId, propertyId))
  const resolved = applyImageDefaults(images)
  if (resolved.length === 0) return
  await tx.insert(propertyImages).values(
    resolved.map((img) => ({
      propertyId,
      url: img.url,
      publicId: img.publicId,
      altText: img.altText,
      displayOrder: img.displayOrder,
      isCover: img.isCover,
    })),
  )
}

// ── Phase 04: list query compilation ─────────────────────────────────────
// A validated query object (see schemas/property.js) is compiled into a
// Drizzle `where`/`orderBy`/`limit`/`offset`. The same `where` drives the
// count and the page query so `total` always matches what the filter set
// contains. Compiled once — no SQL is built from raw strings.

const SEARCH_COLUMNS = [properties.title, properties.city, properties.district]

const SORT_COLUMNS = {
  // Default catalog view: featured first, then newest; id breaks ties so
  // ordering is stable across equal created_at values.
  featured: [
    desc(properties.featured),
    desc(properties.createdAt),
    asc(properties.id),
  ],
  newest: [desc(properties.createdAt), asc(properties.id)],
  "price-asc": [asc(properties.price), desc(properties.createdAt)],
  "price-desc": [desc(properties.price), desc(properties.createdAt)],
}

/** Escape a search token so it is matched literally inside a regex. */
function escapeRegex(token) {
  return token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Full-text-ish search across title, city and district. Tokens must appear
 * as whole words (word-boundary safe — "hamra" will not match inside
 * "al-hamra" as a substring of a different token, and underscores are
 * treated as word characters). All tokens must match (AND), any column may
 * provide a match (OR). Case-insensitive via `~*`.
 */
function buildSearchCondition(search) {
  const tokens = search.split(/\s+/).filter(Boolean)
  const perToken = tokens.map((token) => {
    const pattern = `(^|[^[:alnum:]_])${escapeRegex(token)}([^[:alnum:]_]|$)`
    return or(...SEARCH_COLUMNS.map((column) => sql`${column} ~* ${pattern}`))
  })
  return perToken.length === 1 ? perToken[0] : and(...perToken)
}

function buildPropertyQuery(query) {
  const conditions = []
  if (query.purpose) conditions.push(eq(properties.purpose, query.purpose))
  if (query.propertyType)
    conditions.push(eq(properties.propertyType, query.propertyType))
  if (query.city) conditions.push(eq(properties.city, query.city))
  if (query.district) conditions.push(eq(properties.district, query.district))
  if (query.minPrice) conditions.push(gte(properties.price, query.minPrice))
  if (query.maxPrice) conditions.push(lte(properties.price, query.maxPrice))
  if (query.minBedrooms)
    conditions.push(gte(properties.bedrooms, query.minBedrooms))
  if (query.minBathrooms)
    conditions.push(gte(properties.bathrooms, query.minBathrooms))
  if (query.search) conditions.push(buildSearchCondition(query.search))
  // Phase 09 — admin scope: status filtering is reserved for management
  // lists; the public catalog never receives a `status` query.
  if (query.status) conditions.push(eq(properties.status, query.status))

  return {
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: SORT_COLUMNS[query.sort],
    limit: query.limit,
    offset: (query.page - 1) * query.limit,
  }
}

/**
 * List properties with filters, search, sort and offset pagination.
 * Returns rows plus the metadata the paginated envelope needs.
 */
export async function listProperties(query = {}) {
  const db = requireDb()
  const { where, orderBy, limit, offset } = buildPropertyQuery(query)

  const [rows, totals] = await Promise.all([
    run(() =>
      db.query.properties.findMany({
        where,
        orderBy,
        limit,
        offset,
        with: listRelationColumns,
      }),
    ),
    run(() => db.select({ n: count() }).from(properties).where(where)),
  ])

  const total = totals[0]?.n ?? 0
  return {
    items: rows,
    total,
    page: query.page,
    limit,
    totalPages: total === 0 ? 0 : Math.max(1, Math.ceil(total / limit)),
  }
}

/**
 * Admin management list (Phase 09): every status, status/sort/search
 * filters, and a larger page size than the public catalog. Uses the same
 * compiled `where` for the count and the rows so totals stay consistent.
 */
export async function listAdminProperties(query = {}) {
  const db = requireDb()
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 100)
  const { where, orderBy } = buildPropertyQuery(query)

  const [rows, totals] = await Promise.all([
    run(() =>
      db.query.properties.findMany({
        where,
        orderBy,
        limit,
        offset: (Math.max(query.page ?? 1, 1) - 1) * limit,
        with: listRelationColumns,
      }),
    ),
    run(() => db.select({ n: count() }).from(properties).where(where)),
  ])

  const total = totals[0]?.n ?? 0
  return {
    items: rows,
    total,
    page: query.page ?? 1,
    limit,
    totalPages: total === 0 ? 0 : Math.max(1, Math.ceil(total / limit)),
  }
}

export async function getPropertyById(id) {
  const db = requireDb()
  const row = await run(() =>
    db.query.properties.findFirst({
      where: eq(properties.id, id),
      with: detailRelationColumns,
    }),
  )
  if (!row)
    throw new HttpError(
      "Property not found",
      404,
      ErrorCodes.PROPERTY_NOT_FOUND,
    )
  return row
}

/**
 * Create a property plus its images and amenity associations in one
 * transaction — any failure rolls the whole asset bundle back.
 */
export async function createProperty(input) {
  const db = requireDb()
  const propertyId = await run(() =>
    db.transaction(async (tx) => {
      const [created] = await tx
        .insert(properties)
        .values(buildCreateValues(input))
        .returning({ id: properties.id })
      if (input.amenities?.length) {
        await txReplaceAmenities(tx, created.id, input.amenities)
      }
      if (input.images?.length) {
        await txReplaceImages(tx, created.id, input.images)
      }
      return created.id
    }),
  )
  // Re-read with relations instead of hand-assembling the response row.
  return getPropertyById(propertyId)
}

export async function updateProperty(id, patch) {
  const db = requireDb()
  const existing = await run(() =>
    db.query.properties.findFirst({
      where: eq(properties.id, id),
      columns: { id: true },
    }),
  )
  if (!existing)
    throw new HttpError(
      "Property not found",
      404,
      ErrorCodes.PROPERTY_NOT_FOUND,
    )

  await run(() =>
    db.transaction(async (tx) => {
      await tx
        .update(properties)
        .set(buildPatchValues(patch))
        .where(eq(properties.id, id))
      if (Array.isArray(patch.images)) {
        await txReplaceImages(tx, id, patch.images)
      }
      if (Array.isArray(patch.amenities)) {
        await txReplaceAmenities(tx, id, patch.amenities)
      }
    }),
  )
  return getPropertyById(id)
}

export async function deleteProperty(id) {
  const db = requireDb()
  const [deleted] = await run(() =>
    db.delete(properties)
      .where(eq(properties.id, id))
      .returning({ id: properties.id }),
  )
  if (!deleted)
    throw new HttpError(
      "Property not found",
      404,
      ErrorCodes.PROPERTY_NOT_FOUND,
    )
}
