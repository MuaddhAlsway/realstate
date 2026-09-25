import { Router } from "express"
import { validate, validateQuery } from "../../middleware/validate.js"
import { requireAuth } from "../../middleware/auth.js"
import {
  createViewingSchema,
  viewingIdParamSchema,
  viewingQuerySchema,
  viewingStatusUpdateSchema,
} from "../../schemas/viewing.js"
import * as viewingsController from "../../controllers/v1/viewings.js"

/**
 * /api/v1/viewings — viewing requests against listings.
 *
 * All routes require authentication:
 *  - POST   — the signed-in user requests a viewing on a property
 *  - GET    — "my" requests: my own + my assigned-agent inbox (AGENT/ADMIN)
 *  - PATCH  — status transition, role-gated (requester cancel | agent/admin)
 *  - DELETE — requester / assigned agent / admin removes the request
 */
const router = Router()

router.use(requireAuth)

router.post(
  "/",
  validate(createViewingSchema),
  viewingsController.createViewing,
)
router.get(
  "/",
  validateQuery(viewingQuerySchema),
  viewingsController.listViewings,
)
router.patch(
  "/:id",
  validate(viewingIdParamSchema, "params"),
  validate(viewingStatusUpdateSchema),
  viewingsController.updateViewingStatus,
)
router.delete(
  "/:id",
  validate(viewingIdParamSchema, "params"),
  viewingsController.deleteViewing,
)

export default router
