import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { contentApi, type ContentSectionName } from "./admin"
import { REMOTE } from "./http"

/**
 * Site-content context (Phase 09 — CMS).
 *
 * The public site renders CMS content fetched once from GET /api/v1/content
 * with built-in copy as the documented fallback. Three states are possible:
 *  1. Remote + published sections  → DB values override the defaults.
 *  2. Remote + never published     → DB returns {} for a section → defaults.
 *  3. Local/preview (no API_BASE)  → defaults render unchanged.
 * Merging is per key so a partial publish can never blank a section.
 */

interface StatItem {
  label: string
  sub: string
  prefix: string
  suffix: string
  val: number
  decimals: number
}

interface NumberedItem {
  num: string
  title: string
  text: string
}

interface LinkItem {
  label: string
  href: string
}

export interface HomeContent {
  heroEyebrow: string
  heroLine1: string
  heroLine2: string
  heroLine3: string
  heroDescription: string
  heroImage: string
  // Provider asset id for media-uploaded heroes (private; "" for URLs).
  heroImagePublicId?: string
  heroImageAlt: string
  showcaseEyebrow: string
  showcaseHint: string
  featuredEyebrow: string
  featuredTitle: string
  featuredCta: string
  discoveryEyebrow: string
  discoveryTitle: string
  stats: StatItem[]
  whyUsEyebrow: string
  whyUsTitle: string
  whyUs: NumberedItem[]
  archStatement: string
  ctaEyebrow: string
  ctaTitle: string
  ctaPrimaryLabel: string
  ctaSecondaryLabel: string
}

export interface AboutContent {
  eyebrow: string
  heading: string
  intro: string
  body1: string
  body2: string
  image: string
  // Provider asset id for media-uploaded about images ("" for URLs).
  imagePublicId?: string
  imageAlt: string
  valuesEyebrow: string
  values: NumberedItem[]
  teamEyebrow: string
  ctaTitle: string
  ctaPrimaryLabel: string
  ctaSecondaryLabel: string
}

export interface ContactContent {
  eyebrow: string
  heading: string
  officesEyebrow: string
  officeName: string
  addressLines: string[]
  directEyebrow: string
  salesLabel: string
  salesPhone: string
  emailLabel: string
  email: string
  hoursEyebrow: string
  hoursLines: string[]
  successTitle: string
  successText: string
  sendAnotherLabel: string
}

export interface FooterContent {
  brandName: string
  tagline: string
  propertiesTitle: string
  companyTitle: string
  contactTitle: string
  addressLines: string[]
  phone: string
  email: string
  newsletterTitle: string
  newsletterPlaceholder: string
  socials: LinkItem[]
  propertyLinks: LinkItem[]
  companyLinks: LinkItem[]
  legalLinks: LinkItem[]
  copyright: string
}

export interface SeoContent {
  title: string
  description: string
  ogTitle: string
  ogDescription: string
}

export interface SiteContent {
  home: HomeContent
  about: AboutContent
  contact: ContactContent
  footer: FooterContent
  seo: SeoContent
}

