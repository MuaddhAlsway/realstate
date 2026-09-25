import { z } from "zod"

/**
 * Property request validation.
 *
 * The PostgreSQL schema is the source of truth: required-vs-optional here
 * mirrors the database (required = NOT NULL without a default; optionalWithDefault = NOT NULL with a default; nullable = the column accepts NULL).
 * Validation stops malformed HTTP input before it reaches the database; the
 * DB's own constraint errors are translated separately in errors/pg.js.
 */

const uuid = () => z.uuid("must be a valid UUID")
const optionalText = (max) => z.string().trim().max(max).nullish()
const optionalInt = () => z.number().int().min(0).nullish()

export const propertyIdSchema = z.object({
  id: uuid(),
})

export const createPropertySchema = z.object({
  title: z.string().trim().min(1, "title is required").max(200),
  slug: z
    .string()
    .trim()
    .min(1, "slug is required")
    .max(200)
    .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/i, "slug must be URL-friendly"),
  description: optionalText(10_000),
  purpose: z.enum(["SALE", "RENT"]).optional(), // DB default: SALE
  propertyType: z.enum(["VILLA", "APARTMENT", "PENTHOUSE", "DUPLEX"]),
  status: z
    .enum(["AVAILABLE", "PENDING", "SOLD", "RENTED", "DRAFT"])
    .optional(), // DB default: AVAILABLE
  price: z
    .number()
    .int("price must be an integer")
    .min(0, "price cannot be negative"),
  currency: z.string().trim().min(1).max(3).optional(), // DB default: SAR
  bedrooms: z.number().int().min(0).optional(), // DB default: 0
  bathrooms: z.number().int().min(0).optional(), // DB default: 0
  area: optionalInt(),
  city: z.string().trim().min(1, "city is required").max(200),
  district: optionalText(200),
  address: optionalText(400),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  featured: z.boolean().optional(), // DB default: false
  agentId: uuid().nullish(),
  neighborhoodId: uuid().nullish(),
  // Phase 09 — admin property management: images + amenity names are written
  // transactionally with the property row (service layer responsibility).
  // `amenities` are NAMES which get resolved/upserted into the amenities
  // table; `images` replace the property's existing image set.
  images: z
    .array(
      z
        .object({
          url: z.string().trim().min(1, "image url is required").max(2_000),
          altText: z.string().trim().max(500).nullish(),
          displayOrder: z.number().int().min(0).optional(),
          isCover: z.boolean().optional(),
        })
        .strict(),
    )
    .max(30, "at most 30 images per property")
    .optional(),
  amenities: z
    .array(z.string().trim().min(1).max(80, "amenity names are truncated"))
    .max(40, "at most 40 amenities per property")
    .optional(),
})

export const updatePropertySchema = createPropertySchema.partial()

/** Rejects an update that contains no property fields at all. */
export function assertNonEmptyPatch(parsed) {
  return Object.keys(parsed).length > 0
}

// ── Phase 04: list/query parameters ──────────────────────────────────────
// Coerces are necessary: Express query strings arrive as strings, so
// `?page=2` must become the integer 2. Absent or empty (`?page=`) values
// collapse to undefined; genuinely invalid strings (`?page=abc`) fail →
// 422 INVALID_QUERY. The inner `.optional()` lets a preprocessed empty
// string through while the number schema still rejects real junk.

export function intParam(message, { min = 0, max } = {}) {
  let inner = z.coerce.number({ error: message }).int(message).min(min, message)
  if (max !== undefined) inner = inner.max(max, message)
  return z.preprocess(
    (value) => (value === "" ? undefined : value),
    inner.optional(),
  )
}

export const propertySortEnum = z.enum([
  "featured",
  "newest",
  "price-asc",
  "price-desc",
])

export const propertyQuerySchema = z
  .object({
    purpose: z.enum(["SALE", "RENT"]).optional(),
    propertyType: z
      .enum(["VILLA", "APARTMENT", "PENTHOUSE", "DUPLEX"])
      .optional(),
    city: optionalText(200),
    district: optionalText(200),
    minPrice: intParam("minPrice must be a non-negative integer"),
    maxPrice: intParam("maxPrice must be a non-negative integer"),
    minBedrooms: intParam("minBedrooms must be a non-negative integer"),
    minBathrooms: intParam("minBathrooms must be a non-negative integer"),
    search: z
      .string()
      .trim()
      .min(1, "search cannot be empty")
      .max(200)
      .optional(),
    sort: propertySortEnum.default("featured"),
    page: intParam("page must be a positive integer", { min: 1 }).default(1),
    limit: intParam("limit must be an integer between 1 and 50", {
      min: 1,
      max: 50,
    }).default(12),
  })
  // Unknown keys are rejected so typos (`minprice`, `bedrooms`) are surfaced
  // instead of silently ignored.
  .strict()
  // Cross-checks: a price range must be ordered.
  .refine(
    (q) =>
      q.minPrice === undefined ||
      q.maxPrice === undefined ||
      q.minPrice <= q.maxPrice,
    {
      message: "minPrice cannot be greater than maxPrice",
      path: ["minPrice"],
    },
  )
