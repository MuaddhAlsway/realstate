import { z } from "zod"
import { CONTENT_SECTIONS } from "../content/defaults.js"

/**
 * Per-section content validation (Phase 09 — Admin CMS).
 *
 * Every section is a strictly-shaped object: only the fields listed here
 * can be stored, every string is trimmed + bounded, arrays carry their own
 * item schemas. `.strict()` rejects unknown keys (e.g. a typo'd `heroTitle`)
 * so the CMS can never be polluted by arbitrary fields. The public read
 * path is bounded by the same sets as the admin write path.
 */

const text = (max = 10_000) => z.string().trim().max(max)
const url = () => text(2_000)
const link = () => z.object({ label: text(200), href: text(500) })
const numbered = () =>
  z.object({
    num: text(20),
    title: text(300),
    text: text(3_000),
  })
const stat = () =>
  z.object({
    label: text(200),
    sub: text(200),
    prefix: text(50),
    suffix: text(50),
    val: z.number(),
    decimals: z.number().int().min(0).max(4),
  })

export const CONTENT_SCHEMAS = Object.freeze({
  home: z
    .object({
      heroEyebrow: text(300),
      heroLine1: text(300),
      heroLine2: text(300),
      heroLine3: text(300),
      heroDescription: text(2_000),
      heroImage: url(),
      heroImageAlt: text(500),
      showcaseEyebrow: text(300),
      showcaseHint: text(300),
      featuredEyebrow: text(300),
      featuredTitle: text(500),
      featuredCta: text(200),
      discoveryEyebrow: text(300),
      discoveryTitle: text(500),
      stats: z.array(stat()).min(1).max(8),
      whyUsEyebrow: text(300),
      whyUsTitle: text(500),
      whyUs: z.array(numbered()).max(12),
      archStatement: text(500),
      ctaEyebrow: text(300),
      ctaTitle: text(500),
      ctaPrimaryLabel: text(200),
      ctaSecondaryLabel: text(200),
    })
    .strict(),
  about: z
    .object({
      eyebrow: text(300),
      heading: text(500),
      intro: text(3_000),
      body1: text(3_000),
      body2: text(3_000),
      image: url(),
      imageAlt: text(500),
      valuesEyebrow: text(300),
      values: z.array(numbered()).max(12),
      teamEyebrow: text(300),
      ctaTitle: text(500),
      ctaPrimaryLabel: text(200),
      ctaSecondaryLabel: text(200),
    })
    .strict(),
  contact: z
    .object({
      eyebrow: text(300),
      heading: text(500),
      officesEyebrow: text(300),
      officeName: text(300),
      addressLines: z.array(text(300)).max(8),
      directEyebrow: text(300),
      salesLabel: text(200),
      salesPhone: text(100),
      emailLabel: text(200),
      email: text(300),
      hoursEyebrow: text(300),
      hoursLines: z.array(text(300)).max(8),
      successTitle: text(300),
      successText: text(1_000),
      sendAnotherLabel: text(200),
    })
    .strict(),
  footer: z
    .object({
      brandName: text(200),
      tagline: text(2_000),
      propertiesTitle: text(200),
      companyTitle: text(200),
      contactTitle: text(200),
      addressLines: z.array(text(300)).max(8),
      phone: text(100),
      email: text(300),
      newsletterTitle: text(200),
      newsletterPlaceholder: text(200),
      socials: z.array(link()).max(12),
      propertyLinks: z.array(link()).max(12),
      companyLinks: z.array(link()).max(12),
      legalLinks: z.array(link()).max(12),
      copyright: text(300),
    })
    .strict(),
  seo: z
    .object({
      title: text(300),
      description: text(1_000),
      ogTitle: text(300),
      ogDescription: text(1_000),
    })
    .strict(),
})

export const contentSectionParamSchema = z.object({
  section: z.enum(CONTENT_SECTIONS),
})

export function assertSection(name) {
  return CONTENT_SCHEMAS[name] !== undefined
}