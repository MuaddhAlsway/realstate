import { Router } from "express"
import {
  validate,
  validatePatch,
  validateQuery,
} from "../../middleware/validate.js"
import { requireAuth, requireRole } from "../../middleware/auth.js"
import {
  propertyIdSchema,
  createPropertySchema,
  updatePropertySchema,
  propertyQuerySchema,
} from "../../schemas/property.js"
import * as propertiesController from "../../controllers/v1/properties.js"

/**
 * /api/v1/properties — production property API.
 *
 * Request flow per phase: Route → Validation → Controller → Service → Drizzle
 * → PostgreSQL, then Service → Serializer → HTTP response.
 *
 * Phase 05: the catalog (GET) stays public; every mutation requires an
 * authenticated AGENT or ADMIN (role gate, not ownership — a later phase can
 * add "owner" scoping).
 */
const router = Router()

router.get(
  "/",
  validateQuery(propertyQuerySchema),
  propertiesController.listProperties,
)
router.post(
  "/",
  requireAuth,
  requireRole("AGENT", "ADMIN"),
  validate(createPropertySchema),
  propertiesController.createProperty,
)

router.get(
  "/:id",
  validate(propertyIdSchema, "params"),
  propertiesController.getProperty,
)
router.patch(
  "/:id",
  requireAuth,
  requireRole("AGENT", "ADMIN"),
  validate(propertyIdSchema, "params"),
  validatePatch(updatePropertySchema),
  propertiesController.updateProperty,
)
router.delete(
  "/:id",
  requireAuth,
  requireRole("AGENT", "ADMIN"),
  validate(propertyIdSchema, "params"),
  propertiesController.deleteProperty,
)

export default router
