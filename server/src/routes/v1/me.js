import { Router } from "express"
import { validate, validateQuery } from "../../middleware/validate.js"
import { requireAuth } from "../../middleware/auth.js"
import { createRateLimiter } from "../../middleware/rateLimit.js"
import {
  inquiryIdParamSchema,
  createMessageSchema,
  inquiryQuerySchema,
  inquiryStatusUpdateSchema,
  notificationQuerySchema,
  markNotificationsReadSchema,
} from "../../schemas/inquiry.js"
import * as inquiriesController from "../../controllers/v1/inquiries.js"

/**
 * /api/v1/me — the signed-in account's own client-management surface.
 *
 * Customers (and agents/admins) see their inquiries here; the agent gets the
 * richer portal under /api/v1/agent. Everything requires authentication and
 * is scoped server-side to the caller.
 */
const router = Router()

const messageLimiter = createRateLimiter({ max: 30, windowMs: 60 * 1000 })

router.use(requireAuth)

router.get(
  "/inquiries",
  validateQuery(inquiryQuerySchema),
  inquiriesController.listMyInquiries,
)
router.get(
  "/inquiries/:id",
  validate(inquiryIdParamSchema, "params"),
  inquiriesController.getMyInquiry,
)
router.get(
  "/inquiries/:id/messages",
  validate(inquiryIdParamSchema, "params"),
  inquiriesController.listInquiryMessages,
)
router.post(
  "/inquiries/:id/messages",
  messageLimiter,
  validate(inquiryIdParamSchema, "params"),
  validate(createMessageSchema),
  inquiriesController.sendInquiryMessage,
)

// Customers may CANCELL a PENDING inquiry; the service rejects every other
// transition for the USER role (403) and wrong target statuses (409).
router.patch(
  "/inquiries/:id/status",
  validate(inquiryIdParamSchema, "params"),
  validate(inquiryStatusUpdateSchema),
  inquiriesController.updateInquiryStatus,
)

router.get(
  "/notifications",
  validateQuery(notificationQuerySchema),
  inquiriesController.listMyNotifications,
)
router.patch(
  "/notifications/read",
  validate(markNotificationsReadSchema),
  inquiriesController.markMyNotificationsRead,
)

export default router
