import { and, count, desc, eq } from "drizzle-orm"
import { getDb } from "../db/index.js"
import * as schema from "../db/schema/index.js"
import { HttpError } from "../errors/index.js"
import { ErrorCodes } from "../errors/error-codes.js"
import { translateDatabaseError } from "../errors/pg.js"

/**
 * Favorites service — the current user's saved properties (Phase 06).
 *
 * Everything is scoped to `req.user.id`: a user can only read, add or remove
 * their own rows. Add is an idempotent UPSERT (the composite PK
 * `(user_id, property_id)` makes duplicates structurally impossible), remove
 * is explicit (404 if the favorite doesn't exist).
 */

const { favorites, properties } = schema

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

const favoritePropertyColumns = {
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

/**
 * The user's saved properties, newest save first, with offset pagination
 * metadata matching the catalog envelope.
 */
export async function listFavorites(userId, query = {}) {
  const db = requireDb()
  const page = query.page ?? 1
  const limit = query.limit ?? 12

  const [rows, totals] = await Promise.all([
    run(() =>
      db.query.favorites.findMany({
        where: eq(favorites.userId, userId),
        orderBy: desc(favorites.createdAt),
        limit,
        offset: (page - 1) * limit,
        with: {
          property: { with: favoritePropertyColumns },
        },
      }),
    ),
    run(() =>
      db.select({ n: count() })
        .from(favorites)
        .where(eq(favorites.userId, userId)),
    ),
  ])

  const total = totals[0]?.n ?? 0
  return {
    items: rows,
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.max(1, Math.ceil(total / limit)),
  }
}

async function requireProperty(db, propertyId) {
  const row = await run(() =>
    db.query.properties.findFirst({
      where: eq(properties.id, propertyId),
      columns: { id: true },
    }),
  )
  if (!row)
    throw new HttpError(
      "This property does not exist",
      404,
      ErrorCodes.PROPERTY_NOT_FOUND,
    )
}

/** Idempotently save a property for the current user. */
export async function addFavorite(userId, propertyId) {
  const db = requireDb()
  await requireProperty(db, propertyId)

  await run(() =>
    db.insert(favorites).values({ userId, propertyId }).onConflictDoNothing(),
  )

  const row = await run(() =>
    db.query.favorites.findFirst({
      where: and(
        eq(favorites.userId, userId),
        eq(favorites.propertyId, propertyId),
      ),
      columns: {
        userId: true,
        propertyId: true,
        createdAt: true,
      },
    }),
  )
  return row
}

/** Remove a saved property; 404 when it wasn't saved in the first place. */
export async function removeFavorite(userId, propertyId) {
  const db = requireDb()
  const [deleted] = await run(() =>
    db.delete(favorites)
      .where(
        and(eq(favorites.userId, userId), eq(favorites.propertyId, propertyId)),
      )
      .returning({ propertyId: favorites.propertyId }),
  )
  if (!deleted) {
    throw new HttpError(
      "This property is not in your favorites",
      404,
      ErrorCodes.FAVORITE_NOT_FOUND,
    )
  }
}