export const CONTENT_DEFAULTS: SiteContent = {
  home: {
    heroEyebrow: "Jeddah · Saudi Arabia · Est. 2012",
    heroLine1: "Find a place",
    heroLine2: "worth calling",
    heroLine3: "home.",
    heroDescription:
      "Over 250 curated residences in Jeddah's most sought-after addresses.",
    heroImage:
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1920&h=1200&fit=crop&auto=format",
    heroImagePublicId: "",
    heroImageAlt: "A modern coastal villa at dusk on the Jeddah waterfront",
    showcaseEyebrow: "Explore Exceptional Homes",
    showcaseHint: "Scroll or drag to explore",
    featuredEyebrow: "Selected Residences",
    featuredTitle: "Exceptional properties, curated for you.",
    featuredCta: "View all",
    discoveryEyebrow: "Property Discovery",
    discoveryTitle: "What are you looking for today?",
    stats: [
      { label: "Premium Properties", sub: "across Jeddah", prefix: "", suffix: "+", val: 250, decimals: 0 },
      { label: "Neighborhoods", sub: "covered", prefix: "", suffix: "", val: 18, decimals: 0 },
      { label: "Years Experience", sub: "in luxury real estate", prefix: "", suffix: "+", val: 12, decimals: 0 },
      { label: "Property Value", sub: "SAR, managed", prefix: "SAR ", suffix: "B+", val: 1.2, decimals: 1 },
    ],
    whyUsEyebrow: "Our Approach",
    whyUsTitle: "Why discerning clients choose Estate.",
    whyUs: [
      {
        num: "01",
        title: "Curated Properties",
        text: "We represent fewer than 5% of properties listed — only those that meet our exacting standard for architecture, location, and lifestyle.",
      },
      {
        num: "02",
        title: "Local Expertise",
        text: "Over a decade embedded in Jeddah's luxury market. We understand every neighborhood, every developer, and every opportunity.",
      },
      {
        num: "03",
        title: "Verified Listings",
        text: "Every property is personally verified by our team. What you see is exactly what you get — no exceptions.",
      },
      {
        num: "04",
        title: "Investment Guidance",
        text: "Strategic advice backed by market data and decades of transactional experience across Saudi Arabia's most valuable asset classes.",
      },
      {
        num: "05",
        title: "Private Viewings",
        text: "Exclusive after-hours and private access. No open houses, no crowded visits — just you, the property, and complete discretion.",
      },
    ],
    archStatement: "Architecture shapes the way we live.",
    ctaEyebrow: "Begin",
    ctaTitle: "Your next chapter starts here.",
    ctaPrimaryLabel: "Explore Properties",
    ctaSecondaryLabel: "Speak With an Advisor",
  },

  about: {
    eyebrow: "Who We Are",
    heading: "About Estate",
    intro:
      "Since 2012, we have been Jeddah's most trusted name in luxury real estate — not by volume, but by the singular standard we hold every property and every client relationship to.",
    body1:
      "Estate was founded on a singular belief: that exceptional properties deserve exceptional representation. We are not a marketplace — we are curators, advisors, and advocates.",
    body2:
      "Our team combines deep local knowledge with international perspectives, allowing us to serve clients from across Saudi Arabia and the world with the same precision and discretion.",
    image:
      "https://images.unsplash.com/photo-1502005097973-6a7082348e28?w=1920&h=700&fit=crop&auto=format",
    imagePublicId: "",
    imageAlt: "Estate office architecture",
    valuesEyebrow: "Our Values",
    values: [
      {
        num: "01",
        title: "Curation",
        text: "We select fewer than 5% of available properties — only those meeting our exacting criteria for architecture, location, and living quality.",
      },
      {
        num: "02",
        title: "Discretion",
        text: "Every transaction is conducted with absolute confidentiality. Our clients' privacy is never a variable.",
      },
      {
        num: "03",
        title: "Expertise",
        text: "Over twelve years, hundreds of transactions, and a team with careers dedicated entirely to the luxury segment.",
      },
    ],
    teamEyebrow: "The Team",
    ctaTitle: "Ready to find your perfect home?",
    ctaPrimaryLabel: "Browse Properties",
    ctaSecondaryLabel: "Contact Us",
  },

  contact: {
    eyebrow: "Reach Out",
    heading: "Let's talk",
    officesEyebrow: "Offices",
    officeName: "Jeddah HQ",
    addressLines: ["Al Shati District", "King Abdulaziz Road", "Jeddah, Saudi Arabia 23434"],
    directEyebrow: "Direct",
    salesLabel: "Sales",
    salesPhone: "+966 12 345 6789",
    emailLabel: "Email",
    email: "hello@estate.sa",
    hoursEyebrow: "Hours",
    hoursLines: ["Sunday – Thursday", "9:00 AM – 6:00 PM"],
    successTitle: "Thank you.",
    successText: "We've received your message and will be in touch within 24 hours.",
    sendAnotherLabel: "Send another →",
  },

  footer: {
    brandName: "Estate",
    tagline:
      "Curating exceptional properties for discerning buyers and investors across Saudi Arabia.",
    propertiesTitle: "Properties",
    companyTitle: "Company",
    contactTitle: "Contact",
    addressLines: ["Al Shati District, Jeddah", "Saudi Arabia 23434"],
    phone: "+966 12 345 6789",
    email: "hello@estate.sa",
    newsletterTitle: "Newsletter",
    newsletterPlaceholder: "Your email",
    socials: [
      { label: "Instagram", href: "#" },
      { label: "LinkedIn", href: "#" },
      { label: "YouTube", href: "#" },
    ],
    propertyLinks: [
      { label: "Buy", href: "/properties?type=buy" },
      { label: "Rent", href: "/properties?type=rent" },
      { label: "All Properties", href: "/properties" },
      { label: "Neighborhoods", href: "/neighborhoods" },
      { label: "Saved", href: "/saved" },
    ],
    companyLinks: [
      { label: "About", href: "/about" },
      { label: "Agents", href: "/agents" },
      { label: "Contact", href: "/contact" },
      { label: "Dashboard", href: "/dashboard" },
    ],
    legalLinks: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
      { label: "Cookies", href: "#" },
    ],
    copyright: "© 2026 Estate Real Estate. All rights reserved.",
  },

  seo: {
    title: "Estate — Luxury Real Estate in Jeddah",
    description:
      "Curated residences across Jeddah's most sought-after addresses. Buy, rent and explore luxury properties with Estate — Saudi Arabia's trusted name since 2012.",
    ogTitle: "Estate — Luxury Real Estate in Jeddah",
    ogDescription:
      "Curated residences across Jeddah's most sought-after addresses. Buy, rent and explore luxury properties with Estate — Saudi Arabia's trusted name since 2012.",
  },
}

