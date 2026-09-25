/** Mirrors src/utils/properties.ts — server-side authoritative filtering. */
export function applyPropertyFilters(list, query = {}) {
  let result = [...list]

  if (query.type) result = result.filter((p) => p.listingType === query.type)

  if (query.q) {
    const q = String(query.q).trim().toLowerCase()
    result = result.filter(
      (p) =>
        String(p.name).toLowerCase().includes(q) ||
        String(p.neighborhood).toLowerCase().includes(q) ||
        String(p.location).toLowerCase().includes(q) ||
        String(p.city).toLowerCase().includes(q),
    )
  }

  if (query.neighborhood) {
    const n = String(query.neighborhood).toLowerCase()
    result = result.filter((p) => String(p.neighborhood).toLowerCase() === n)
  }

  if (query.city) {
    const c = String(query.city).toLowerCase()
    result = result.filter((p) => String(p.city).toLowerCase() === c)
  }

  if (query.beds && query.beds !== "any") {
    const min = Number.parseInt(query.beds, 10)
    if (!Number.isNaN(min)) result = result.filter((p) => p.beds >= min)
  }

  if (query.propType && query.propType !== "any") {
    result = result.filter((p) => p.type === query.propType)
  }

  if (query.maxPrice && query.maxPrice !== "any") {
    const max = Number.parseInt(query.maxPrice, 10)
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
