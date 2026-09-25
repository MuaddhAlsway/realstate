import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import type { Property } from "../data/properties"
import { api } from "../services/api"
import { queryFromParams, type PropertyQuery } from "../utils/properties"
import { PropertyCard } from "../components/property/PropertyCard"
import { useReveal } from "../hooks/useReveal"
import { useFavorites } from "../context/FavoritesContext"

type Layout = "grid" | "list"
type Sort = NonNullable<PropertyQuery["sort"]>

const SORT_OPTIONS: { value: Sort, label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: Low → High" },
  { value: "price-desc", label: "Price: High → Low" },
  { value: "newest", label: "Newest" },
]

const TYPE_OPTIONS = ["any", "villa", "apartment", "penthouse", "duplex"]
const BED_OPTIONS = ["any", "2", "3", "4", "5", "6"]
const PRICE_OPTIONS = ["any", "5000000", "10000000", "20000000"]

function updateParams(
  base: URLSearchParams,
  patch: Record<string, string>,
  setParams: (next: URLSearchParams) => void,
) {
  const next = new URLSearchParams(base)
  for (const [key, value] of Object.entries(patch)) {
    if (!value || value === "any") next.delete(key)
    else next.set(key, value)
  }
  setParams(next)
}

export default function Properties() {
  const [params, setParams] = useSearchParams()
  const { isFavorite } = useFavorites()
  const [layout, setLayout] = useState<Layout>("grid")
  const [savedOnly, setSavedOnly] = useState(false)
  const [results, setResults] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const listRef = useReveal<HTMLDivElement>({ deps: [results] })

  const query = useMemo(() => queryFromParams(params), [params])
  const activeType = query.type ?? "buy"

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .fetchProperties(query)
      .then((data) => {
        if (!cancelled) setResults(data)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "Could not load properties.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [query])

  const visible = useMemo(() => {
    const filtered = savedOnly
      ? results.filter((p) => isFavorite(p.id))
      : results
    if (query.sort) return filtered
    return [...filtered].sort(
      (a, b) => Number(b.status === "new") - Number(a.status === "new"),
    )
  }, [results, savedOnly, isFavorite, query.sort])

  return (
    <div style={{ backgroundColor: "#F5F0E8", minHeight: "100vh" }}>
      {/* Header */}
      <div
        style={{
          backgroundColor: "#0F0F0D",
          paddingTop: "120px",
          paddingBottom: "80px",
        }}
      >
        <div className="max-w-[1440px] mx-auto px-6 lg:px-16">
          <p className="eyebrow mb-4" style={{ color: "#C9A96E" }} data-reveal>
            Browse
          </p>
          <h1
            className="text-display-lg"
            style={{ color: "#F5F0E8" }}
            data-reveal
          >
            All Properties
          </h1>
          <p
            className="text-sm font-light mt-5 max-w-xl leading-relaxed"
            style={{ color: "rgba(245,240,232,0.75)" }}
            data-reveal
          >
            Curated residences across Jeddah — refined by what matters to you.
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div
        className="sticky top-16 z-30 border-b"
        style={{
          backgroundColor: "#F5F0E8",
          borderColor: "rgba(15,15,13,0.1)",
        }}
      >
        <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-4 flex flex-wrap items-center gap-3">
          {/* Buy / Rent */}
          <div
            className="flex border"
            style={{ borderColor: "rgba(15,15,13,0.15)" }}
          >
            {(["buy", "rent"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => updateParams(params, { type: t }, setParams)}
                className="px-5 py-2 text-xs tracking-[0.2em] uppercase font-light transition-colors"
                style={{
                  backgroundColor: activeType === t ? "#0F0F0D" : "transparent",
                  color: activeType === t ? "#F5F0E8" : "#6B6560",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search…"
            defaultValue={query.q ?? ""}
            onChange={(e) =>
              updateParams(params, { q: e.target.value }, setParams)
            }
            className="border px-4 py-2 text-xs font-light outline-none bg-transparent w-40"
            style={{ borderColor: "rgba(15,15,13,0.15)", color: "#0F0F0D" }}
          />

          {/* Type */}
          <select
            value={query.propType ?? "any"}
            onChange={(e) =>
              updateParams(params, { propType: e.target.value }, setParams)
            }
            className="border px-4 py-2 text-xs font-light outline-none bg-transparent appearance-none"
            style={{ borderColor: "rgba(15,15,13,0.15)", color: "#6B6560" }}
            aria-label="Property type"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t === "any"
                  ? "Type: Any"
                  : t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>

          {/* Beds */}
          <select
            value={query.beds ?? "any"}
            onChange={(e) =>
              updateParams(params, { beds: e.target.value }, setParams)
            }
            className="border px-4 py-2 text-xs font-light outline-none bg-transparent appearance-none"
            style={{ borderColor: "rgba(15,15,13,0.15)", color: "#6B6560" }}
            aria-label="Bedrooms"
          >
            {BED_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b === "any" ? "Beds: Any" : `${b}+ Beds`}
              </option>
            ))}
          </select>

          {/* Price */}
          <select
            value={query.maxPrice ?? "any"}
            onChange={(e) =>
              updateParams(params, { maxPrice: e.target.value }, setParams)
            }
            className="border px-4 py-2 text-xs font-light outline-none bg-transparent appearance-none"
            style={{ borderColor: "rgba(15,15,13,0.15)", color: "#6B6560" }}
            aria-label="Max price"
          >
            {PRICE_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p === "any"
                  ? "Max Price: Any"
                  : `SAR ${Number(p).toLocaleString()}`}
              </option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={query.sort ?? "featured"}
            onChange={(e) =>
              updateParams(params, { sort: e.target.value }, setParams)
            }
            className="border px-4 py-2 text-xs font-light outline-none bg-transparent appearance-none"
            style={{ borderColor: "rgba(15,15,13,0.15)", color: "#6B6560" }}
            aria-label="Sort results"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSavedOnly((v) => !v)}
              className="px-4 py-2 text-xs tracking-[0.15em] uppercase font-light border transition-colors"
              style={{
                borderColor: savedOnly ? "#0F0F0D" : "rgba(15,15,13,0.15)",
                backgroundColor: savedOnly ? "#0F0F0D" : "transparent",
                color: savedOnly ? "#F5F0E8" : "#6B6560",
              }}
            >
              Saved Only
            </button>

            <span className="text-xs font-light" style={{ color: "#6B6560" }}>
              {visible.length} {visible.length === 1 ? "result" : "results"}
            </span>

            <div className="flex gap-1">
              {(["grid", "list"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLayout(l)}
                  className="p-2 transition-colors"
                  style={{ color: layout === l ? "#0F0F0D" : "#A09890" }}
                  aria-label={`${l} view`}
                  aria-pressed={layout === l}
                >
                  {l === "grid" ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <rect x="0" y="0" width="7" height="7" />
                      <rect x="9" y="0" width="7" height="7" />
                      <rect x="0" y="9" width="7" height="7" />
                      <rect x="9" y="9" width="7" height="7" />
                    </svg>
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <rect x="0" y="1" width="16" height="2" />
                      <rect x="0" y="7" width="16" height="2" />
                      <rect x="0" y="13" width="16" height="2" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div
        ref={listRef}
        className="max-w-[1440px] mx-auto px-6 lg:px-16 py-16"
        aria-live="polite"
      >
        {loading ? (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse"
                  style={{ backgroundColor: "#EDE6D6" }}
                >
                  <div
                    style={{ aspectRatio: "4/3", backgroundColor: "#E0D8C6" }}
                  />
                  <div className="p-6 flex flex-col gap-4">
                    <div
                      className="h-5 w-2/3"
                      style={{ backgroundColor: "#E0D8C6" }}
                    />
                    <div
                      className="h-3 w-1/3"
                      style={{ backgroundColor: "#E0D8C6" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-32">
            <p className="text-sm font-light" style={{ color: "#B4432E" }}>
              {error}
            </p>
            <button
              type="button"
              onClick={() => setParams(new URLSearchParams())}
              className="mt-6 text-xs tracking-[0.25em] uppercase font-light hover:text-[#C9A96E] transition-colors"
              style={{ color: "#0F0F0D" }}
            >
              Reset Filters
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-32">
            <p className="text-sm font-light" style={{ color: "#6B6560" }}>
              No properties match your criteria.
            </p>
            <button
              type="button"
              onClick={() => {
                setSavedOnly(false)
                setParams(new URLSearchParams())
              }}
              className="mt-6 text-xs tracking-[0.25em] uppercase font-light hover:text-[#C9A96E] transition-colors"
              style={{ color: "#0F0F0D" }}
            >
              Clear Filters
            </button>
          </div>
        ) : layout === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visible.map((p, i) => (
              <div key={p.id} data-reveal>
                <PropertyCard property={p} eager={i < 3} />
              </div>
            ))}
          </div>
        ) : (
          <div
            className="flex flex-col divide-y"
            style={{ borderColor: "rgba(15,15,13,0.08)" }}
          >
            {visible.map((p) => (
              <Link
                key={p.id}
                to={`/properties/${p.id}`}
                className="group grid grid-cols-12 gap-6 py-6"
                data-reveal
              >
                <div
                  className="col-span-3 img-mask"
                  style={{ height: "140px" }}
                >
                  <img
                    src={p.image}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="col-span-6 flex flex-col justify-center">
                  <h3
                    className="font-light mb-1 group-hover:text-[#C9A96E] transition-colors"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "1.3rem",
                      color: "#0F0F0D",
                    }}
                  >
                    {p.name}
                  </h3>
                  <p
                    className="text-xs font-light mb-3"
                    style={{ color: "#6B6560" }}
                  >
                    {p.location}
                  </p>
                  <div className="flex gap-5">
                    {[
                      `${p.beds} Beds`,
                      `${p.baths} Baths`,
                      `${p.area}m²`,
                      p.type,
                    ].map((m) => (
                      <span
                        key={m}
                        className="text-xs font-light capitalize"
                        style={{ color: "#A09890" }}
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="col-span-3 flex flex-col justify-center items-end">
                  <span
                    className="font-light block mb-2"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "1.1rem",
                      color: "#0F0F0D",
                    }}
                  >
                    {p.price}
                  </span>
                  <span
                    className="text-xs px-2 py-1"
                    style={{
                      backgroundColor: "rgba(201,169,110,0.15)",
                      color: "#C9A96E",
                    }}
                  >
                    {p.status === "available"
                      ? "Available"
                      : p.status === "new"
                        ? "New"
                        : "Under Contract"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
