import { serializePropertySummary } from "./properties.js"

/**
 * Favorites serializers — each saved item is a property summary plus the
 * timestamp the current user saved it at (`savedAt`).
 */

export function serializeFavoriteList(rows) {
  return rows.map((row) => ({
    ...serializePropertySummary(row.property),
    savedAt: row.createdAt?.toISOString?.() ?? null,
  }))
}

/** The result of (re-)saving a property. */
export function serializeSaved(row) {
  return {
    propertyId: row.propertyId,
    isFavorite: true,
    savedAt: row.createdAt?.toISOString?.() ?? null,
  }
}
