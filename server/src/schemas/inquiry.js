import { z } from "zod"
import { intParam } from "./property.js"

/**
 * Inquiry / deal-workflow validation (Phase 11).
 *
 * The customer-facing schemas are `.strict()` so service-decided fields
 * (propertyId, agentId, userId, status, timestamps, senderRole, read) can
 * never be influenced by the client. Status transitions are validated
 * (shape) here and ruled (allowed moves) in the service layer.
 */

export const inquiryIdParamSchema = z.object({
  id: z.uuid("must be a valid UUID"),
})

const sanitizedContactMethod = z.enum(["EMAIL", "PHONE", "WHATSAPP"])

const optionalTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time must be HH:MM (24h)")

export const createInquirySchema = z
  .object({
    name: z.string().trim().min(1, "name is required").max(200),
    email: z.string().trim().email("email must be valid").max(300),
    phone: z.string().trim().max(100).optional(),
    message: z
      .string()
      .trim()
      .min(1, "message is required")
      .max(2000, "message must be at most 2000 characters"),
    preferredContactMethod: sanitizedContactMethod.optional(),
    viewingDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
      .refine(
        (value) => {
          const [y, mo, d] = value.split("-").map(Number)
          const dt = new Date(Date.UTC(y, mo - 1, d))
          return (
            dt.getUTCFullYear() === y &&
            dt.getUTCMonth() === mo - 1 &&
            dt.getUTCDate() === d
          )
        },
        { message: "date must be a valid calendar date" },
      )
      .optional(),
    viewingTime: optionalTime.optional(),
  })
  .strict()

export const inquiryStatusEnum = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
])

export const createMessageSchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(1, "message is required")
      .max(2000, "message must be at most 2000 characters"),
  })
  .strict()

export const inquiryStatusUpdateSchema = z
  .object({
    // PENDING is the creation state and can never be re-entered; the service
    // rejects it (and any other illegal move) with INVALID_STATUS_TRANSITION.
    toStatus: inquiryStatusEnum,
    note: z.string().trim().max(500).optional(),
    // When an agent/admin completes a deal, setting this flips the property:
    // SALE → SOLD, RENT → RENTED (it stops appearing in the public catalog).
    confirmTransaction: z.boolean().optional(),
  })
  .strict()

export const inquiryQuerySchema = z
  .object({
    status: inquiryStatusEnum.optional(),
    page: intParam("page must be a positive integer", { min: 1 }).default(1),
    limit: intParam("limit must be an integer between 1 and 50", {
      min: 1,
      max: 50,
    }).default(20),
  })
  .strict()

export const notificationQuerySchema = z
  .object({
    page: intParam("page must be a positive integer", { min: 1 }).default(1),
    limit: intParam("limit must be an integer between 1 and 50", {
      min: 1,
      max: 50,
    }).default(20),
  })
  .strict()

export const markNotificationsReadSchema = z
  .object({
    ids: z.array(z.uuid("must be a valid UUID")).max(200).optional(),
    // When `all` is true (or the body is empty) every unread notification
    // for the account is marked read.
    all: z.boolean().optional(),
  })
  .strict()
  .refine((body) => body.ids === undefined || body.all === undefined, {
    message: "provide either ids or all, not both",
    path: ["ids"],
  })

export const createAdminAgentSchema = z
  .object({
    name: z.string().trim().min(1, "name is required").max(200),
    email: z.string().trim().email("email must be valid").max(300),
    password: z
      .string()
      .min(8, "password must be at least 8 characters")
      .max(200),
    // Agent profile fields (mirror the `agents` table):
    role: z.string().trim().max(100).nullish(),
    languages: z.string().trim().max(200).nullish(),
    experienceYears: z
      .number()
      .int("experienceYears must be an integer")
      .min(0)
      .max(99)
      .nullish(),
    phone: z.string().trim().max(100).nullish(),
    imageUrl: z
      .string()
      .trim()
      .url("imageUrl must be a valid URL")
      .max(2000)
      .nullish(),
  })
  .strict()