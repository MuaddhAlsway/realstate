import { useMemo } from "react"
import { Link, useParams } from "react-router-dom"
import { neighborhoods, properties as allProperties } from "../data/properties"
import { applyPropertyFilters } from "../utils/properties"
import { PropertyCard } from "../components/property/PropertyCard"
import { useReveal } from "../hooks/useReveal"

export default function NeighborhoodDetail() {
  const { id } = useParams()
  const ref = useReveal<HTMLDivElement>()
  const neighborhood = useMemo(
    () => neighborhoods.find((n) => n.id === id),
    [id],
  )
  const properties = useMemo(
    () =>
      neighborhood
        ? applyPropertyFilters(allProperties, {
            neighborhood: neighborhood.name,
          })
        : [],
    [neighborhood],
  )

  if (!neighborhood) {
    return (
      <div
        style={{ minHeight: "80vh", paddingTop: "180px" }}
        className="max-w-[1440px] mx-auto px-6 lg:px-16 text-center"
      >
        <h1 className="text-heading-xl mb-6">Neighborhood not found</h1>
        <Link to="/neighborhoods" className="btn-primary">
          Browse Neighborhoods
        </Link>
      </div>
    )
  }

  const [lat, lng] = neighborhood.coordinates

  return (
    <div ref={ref} style={{ backgroundColor: "#F5F0E8", minHeight: "100vh" }}>
      {/* Hero */}
      <div
        className="relative"
        style={{
          height: "72vh",
          minHeight: "520px",
          backgroundColor: "#0F0F0D",
          paddingTop: "120px",
        }}
      >
        <div className="absolute inset-0" data-frame>
          <img
            src={neighborhood.image}
            alt={neighborhood.name}
            className="w-full h-full object-cover opacity-70"
            loading="eager"
            decoding="async"
          />
        </div>
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(15,15,13,0.35) 0%, transparent 45%, rgba(15,15,13,0.7) 100%)",
          }}
        />
        <div className="relative max-w-[1440px] mx-auto px-6 lg:px-16 flex flex-col justify-end h-full pb-20">
          <p className="eyebrow mb-4" style={{ color: "#C9A96E" }} data-reveal>
            {neighborhood.tagline} · Jeddah
          </p>
          <h1
            className="text-display-lg"
            style={{ color: "#F5F0E8" }}
            data-reveal
          >
            {neighborhood.name}
          </h1>
          <p
            className="text-sm font-light mt-5 max-w-xl leading-relaxed"
            style={{ color: "rgba(245,240,232,0.85)" }}
            data-reveal
          >
            {neighborhood.description}
          </p>
        </div>
      </div>

      {/* Stats strip */}
      <div
        className="border-b"
        style={{
          borderColor: "rgba(15,15,13,0.1)",
          backgroundColor: "#EDE6D6",
        }}
      >
        <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-10 grid grid-cols-3 gap-8">
          {[
            { label: "Listings", value: String(neighborhood.count) },
            { label: "Average Price", value: neighborhood.avgPrice },
            {
              label: "Coordinates",
              value: `${lat.toFixed(2)}°N · ${lng.toFixed(2)}°E`,
            },
          ].map((s) => (
            <div key={s.label} data-reveal>
              <p className="text-heading-md mb-1" style={{ color: "#0F0F0D" }}>
                {s.value}
              </p>
              <p className="eyebrow" style={{ color: "#6B6560" }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Properties */}
      <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-24">
        <div className="flex items-end justify-between mb-12" data-reveal>
          <div>
            <p className="eyebrow mb-4" style={{ color: "#C9A96E" }}>
              Residences
            </p>
            <h2 className="text-heading-xl" style={{ color: "#0F0F0D" }}>
              Properties in {neighborhood.name}
            </h2>
          </div>
          <Link
            to={`/properties?neighborhood=${encodeURIComponent(neighborhood.name)}`}
            className="hidden md:block text-xs tracking-[0.25em] uppercase font-light px-6 py-3 border transition-colors"
            style={{ borderColor: "rgba(15,15,13,0.2)", color: "#0F0F0D" }}
          >
            View in Catalog →
          </Link>
        </div>

        {properties.length === 0 ? (
          <p
            className="text-sm font-light py-16 text-center"
            style={{ color: "#6B6560" }}
          >
            No current listings in this neighborhood — check back soon.
          </p>
        ) : (
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            data-reveal
          >
            {properties.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        )}

        <div
          className="mt-20 flex flex-col md:flex-row md:items-center md:justify-between gap-6 pt-12 border-t"
          style={{ borderColor: "rgba(15,15,13,0.1)" }}
          data-reveal
        >
          <div>
            <p className="text-heading-md mb-2" style={{ color: "#0F0F0D" }}>
              Prefer the full catalog?
            </p>
            <p className="text-sm font-light" style={{ color: "#6B6560" }}>
              Explore every neighborhood and filter by what matters to you.
            </p>
          </div>
          <Link to="/properties" className="btn-primary self-start">
            Explore All Properties
          </Link>
        </div>
      </div>
    </div>
  )
}
