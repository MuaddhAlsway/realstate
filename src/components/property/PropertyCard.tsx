import { Link } from "react-router-dom"
import type { Property } from "../../data/properties"
import {
  PROPERTY_STATUS_COLORS,
  PROPERTY_STATUS_LABELS,
} from "../../data/properties"
import { useFavorites } from "../../context/FavoritesContext"

interface PropertyCardProps {
  property: Property
  eager?: boolean
}

export function PropertyCard({
  property: p,
  eager = false,
}: PropertyCardProps) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const saved = isFavorite(p.id)

  return (
    <Link
      to={`/properties/${p.id}`}
      className="property-card group block"
      data-cursor="View"
    >
      <div
        className="card-img img-mask relative"
        style={{ aspectRatio: "4/3" }}
      >
        <img
          src={p.image}
          alt={`${p.name} — ${p.location}`}
          className="w-full h-full object-cover"
          loading={eager ? "eager" : "lazy"}
          decoding="async"
        />
        <div
          className="card-overlay absolute inset-0"
          style={{ background: "rgba(15,15,13,0.18)" }}
        />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            toggleFavorite(p.id)
          }}
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
          aria-label={saved ? `Remove ${p.name} from saved` : `Save ${p.name}`}
          aria-pressed={saved}
          style={{
            backgroundColor: saved ? "#C9A96E" : "rgba(15,15,13,0.4)",
            color: "#F5F0E8",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill={saved ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
        <span
          className="absolute top-4 left-4 px-2 py-1 text-xs tracking-[0.15em] uppercase font-light"
          style={{
            backgroundColor: "rgba(15,15,13,0.8)",
            color: PROPERTY_STATUS_COLORS[p.status],
          }}
        >
          {PROPERTY_STATUS_LABELS[p.status]}
        </span>
      </div>

      <div className="pt-5 pb-2">
        <div className="flex justify-between items-start gap-4 mb-2">
          <h3
            className="font-light group-hover:text-[#C9A96E] transition-colors duration-300"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.2rem",
              color: "#0F0F0D",
            }}
          >
            {p.name}
          </h3>
        </div>
        <p className="text-xs font-light mb-4" style={{ color: "#6B6560" }}>
          {p.location}, {p.city}
        </p>
        <div className="flex gap-5 mb-4">
          {[`${p.beds} Beds`, `${p.baths} Baths`, `${p.area} m²`].map((m) => (
            <span
              key={m}
              className="text-xs font-light"
              style={{ color: "#A09890" }}
            >
              {m}
            </span>
          ))}
        </div>
        <div
          className="flex justify-between items-center pt-4 border-t"
          style={{ borderColor: "rgba(15,15,13,0.08)" }}
        >
          <span
            className="font-light"
            style={{ fontFamily: "var(--font-display)", color: "#0F0F0D" }}
          >
            {p.price}
          </span>
          <span
            className="text-xs font-light capitalize"
            style={{ color: "#C9A96E" }}
          >
            {p.type}
          </span>
        </div>
      </div>
    </Link>
  )
}