const SECTION_NAMES: ContentSectionName[] = [
  "home",
  "about",
  "contact",
  "footer",
  "seo",
]

/** Deep, per-key merge preserving the fallbacks for any missing value. */
function mergeSection<T extends object>(
  fallback: T,
  remote: Record<string, unknown> | undefined,
): T {
  if (!remote || typeof remote !== "object") return fallback
  const merged = { ...fallback } as Record<string, unknown>
  for (const key of Object.keys(remote)) {
    const remoteValue = remote[key]
    const fallbackValue = merged[key]
    if (Array.isArray(remoteValue)) {
      merged[key] = remoteValue
    } else if (
      fallbackValue !== null &&
      typeof fallbackValue === "object" &&
      typeof remoteValue === "object"
    ) {
      merged[key] = { ...(fallbackValue as Record<string, unknown>), ...(remoteValue as Record<string, unknown>) }
    } else if (remoteValue !== undefined) {
      merged[key] = remoteValue
    }
  }
  return merged as T
}

interface SiteContentContextValue {
  content: SiteContent
  loading: boolean
}

const SiteContentContext = createContext<SiteContentContextValue>({
  content: CONTENT_DEFAULTS,
  loading: false,
})

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [remote, setRemote] = useState<Partial<Record<ContentSectionName, Record<string, unknown>>> | null>(null)
  const [loading, setLoading] = useState(REMOTE)

  useEffect(() => {
    if (!REMOTE) {
      setLoading(false)
      return
    }
    let cancelled = false
    contentApi
      .all()
      .then((sections) => {
        if (cancelled) return
        setRemote(sections ?? {})
      })
      .catch(() => {
        /* network/CMS unavailable — the built-in defaults carry the site */
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<SiteContentContextValue>(() => {
    const content = CONTENT_DEFAULTS
    for (const name of SECTION_NAMES) {
      const incoming = remote?.[name]
      if (!incoming) continue
      if (name === "home") {
        content.home = mergeSection(content.home, incoming)
      } else if (name === "about") {
        content.about = mergeSection(content.about, incoming)
      } else if (name === "contact") {
        content.contact = mergeSection(content.contact, incoming)
      } else if (name === "footer") {
        content.footer = mergeSection(content.footer, incoming)
      } else if (name === "seo") {
        content.seo = mergeSection(content.seo, incoming)
      }
    }
    return { content, loading }
  }, [remote, loading])

  useEffect(() => {
    if (!REMOTE) return
    const title = value.content.seo?.title
    if (title) document.title = title
  }, [value.content])

  return (
    <SiteContentContext.Provider value={value}>
      {children}
    </SiteContentContext.Provider>
  )
}

export function useSiteContent(): SiteContentContextValue {
  return useContext(SiteContentContext)
}