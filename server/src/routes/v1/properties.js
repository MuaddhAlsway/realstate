import { Router } from "express"
import {
  validate,
  validatePatch,
  validateQuery,
} from "../../middleware/validate.js"
import { requireAuth, requireRole, optionalAuth } from "../../middleware/auth.js"
import { createRateLimiter } from "../../middleware/rateLimit.js"
import {
  propertyIdSchema,
  createPropertySchema,
  updatePropertySchema,
  propertyQuerySchema,
} from "../../schemas/property.js"
import { createInquirySchema } from "../../schemas/inquiry.js"
import * as propertiesController from "../../controllers/v1/properties.js"
import * as inquiriesController from "../../controllers/v1/inquiries.js"

/**
 * /api/v1/properties — production property API.
 *
 * Request flow per phase: Route → Validation → Controller → Service → Drizzle
 * → PostgreSQL, then Service → Serializer → HTTP response.
 *
 * Phase 05: the catalog (GET) stays public. Phase 11: only ADMIN can create
 * or modify property listing data (agents manage client relationships, not
 * listings). The public inquiry endpoint (`POST /:id/inquiries`) starts a
 * client-management deal for the property's assigned agent.
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
  requireRole("ADMIN"),
  validate(createPropertySchema),
  propertiesController.createProperty,
)

router.get(
  "/:id",
  validate(propertyIdSchema, "params"),
  propertiesController.getProperty,
)

// Phase 11 — public client inquiry (rate-limited, optional auth). Guest
// contact details come from the body; a signed-in customer is linked to
// their account instead.
const inquiryLimiter = createRateLimiter({ max: 20, windowMs: 60 * 1000 })
router.post(
  "/:id/inquiries",
  inquiryLimiter,
  optionalAuth,
  validate(propertyIdSchema, "params"),
  validate(createInquirySchema),
  inquiriesController.createInquiry,
)

router.patch(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  validate(propertyIdSchema, "params"),
  validatePatch(updatePropertySchema),
  propertiesController.updateProperty,
)
router.delete(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  validate(propertyIdSchema, "params"),
  propertiesController.deleteProperty,
)

export default router
