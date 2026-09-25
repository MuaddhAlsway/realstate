import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { sql } from "drizzle-orm"
import { getDb, hasDatabase, closeDatabase } from "./index.js"
import {
  neighborhoods as neighborhoodTable,
  amenities as amenityTable,
  users as userTable,
  agents as agentTable,
  properties as propertyTable,
  propertyImages as propertyImagesTable,
  propertyAmenities as propertyAmenitiesTable,
  siteContent as siteContentTable,
} from "./schema/index.js"
import { hashPassword } from "../auth/password.js"
import { DEFAULT_CONTENT, CONTENT_SECTIONS } from "../content/defaults.js"

/**
 * Development seed: replays the existing design dataset
 * (shared/estate-data.json) into PostgreSQL. Idempotent — re-running is
 * safe (ON CONFLICT DO NOTHING). Wrapped in one transaction.
 *
 * The seed does not replace the frontend mock data; it exists to support
 * Phase 03 development against a real database.
 */

const DATA_PATH = fileURLToPath(
  new URL("../../../shared/estate-data.json", import.meta.url),
)

/** Deterministic UUID v4 from a stable tag (re-seed safe, readable logs). */
function stableUuid(tag) {
  const hex = createHash("sha256").update(tag).digest("hex").slice(0, 32)
  const high = (parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80
  return (
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-` +
    `${high.toString(16).padStart(2, "0")}${hex.slice(18, 20)}-${hex.slice(20, 32)}`
  )
}

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

const PROPERTY_STATUS = (s) =>
  ({ available: "AVAILABLE", "under-contract": "PENDING", new: "AVAILABLE" })[
    s
  ] || "AVAILABLE"
const PURPOSE = { buy: "SALE", rent: "RENT" }

if (!hasDatabase()) {
  console.error("Seed requires DATABASE_URL in .env (see .env.example).")
  process.exit(1)
}

const db = getDb()
const data = JSON.parse(readFileSync(DATA_PATH, "utf8"))

const neighborhoods = data.neighborhoods.map((n) => ({
  id: stableUuid(`hood:${n.id}`),
  name: n.name,
  slug: slugify(n.name),
  tagline: n.tagline,
  description: n.description,
  imageUrl: n.image,
  avgPrice: n.avgPriceNum,
  lat: n.coordinates[0],
  lng: n.coordinates[1],
}))

const agents = data.agents.map((a) => ({
  id: stableUuid(`agent:${a.id}`),
  name: a.name,
  role: a.role,
  languages: a.languages,
  experienceYears: a.experience,
  phone: a.phone,
  email: a.email,
  imageUrl: a.image,
}))

const amenityNames = [...new Set(data.properties.flatMap((p) => p.amenities))]
const amenities = amenityNames.map((name) => ({
  id: stableUuid(`amenity:${name}`),
  name,
  category: "general",
}))

const properties = data.properties.map((p) => {
  const hood =
    data.neighborhoods.find((n) => n.name === p.neighborhood) ??
    data.neighborhoods[0]
  return {
    id: stableUuid(`property:${p.id}`),
    title: p.name,
    slug: slugify(p.name),
    description: p.description,
    purpose: PURPOSE[p.listingType],
    propertyType: p.type.toUpperCase(),
    status: PROPERTY_STATUS(p.status),
    price: p.priceNum,
    currency: "SAR",
    bedrooms: p.beds,
    bathrooms: p.baths,
    area: p.area,
    city: p.city,
    district: p.location,
    neighborhoodId: stableUuid(`hood:${hood.id}`),
    agentId: stableUuid(`agent:${p.agentId}`),
  }
})

const propertyImages = data.properties.flatMap((p) => {
  const pid = stableUuid(`property:${p.id}`)
  const all = [p.image, ...p.images].filter((u, i, arr) => arr.indexOf(u) === i)
  return all.map((url, i) => ({
    id: stableUuid(`image:${p.id}:${i}`),
    propertyId: pid,
    url,
    publicId: null,
    altText: p.name,
    displayOrder: i,
    isCover: i === 0,
  }))
})

const propertyAmenities = data.properties.flatMap((p) =>
  p.amenities.map((name) => ({
    propertyId: stableUuid(`property:${p.id}`),
    amenityId: stableUuid(`amenity:${name}`),
  })),
)

// Phase 05 — two demo accounts with real Argon2 (argon2id) hashes so the
// auth API works end-to-end from a fresh seed. Phase 10 — the ADMIN password
// comes from SEED_ADMIN_PASSWORD (production requires it; development falls
// back to a clearly-named dev-only default). Run `pnpm db:seed` to apply.
import { SEED_ADMIN_PASSWORD } from "../config/env.js"

if (!SEED_ADMIN_PASSWORD) {
  console.error(
    "Seed requires SEED_ADMIN_PASSWORD in production (set it explicitly, never commit it).",
  )
  process.exit(1)
}

const DEMO_ACCOUNTS = [
  {
    id: "user:admin",
    name: "Site Administrator",
    email: "admin@estate.sa",
    password: SEED_ADMIN_PASSWORD,
    role: "ADMIN",
  },
  {
    id: "user:demo",
    name: "Demo User",
    email: "demo@estate.sa",
    password: "Estate-Demo-2026!",
    role: "USER",
  },
]

const demoUsers = []
for (const account of DEMO_ACCOUNTS) {
  demoUsers.push({
    id: stableUuid(account.id),
    name: account.name,
    email: account.email,
    passwordHash: await hashPassword(account.password),
    role: account.role,
  })
}

// Link the admin account to the first agent to exercise the 1:1 relation.
const adminUser = demoUsers.find((user) => user.role === "ADMIN")
const seededAgents = structuredClone(agents)
seededAgents[0].userId = adminUser.id

try {
  await db.transaction(async (tx) => {
    await tx
      .insert(neighborhoodTable)
      .values(neighborhoods)
      .onConflictDoNothing()
    await tx.insert(amenityTable).values(amenities).onConflictDoNothing()
    // Refresh demo password hashes on re-seed (dev convenience) but keep the
    // stable ids/roles; no real user rows exist yet.
    await tx
      .insert(userTable)
      .values(demoUsers)
      .onConflictDoUpdate({
        target: userTable.email,
        set: { passwordHash: sql`excluded.password_hash` },
      })
    await tx.insert(agentTable).values(seededAgents).onConflictDoNothing()
    await tx.insert(propertyTable).values(properties).onConflictDoNothing()
    await tx
      .insert(propertyImagesTable)
      .values(propertyImages)
      .onConflictDoNothing()
    await tx
      .insert(propertyAmenitiesTable)
      .values(propertyAmenities)
      .onConflictDoNothing()
    // Phase 09 — CMS: seed the shipped marketing copy as the first
    // publishable content so local/test databases render the original site.
    await tx
      .insert(siteContentTable)
      .values(
        CONTENT_SECTIONS.flatMap((section) =>
          Object.entries(DEFAULT_CONTENT[section]).map(([key, value]) => ({
            section,
            key,
            value,
          })),
        ),
      )
      .onConflictDoNothing()
  })
  console.log(
    `seed ok: ${neighborhoods.length} neighborhoods, ${agents.length} agents, ` +
      `${properties.length} properties, ${amenities.length} amenities, ` +
      `${propertyImages.length} images, ${propertyAmenities.length} links, ` +
      `${CONTENT_SECTIONS.length} content sections`,
  )
} catch (err) {
  console.error("seed failed — transaction rolled back:", err)
  process.exitCode = 1
} finally {
  await closeDatabase()
}
