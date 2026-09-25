import { Router } from "express"
import {
  validate,
  validatePatch,
  validateQuery,
} from "../../middleware/validate.js"
import { requireAuth, requireRole } from "../../middleware/auth.js"
import { contentSectionParamSchema } from "../../schemas/content.js"
import { uploadAuthorizationSchema } from "../../schemas/media.js"
import {
  adminAgentParamSchema,
  updateAdminAgentSchema,
  adminPropertyQuerySchema,
  adminUsersQuerySchema,
} from "../../schemas/admin.js"
import { viewingQuerySchema } from "../../schemas/viewing.js"
import * as adminController from "../../controllers/v1/admin.js"
import * as mediaController from "../../controllers/v1/media.js"
import { createRateLimiter } from "../../middleware/rateLimit.js"

/**
 * /api/v1/admin — production admin API (Phase 09).
 *
 * Every route requires an authenticated ADMIN token (401 without auth,
 * 403 for any other role). This router owns management reads and writes
 * that are too broad for the public surface: dashboard aggregation, full
 * property listings (every status), the agent/user directories, reference
 * catalogs for form options, and CMS section writes.
 *
 * Phase 10 media routes live here too (upload authorization + orphan sweep)
 * so they inherit the same ADMIN gate, plus an in-memory rate limiter.
 *
 * Property create/update/delete intentionally stay on the shared
 * /api/v1/properties routes (AGENT|ADMIN) so the admin UI exercises the
 * same code paths as agents.
 */
const router = Router()

router.use(requireAuth, requireRole("ADMIN"))

// Phase 10 — upload authorization must never be spammable by one account.
const mediaLimiter = createRateLimiter()

router.post(
  "/media/upload-authorize",
  mediaLimiter,
  validate(uploadAuthorizationSchema),
  mediaController.uploadAuthorization,
)

router.get("/media/orphans", mediaLimiter, mediaController.listOrphans)
router.delete("/media/orphans", mediaLimiter, mediaController.cleanOrphans)

router.get("/dashboard", adminController.dashboard)

router.get(
  "/properties",
  validateQuery(adminPropertyQuerySchema),
  adminController.listProperties,
)

router.get(
  "/viewings",
  validateQuery(viewingQuerySchema),
  adminController.listViewings,
)

router.get("/agents", adminController.listAgents)
router.patch(
  "/agents/:id",
  validate(adminAgentParamSchema, "params"),
  validatePatch(updateAdminAgentSchema),
  adminController.updateAgent,
)

router.get(
  "/users",
  validateQuery(adminUsersQuerySchema),
  adminController.listUsers,
)

router.get("/amenities", adminController.listAmenities)
router.get("/neighborhoods", adminController.listNeighborhoods)

router.put(
  "/content/:section",
  validate(contentSectionParamSchema, "params"),
  adminController.replaceContent,
)

export default router
