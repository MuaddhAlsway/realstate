import { Router } from "express"
import { validate, validateQuery } from "../../middleware/validate.js"
import { requireAuth } from "../../middleware/auth.js"
import {
  favoriteParamSchema,
  favoritesQuerySchema,
} from "../../schemas/favorites.js"
import * as favoritesController from "../../controllers/v1/favorites.js"

/**
 * /api/v1/favorites — the signed-in user's saved properties.
 *
 * All routes require authentication; every row is the current user's own
 * (`req.user.id` set by requireAuth). The catalog and auth endpoints are
 * untouched.
 */
const router = Router()

router.use(requireAuth)

router.get(
  "/",
  validateQuery(favoritesQuerySchema),
  favoritesController.listFavorites,
)
router.put(
  "/:propertyId",
  validate(favoriteParamSchema, "params"),
  favoritesController.addFavorite,
)
router.delete(
  "/:propertyId",
  validate(favoriteParamSchema, "params"),
  favoritesController.removeFavorite,
)

export default router
