/**
 * CMS content registry + defaults (Phase 09 — Admin CMS).
 *
 * Defaults mirror the marketing copy the site shipped with, so a brand-new
 * database where the admin has not published content still renders the
 * original site. The admin write path validates sections against
 * per-section Zod schemas (schemas/content.js), so only these known
 * sections and exactly these keys can ever be stored. Sections are
 * stored as one row per `key` (section, key, value jsonb) — strings,
 * numbers and arrays all serialize cleanly and a strict schema per
 * section keeps the model safe and searchable.
 */

export const CONTENT_SECTIONS = ["home", "about", "contact", "footer", "seo"]

export const DEFAULT_CONTENT = {
  home: {
    heroEyebrow: "Jeddah · Saudi Arabia · Est. 2012",
    heroLine1: "Find a place",
    heroLine2: "worth calling",
    heroLine3: "home.",
    heroDescription:
      "Over 250 curated residences in Jeddah's most sought-after addresses.",
    heroImage:
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1920&h=1200&fit=crop&auto=format",
    // Provider asset id for the managed hero image ("" when using a plain URL).
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
      {
        label: "Premium Properties",
        sub: "across Jeddah",
        prefix: "",
        suffix: "+",
        val: 250,
        decimals: 0,
      },
      {
        label: "Neighborhoods",
        sub: "covered",
        prefix: "",
        suffix: "",
        val: 18,
        decimals: 0,
      },
      {
        label: "Years Experience",
        sub: "in luxury real estate",
        prefix: "",
        suffix: "+",
        val: 12,
        decimals: 0,
      },
      {
        label: "Property Value",
        sub: "SAR, managed",
        prefix: "SAR ",
        suffix: "B+",
        val: 1.2,
        decimals: 1,
      },
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
    addressLines: [
      "Al Shati District",
      "King Abdulaziz Road",
      "Jeddah, Saudi Arabia 23434",
    ],
    directEyebrow: "Direct",
    salesLabel: "Sales",
    salesPhone: "+966 12 345 6789",
    emailLabel: "Email",
    email: "hello@estate.sa",
    hoursEyebrow: "Hours",
    hoursLines: ["Sunday – Thursday", "9:00 AM – 6:00 PM"],
    successTitle: "Thank you.",
    successText:
      "We've received your message and will be in touch within 24 hours.",
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
