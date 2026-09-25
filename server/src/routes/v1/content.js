import { Router } from "express"
import { z } from "zod"
import { validate } from "../../middleware/validate.js"
import * as contentController from "../../controllers/v1/content.js"

/**
 * /api/v1/content — public, read-only CMS access (Phase 09).
 * Admin writes live on /api/v1/admin/content/:section. Unknown sections
 * are resolved by the service to a 404 NOT_FOUND.
 */
const sectionParamSchema = z.object({
  section: z.string().trim().min(1).max(50),
})

const router = Router()

router.get("/", contentController.listContent)
router.get(
  "/:section",
  validate(sectionParamSchema, "params"),
  contentController.getContent,
)

export default router