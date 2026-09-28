import { Router } from "express"
import { validate, validateQuery } from "../../middleware/validate.js"
import { createRateLimiter } from "../../middleware/rateLimit.js"
import {
  subscribeSchema,
  unsubscribeQuerySchema,
} from "../../schemas/newsletter.js"
import * as newsletterController from "../../controllers/v1/newsletter.js"

/**
 * /api/v1/newsletter — public newsletter surface (Phase 10).
 *
 * Subscribing is intentionally quiet: one email per address, a limiter against
 * list-scraping, and no auth ceremony. Unsubscribing is a GET (email link
 * friendly) whose token is hash-verified — never a raw database id.
 */
const router = Router()

// Keep subscription traffic polite: 5 signups/min per visitor.
const subscribeLimiter = createRateLimiter({ max: 5, windowMs: 60 * 1000 })

router.post(
  "/subscribe",
  subscribeLimiter,
  validate(subscribeSchema),
  newsletterController.subscribe,
)
router.get(
  "/unsubscribe",
  validateQuery(unsubscribeQuerySchema),
  newsletterController.unsubscribe,
)

export default router
