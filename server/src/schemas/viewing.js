import { z } from "zod"
import { intParam } from "./property.js"

/**
 * Viewing-request validation (Phase 07). Request bodies are `.strict()`:
 * `status`/`userId`/`agentId` are service-decided and must not arrive from
 * the client.
 */

export const viewingIdParamSchema = z.object({
  id: z.uuid("must be a valid UUID"),
})

const sqlDate = z
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

export const viewingStatusEnum = z.enum([
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
])

export const createViewingSchema = z
  .object({
    propertyId: z.uuid("must be a valid UUID"),
    date: sqlDate,
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time must be HH:MM (24h)")
      .optional(),
    message: z
      .string()
      .trim()
      .max(2000, "message must be at most 2000 characters")
      .optional(),
  })
  .strict()

export const viewingStatusUpdateSchema = z
  .object({
    status: viewingStatusEnum,
  })
  .strict()

export const viewingQuerySchema = z
  .object({
    status: viewingStatusEnum.optional(),
    page: intParam("page must be a positive integer", { min: 1 }).default(1),
    limit: intParam("limit must be an integer between 1 and 50", {
      min: 1,
      max: 50,
    }).default(12),
  })
  .strict()
