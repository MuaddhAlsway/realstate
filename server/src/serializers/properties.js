/**
 * Property serializers — the clean boundary between the database
 * representation (snake_case drizzle rows + nested relations) and the API
 * representation (camelCase resources the frontend can consume).
 *
 * Important mappings vs. the existing React `Property` model
 * (src/data/properties.ts) — these converge in a later frontend phase:
 *
 *   API field        DB column         frontend Property
 *   ─────────        ─────────         ─────────────────
 *   title            title             name
 *   propertyType     property_type     type (lowercased)
 *   purpose          purpose           listingType (SALE→buy, RENT→rent)
 *   price            price             priceNum
 *   district         district          location
 *   neighborhood.id  neighborhood_id   neighborhood (name string)
 *   bedrooms         bedrooms          beds
 *   bathrooms        bathrooms         baths
 *   images[].url     property_images   image / images[]
 *   amenities[]      amenity names     amenities[]
 *
 * The service/database layer stays database-shaped; only this module knows
 * about the wire format.
 */

function toIso(value) {
  return value instanceof Date ? value.toISOString() : (value ?? null)
}

function serializeImages(images = []) {
  return images.map((img) => ({
    id: img.id,
    url: img.url,
    publicId: img.publicId ?? null,
    altText: img.altText ?? null,
    displayOrder: img.displayOrder,
    isCover: img.isCover,
  }))
}

/** Lightweight listing entry — relations reduced to what a grid can use. */
export function serializePropertySummary(row) {
  const urls = row.images?.map((img) => img.url) ?? []
  const cover = row.images?.find((img) => img.isCover)?.url ?? urls[0] ?? null
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    purpose: row.purpose,
    propertyType: row.propertyType,
    status: row.status,
    price: row.price,
    currency: row.currency,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    area: row.area ?? null,
    city: row.city,
    district: row.district ?? null,
    featured: row.featured,
    coverImage: cover,
    images: urls,
    imageCount: urls.length,
    neighborhood: row.neighborhood
      ? {
          id: row.neighborhood.id,
          name: row.neighborhood.name,
          slug: row.neighborhood.slug,
        }
      : null,
    agent: row.agent ? { id: row.agent.id, name: row.agent.name } : null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  }
}

/** Full resource — used for detail responses and after writes. */
export function serializePropertyDetail(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description ?? null,
    purpose: row.purpose,
    propertyType: row.propertyType,
    status: row.status,
    price: row.price,
    currency: row.currency,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    area: row.area ?? null,
    city: row.city,
    district: row.district ?? null,
    address: row.address ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    featured: row.featured,
    images: serializeImages(row.images),
    amenities:
      row.propertyAmenities
        ?.map((pa) => pa.amenity?.name)
        .filter(Boolean)
        .sort() ?? [],
    neighborhood: row.neighborhood
      ? {
          id: row.neighborhood.id,
          name: row.neighborhood.name,
          slug: row.neighborhood.slug,
          tagline: row.neighborhood.tagline ?? null,
          description: row.neighborhood.description ?? null,
          imageUrl: row.neighborhood.imageUrl ?? null,
        }
      : null,
    agent: row.agent
      ? {
          id: row.agent.id,
          name: row.agent.name,
          role: row.agent.role ?? null,
          email: row.agent.email ?? null,
          phone: row.agent.phone ?? null,
          imageUrl: row.agent.imageUrl ?? null,
          experienceYears: row.agent.experienceYears,
        }
      : null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  }
}

export function serializePropertyList(rows) {
  return rows.map(serializePropertySummary)
}
