import { Router } from "express"
import { validate, validateQuery } from "../../middleware/validate.js"
import { requireAuth, requireRole } from "../../middleware/auth.js"
import { createRateLimiter } from "../../middleware/rateLimit.js"
import { propertyQuerySchema } from "../../schemas/property.js"
import {
  inquiryIdParamSchema,
  inquiryQuerySchema,
  createMessageSchema,
  inquiryStatusUpdateSchema,
  notificationQuerySchema,
  markNotificationsReadSchema,
} from "../../schemas/inquiry.js"
import { agentMessageSchema } from "../../schemas/newsletter.js"
import * as agentController from "../../controllers/v1/agent.js"

/**
 * /api/v1/agent — the agent portal's API (Phase 11).
 *
 * Gate: an authenticated AGENT (or ADMIN) account linked to an agent
 * profile. Everything is scoped by the service to the caller's assigned
 * properties/inquiries — cross-agent access fails with 403.
 */
const router = Router()

const messageLimiter = createRateLimiter({ max: 30, windowMs: 60 * 1000 })

router.use(requireAuth, requireRole("AGENT", "ADMIN"))

router.get("/dashboard", agentController.dashboard)
router.get(
  "/properties",
  validateQuery(propertyQuerySchema),
  agentController.listProperties,
)
router.get(
  "/inquiries",
  validateQuery(inquiryQuerySchema),
  agentController.listInquiries,
)
router.get(
  "/inquiries/:id",
  validate(inquiryIdParamSchema, "params"),
  agentController.getInquiry,
)
router.get(
  "/inquiries/:id/messages",
  validate(inquiryIdParamSchema, "params"),
  agentController.listMessages,
)
router.post(
  "/inquiries/:id/messages",
  messageLimiter,
  validate(inquiryIdParamSchema, "params"),
  validate(createMessageSchema),
  agentController.sendMessage,
)
router.patch(
  "/inquiries/:id/status",
  validate(inquiryIdParamSchema, "params"),
  validate(inquiryStatusUpdateSchema),
  agentController.updateStatus,
)
router.post(
  "/inquiries/:id/email",
  messageLimiter,
  validate(inquiryIdParamSchema, "params"),
  validate(agentMessageSchema),
  agentController.sendLeadEmail,
)
router.get(
  "/inquiries/:id/emails",
  validate(inquiryIdParamSchema, "params"),
  agentController.listLeadEmails,
)

router.get(
  "/notifications",
  validateQuery(notificationQuerySchema),
  agentController.listNotifications,
)
router.patch(
  "/notifications/read",
  validate(markNotificationsReadSchema),
  agentController.markNotificationsRead,
)

export default router
