import { useEffect, useState } from "react"
import { api } from "../services/api"
import type { Property } from "../data/properties"
import type { PropertyQuery } from "../utils/properties"

/**
 * Single source of truth for the property list.
 *
 * Every page must read properties through this hook rather than importing
 * the bundled dataset directly. The dataset keys listings by slug
 * (`p1`, `p2`, …) while the live API keys them by UUID — rendering a slug
 * into a favorite/inquiry/viewing request produces
 * `422 propertyId: must be a valid UUID`. `api.fetchProperties` already
 * abstracts the two: it maps UUID-keyed server payloads when wired to the
 * backend, and serves the slug-keyed dataset in the preview.
 */
export function useProperties(query: PropertyQuery = {}) {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const key = JSON.stringify(query)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .fetchProperties(query)
      .then((list) => {
        if (!cancelled) setProperties(list)
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message || "Could not load properties.")
          setProperties([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { properties, loading, error }
}
