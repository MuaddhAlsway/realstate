import type { Agent, Property, ViewingRequest } from "../data/properties"
import { mediaUrl } from "./media"

/**
 * Public image delivery width. Res.cloudinary.com URLs get w_<this>,q_auto,
 * f_auto; legacy free-form URLs pass through untouched.
 */
const PUBLIC_IMAGE_WIDTH = 1280

function formatPrice(n: number): string {
  if (n >= 1_000_000) return `SAR ${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `SAR ${(n / 1_000).toFixed(0)}K`
  return `SAR ${n}`
}

function mapStatus(raw: string | undefined): Property["status"] {
  switch (raw) {
    case "AVAILABLE":
      return "available"
    case "PENDING":
    case "DRAFT":
      return "new"
    case "SOLD":
    case "RENTED":
      return "under-contract"
    default:
      return "available"
  }
}

const TYPE_TO_FRONTEND: Record<string, Property["type"]> = {
  VILLA: "villa",
  APARTMENT: "apartment",
  PENTHOUSE: "penthouse",
  DUPLEX: "duplex",
}

export function mapProperty(value: unknown): Property {
  const w = value as Record<string, unknown>
  if (
    typeof w?.name === "string" &&
    typeof w?.title !== "string" &&
    typeof w?.priceNum === "number"
  ) {
    return w as unknown as Property
  }
  const wireImages = Array.isArray(w?.images)
    ? (w.images as Array<{ url?: string } | string>).map((img) =>
        typeof img === "string" ? img : img?.url ?? "",
      )
    : []
  const images = wireImages
    .filter(Boolean)
    .map((src) => mediaUrl(src, { width: PUBLIC_IMAGE_WIDTH }))
  const cover = mediaUrl(
    (w?.coverImage as string) ?? wireImages[0] ?? "",
    { width: PUBLIC_IMAGE_WIDTH },
  )
  const year =
    typeof w?.createdAt === "string"
      ? Number(w.createdAt.slice(0, 4)) || 2025
      : 2025
  const neighborhoodRaw = w?.neighborhood as
    | { name?: string }
    | string
    | null
    | undefined
  const neighborhood =
    typeof neighborhoodRaw === "object" && neighborhoodRaw !== null
      ? neighborhoodRaw.name ?? ""
      : typeof neighborhoodRaw === "string"
        ? neighborhoodRaw
        : ""
  return {
    id: String(w?.id ?? ""),
    name: String(w?.title ?? ""),
    location: (w?.district as string) ?? (w?.city as string) ?? "",
    neighborhood,
    city: (w?.city as string) ?? "",
    price: formatPrice(Number(w?.price ?? 0)),
    priceNum: Number(w?.price ?? 0),
    type: TYPE_TO_FRONTEND[String(w?.propertyType ?? "")]
      ?? ("villa" as Property["type"]),
    listingType: w?.purpose === "RENT" ? "rent" : "buy",
    beds: Number(w?.bedrooms ?? 0),
    baths: Number(w?.bathrooms ?? 0),
    area: Number(w?.area ?? 0),
    image: cover,
    images,
    description: String(w?.description ?? ""),
    amenities: Array.isArray(w?.amenities)
      ? (w.amenities as string[])
      : [],
    status: mapStatus(w?.status as string | undefined),
    year,
    agentId: (w?.agent as { id?: string } | null | undefined)?.id ?? "",
  }
}

export function mapAgent(value: unknown): Agent {
  const w = value as Record<string, unknown>
  if (w && typeof w?.experience === "number") return w as unknown as Agent
  return {
    id: String(w?.id ?? ""),
    name: String(w?.name ?? ""),
    role: String(w?.role ?? "Agent"),
    languages: "",
    experience: Number((w as { experienceYears?: unknown })?.experienceYears ?? 0),
    properties: 0,
    image: (w?.imageUrl as string) ?? "",
    phone: (w?.phone as string) ?? "",
    email: (w?.email as string) ?? "",
  }
}

export function mapViewing(value: unknown): ViewingRequest {
  const w = value as Record<string, unknown>
  if (typeof w?.propertyId === "string" && typeof w?.name === "string") {
    return w as unknown as ViewingRequest
  }
  const requester = (w?.requester ?? null) as
    | { id?: string, name?: string, email?: string }
    | null
  const agent = (w?.agent ?? null) as
    | { id?: string, name?: string, phone?: string }
    | null
  const property = (w?.property ?? null) as { id?: string, title?: string } | null
  return {
    id: String(w?.id ?? ""),
    propertyId: property?.id ?? "",
    propertyName: property?.title ?? undefined,
    // The requester is the person who made the request; prefer them over the
    // property's assigned agent for the human-facing name/contact fields.
    name: requester?.name ?? agent?.name ?? "",
    email: requester?.email ?? "",
    phone: agent?.phone ?? "",
    date: String(w?.date ?? ""),
    time: (w?.time as string | null | undefined) ?? null,
    message: (w?.message as string | undefined) ?? undefined,
    status: (w?.status as string | undefined) ?? undefined,
    createdAt: String(w?.createdAt ?? ""),
  }
}

export function mapPropertyList(values: unknown[]): Property[] {
  return values.map(mapProperty)
}

export function mapViewingList(values: unknown[]): ViewingRequest[] {
  return values.map(mapViewing)
}