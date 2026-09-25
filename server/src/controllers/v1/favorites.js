import { asyncHandler } from "../../middleware/error.js"
import * as favoriteService from "../../services/favoriteService.js"
import {
  serializeFavoriteList,
  serializeSaved,
} from "../../serializers/favorites.js"

/**
 * Favorites controllers — thin HTTP translation over favoriteService.
 * Every route is behind requireAuth so `req.user.id` is always present.
 */

export const listFavorites = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } =
    await favoriteService.listFavorites(req.user.id, req.parsedQuery)
  res.json({
    success: true,
    data: serializeFavoriteList(items),
    meta: { page, limit, total, totalPages },
  })
})

export const addFavorite = asyncHandler(async (req, res) => {
  const row = await favoriteService.addFavorite(
    req.user.id,
    req.params.propertyId,
  )
  res.json({ success: true, data: serializeSaved(row) })
})

export const removeFavorite = asyncHandler(async (req, res) => {
  await favoriteService.removeFavorite(req.user.id, req.params.propertyId)
  res.status(204).end()
})
