import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useFavorites } from "../context/FavoritesContext"
import { properties, type Property } from "../data/properties"
import { api } from "../services/api"
import { REMOTE } from "../services/http"
import { PropertyCard } from "../components/property/PropertyCard"
import { useReveal } from "../hooks/useReveal"

export default function Saved() {
  const ref = useReveal<HTMLDivElement>()
  const { favorites, clearFavorites } = useFavorites()
  const [liveSaved, setLiveSaved] = useState<Property[] | null>(null)

  useEffect(() => {
    if (!REMOTE) return
    let cancelled = false
    api
      .fetchFavoriteProperties()
      .then((list) => {
        if (!cancelled) setLiveSaved(list)
      })
      .catch(() => {
        /* keep the local snapshot */
      })
    return () => {
      cancelled = true
    }
  }, [favorites])

  const savedProperties =
    REMOTE && liveSaved
      ? liveSaved
      : properties.filter((p) => favorites.includes(p.id))

  return (
    <div ref={ref} style={{ backgroundColor: "#F5F0E8", minHeight: "100vh" }}>
      {/* Header */}
      <div
        style={{
          backgroundColor: "#0F0F0D",
          paddingTop: "120px",
          paddingBottom: "80px",
        }}
      >
        <div className="max-w-[1440px] mx-auto px-6 lg:px-16 flex items-end justify-between">
          <div>
            <p
              className="eyebrow mb-4"
              style={{ color: "#C9A96E" }}
              data-reveal
            >
              Favorites
            </p>
            <h1
              className="text-display-lg"
              style={{ color: "#F5F0E8" }}
              data-reveal
            >
              Saved Properties
            </h1>
          </div>
          {savedProperties.length > 0 && (
            <button
              type="button"
              onClick={clearFavorites}
              className="text-xs tracking-[0.25em] uppercase font-light transition-colors hover:text-[#C9A96E]"
              style={{ color: "rgba(245,240,232,0.6)" }}
              data-reveal
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-24">
        {savedProperties.length === 0 ? (
          <div
            className="flex flex-col items-center text-center py-32 gap-8"
            data-reveal
          >
            <p className="text-heading-xl" style={{ color: "#0F0F0D" }}>
              Nothing saved yet.
            </p>
            <p
              className="text-sm font-light max-w-md mx-auto"
              style={{ color: "#6B6560" }}
            >
              Tap the heart icon on any property to keep it here for when you're
              ready.
            </p>
            <Link to="/properties" className="btn-primary">
              Browse Properties
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8" data-reveal>
              <p className="text-sm font-light" style={{ color: "#6B6560" }}>
                {savedProperties.length}{" "}
                {savedProperties.length === 1 ? "residence" : "residences"}{" "}
                saved
              </p>
            </div>
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              data-reveal
            >
              {savedProperties.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
