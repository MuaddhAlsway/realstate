import { z } from "zod"
import { intParam } from "./property.js"

/**
 * Favorites request validation (Phase 06).
 *
 * The route param is `propertyId`; query pagination mirrors the catalog
 * (`page`/`limit`) but nothing else — favorites lists don't take filters.
 * `.strict()` keeps typo'd query params loud.
 */

export const favoriteParamSchema = z.object({
  propertyId: z.uuid("must be a valid UUID"),
})

export const favoritesQuerySchema = z
  .object({
    page: intParam("page must be a positive integer", { min: 1 }).default(1),
    limit: intParam("limit must be an integer between 1 and 50", {
      min: 1,
      max: 50,
    }).default(12),
  })
  .strict()
