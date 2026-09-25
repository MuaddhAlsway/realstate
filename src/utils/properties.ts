import type { Property } from "../data/properties"

export interface PropertyQuery {
  type?: "buy" | "rent"
  q?: string
  neighborhood?: string
  city?: string
  beds?: string
  propType?: string
  maxPrice?: string
  sort?: "featured" | "price-asc" | "price-desc" | "newest"
}

/** Shared with /server — keep server-side authoritative. */
export function applyPropertyFilters(
  list: Property[],
  query: PropertyQuery = {},
): Property[] {
  let result = [...list]

  if (query.type) result = result.filter((p) => p.listingType === query.type)

  if (query.q) {
    const q = query.q.trim().toLowerCase()
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.neighborhood.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q),
    )
  }

  if (query.neighborhood) {
    result = result.filter(
      (p) => p.neighborhood.toLowerCase() === query.neighborhood!.toLowerCase(),
    )
  }

  if (query.city) {
    result = result.filter(
      (p) => p.city.toLowerCase() === query.city!.toLowerCase(),
    )
  }

  if (query.beds && query.beds !== "any") {
    const min = parseInt(query.beds, 10)
    if (!Number.isNaN(min)) result = result.filter((p) => p.beds >= min)
  }

  if (query.propType && query.propType !== "any") {
    result = result.filter((p) => p.type === query.propType)
  }

  if (query.maxPrice && query.maxPrice !== "any") {
    const max = parseInt(query.maxPrice, 10)
    if (!Number.isNaN(max)) result = result.filter((p) => p.priceNum <= max)
  }

  switch (query.sort) {
    case "price-asc":
      result.sort((a, b) => a.priceNum - b.priceNum)
      break
    case "price-desc":
      result.sort((a, b) => b.priceNum - a.priceNum)
      break
    case "newest":
      result.sort((a, b) => b.year - a.year)
      break
    case "featured":
      result.sort(
        (a, b) => Number(b.status === "new") - Number(a.status === "new"),
      )
      break
    default:
      break
  }

  return result
}

/** Parse a query string map into a PropertyQuery. */
export function queryFromParams(params: URLSearchParams): PropertyQuery {
  return {
    type: params.get("type") as PropertyQuery["type"] ?? undefined,
    q: params.get("q") ?? undefined,
    neighborhood: params.get("neighborhood") ?? undefined,
    city: params.get("city") ?? undefined,
    beds: params.get("beds") ?? undefined,
    propType: params.get("propType") ?? undefined,
    maxPrice: params.get("maxPrice") ?? undefined,
    sort: params.get("sort") as PropertyQuery["sort"] ?? undefined,
  }
}
