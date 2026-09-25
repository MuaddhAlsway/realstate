import { z } from "zod"
import { intParam, propertySortEnum } from "./property.js"

/**
 * Admin-request validation (Phase 09). Admin routes are RBAC-gated as a
 * whole router, so schemas here only shape params, queries and the agent
 * profile update. Property create/update reuse the existing property
 * schemas (now extended with images + amenities).
 */

export const adminAgentParamSchema = z.object({
  id: z.uuid("must be a valid UUID"),
})

const optionalNullable = (inner) => z.preprocess((v) => (v === null ? null : v), inner.nullish())

export const updateAdminAgentSchema = z
  .object({
    name: z.string().trim().min(1, "name is required").max(200).optional(),
    role: z.string().trim().max(100).nullish(),
    languages: z.string().trim().max(200).nullish(),
    experienceYears: z
      .number()
      .int("experienceYears must be an integer")
      .min(0)
      .max(99)
      .optional(),
    phone: z.string().trim().max(100).nullish(),
    email: z.string().trim().email("email must be valid").max(300).nullish(),
    imageUrl: z.string().trim().url("imageUrl must be a valid URL").max(2000).nullish(),
  })
  .strict()

export const adminPropertyQuerySchema = z
  .object({
    purpose: z.enum(["SALE", "RENT"]).optional(),
    propertyType: z
      .enum(["VILLA", "APARTMENT", "PENTHOUSE", "DUPLEX"])
      .optional(),
    status: z
      .enum(["AVAILABLE", "PENDING", "SOLD", "RENTED", "DRAFT"])
      .optional(),
    search: z
      .string()
      .trim()
      .min(1, "search cannot be empty")
      .max(200)
      .optional(),
    sort: propertySortEnum.default("newest"),
    page: intParam("page must be a positive integer", { min: 1 }).default(1),
    limit: intParam("limit must be an integer between 1 and 100", {
      min: 1,
      max: 100,
    }).default(50),
  })
  .strict()

export const adminUsersQuerySchema = z
  .object({
    search: z
      .string()
      .trim()
      .min(1, "search cannot be empty")
      .max(200)
      .optional(),
  })
  .strict()