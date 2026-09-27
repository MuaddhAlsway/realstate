import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import type { Property } from "../../data/properties"
import { agentApi } from "../../services/inquiry"
import { mapProperty } from "../../services/mapping"
import { Badge, EmptyState, Spinner, formatPrice } from "../../admin/ui"

export default function AgentProperties() {
  const [rows, setRows] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    agentApi
      .properties()
      .then((data) => {
        if (!cancelled) setRows(mapPropertyList(data))
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load properties")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function mapPropertyList(values: unknown[]): Property[] {
    return values.map((value) => mapProperty(value))
  }

  if (error) return <EmptyState message={error} />
  if (loading) return <Spinner />

  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-light mb-2" style={{ fontFamily: "var(--font-display)" }}>
        My Properties
      </h1>
      <p className="text-sm font-light text-[#6B6560] mb-8">
        {rows.length} listing{rows.length === 1 ? "" : "s"} assigned to you.
      </p>

      {rows.length === 0 ? (
        <EmptyState message="No assigned properties yet." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((property) => (
            <Link
              key={property.id}
              to={`/properties/${property.id}`}
              className="block p-6 transition-colors"
              style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(15,15,13,0.1)" }}
            >
              {property.image ? (
                <img
                  src={property.image}
                  alt={property.name}
                  className="w-full h-40 object-cover mb-4"
                  loading="lazy"
                />
              ) : null}
              <p className="text-sm font-light text-[#0F0F0D] mb-1">{property.name}</p>
              <p className="text-sm font-light text-[#C9A96E] mb-3">{formatPrice(property.priceNum)}</p>
              <div className="flex items-center justify-between">
                <Badge tone="neutral">{property.status}</Badge>
                <span className="text-xs font-light text-[#A09890]">
                  {property.city}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}