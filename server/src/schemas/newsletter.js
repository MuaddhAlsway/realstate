import { z } from "zod"
import { intParam } from "./property.js"

/**
 * Newsletter / campaign / agent-email validation (Phase 10).
 *
 * All schemas are `.strict()`: client-supplied identity (campaign sender,
 * recipient emails, delivery statuses, tokens, timestamps) can never be
 * forged. The unsubscribe token is opaque by design — the service hashes and
 * matches it, never the other way around.
 */

export const subscribeSchema = z
  .object({
    email: z.string().trim().email("email must be valid").max(300),
  })
  .strict()

export const unsubscribeQuerySchema = z
  .object({
    token: z.string().trim().min(20, "unsubscribe token is required").max(300),
  })
  .strict()

export const newsletterSubscriberQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    status: z.enum(["ACTIVE", "UNSUBSCRIBED"]).optional(),
    page: intParam("page must be a positive integer", { min: 1 }).default(1),
    limit: intParam("limit must be an integer between 1 and 50", {
      min: 1,
      max: 50,
    }).default(20),
  })
  .strict()

export const campaignCreateSchema = z
  .object({
    name: z.string().trim().min(1, "campaign name is required").max(200),
    subject: z.string().trim().min(1, "subject is required").max(200),
    // Campaign HTML accepts the {{EMAIL}} / {{UNSUBSCRIBE_URL}} placeholders.
    htmlContent: z
      .string()
      .trim()
      .min(1, "HTML body is required")
      .max(50_000, "HTML body must be at most 50,000 characters"),
    textContent: z
      .string()
      .trim()
      .min(1, "plain-text body is required")
      .max(50_000, "plain-text body must be at most 50,000 characters"),
  })
  .strict()

export const campaignIdParamSchema = z.object({
  id: z.uuid("must be a valid UUID"),
})

export const campaignTestSchema = z
  .object({
    // Test recipients are strictly numeric+email validated; subject/body come
    // from the DRAFT row (createdByUserId pinned server-side).
    testEmails: z
      .array(z.string().trim().email("email must be valid").max(300))
      .min(1, "at least one test email is required")
      .max(10, "at most 10 test emails per send"),
  })
  .strict()

export const agentMessageSchema = z
  .object({
    // Recipient is NOT accepted here — the service resolves it from the lead's
    // assigned relationship so arbitrary emails can never be addressed.
    subject: z
      .string()
      .trim()
      .min(1, "subject is required")
      .max(200, "subject must be at most 200 characters"),
    body: z
      .string()
      .trim()
      .min(1, "message is required")
      .max(5_000, "message must be at most 5,000 characters"),
  })
  .strict()