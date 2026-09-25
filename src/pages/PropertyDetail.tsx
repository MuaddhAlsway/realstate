import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { useParams, Link, useLocation } from "react-router-dom"
import { properties, agents, type Property, type Agent } from "../data/properties"
import { api } from "../services/api"
import { REMOTE } from "../services/http"
import { PropertyCard } from "../components/property/PropertyCard"
import { useReveal } from "../hooks/useReveal"
import { useFavorites } from "../context/FavoritesContext"
import { useAuth } from "../context/AuthContext"

function formatPrice(priceNum: number): string {
  if (priceNum >= 1_000_000) return `SAR ${(priceNum / 1_000_000).toFixed(2)}M`
  if (priceNum >= 1_000) return `SAR ${(priceNum / 1_000).toFixed(0)}K`
  return `SAR ${priceNum}`
}

export default function PropertyDetail() {
  const { id } = useParams()
  const ref = useReveal<HTMLDivElement>()
  const location = useLocation()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { user } = useAuth()

  const staticProperty = useMemo(
    () => properties.find((p) => p.id === id) ?? properties[0],
    [id],
  )
  const [detail, setDetail] = useState<{
    property: Property
    agent: Agent | null
  } | null>(null)
  const property = detail?.property ?? staticProperty
  const agent =
    detail?.agent ??
    agents.find((a) => a.id === staticProperty.agentId) ??
    agents[0]

  useEffect(() => {
    if (!id) return
    let cancelled = false
    api
      .fetchProperty(id)
      .then((result) => {
        if (!cancelled) setDetail(result)
      })
      .catch(() => {
        /* keep the static painting */
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const related = useMemo(
    () =>
      properties
        .filter(
          (p) =>
            p.id !== property.id && p.neighborhood === property.neighborhood,
        )
        .slice(0, 3),
    [property],
  )

  const imgs = property.images.length > 0 ? property.images : [property.image]
  const [activeImg, setActiveImg] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    date: "",
    time: "",
    message: "",
  })
  const [status, setStatus] =
    useState<"idle" | "sending" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [mortgage, setMortgage] = useState({ years: 20, rate: 4.5 })

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  // Scroll lock while lightbox is open
  useEffect(() => {
    document.body.style.overflow = lightbox ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [lightbox])

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false)
      if (e.key === "ArrowRight") setActiveImg((i) => (i + 1) % imgs.length)
      if (e.key === "ArrowLeft")
        setActiveImg((i) => (i - 1 + imgs.length) % imgs.length)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [lightbox, imgs.length])

  const monthlyPayment = useMemo(() => {
    if (property.listingType !== "buy") return null
    const principal = property.priceNum
    const rate = mortgage.rate / 100 / 12
    const n = mortgage.years * 12
    if (rate === 0) return principal / n
    return (
      (principal * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1)
    )
  }, [property, mortgage])

  const saved = isFavorite(property.id)

  const handleViewing = async (e: FormEvent) => {
    e.preventDefault()
    setStatus("sending")
    setErrorMessage(null)
    try {
      if (REMOTE) {
        await api.createViewing({
          propertyId: property.id,
          date: form.date,
          time: form.time || undefined,
          message: form.message || undefined,
        })
      } else {
        await api.createViewing({
          propertyId: property.id,
          name: form.name,
          email: form.email,
          phone: form.phone,
          date: form.date,
          message: form.message || undefined,
        })
      }
      setStatus("success")
      setForm({ name: "", email: "", phone: "", date: "", time: "", message: "" })
    } catch (err) {
      setStatus("error")
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Could not submit your request. Please try again.",
      )
    }
  }

  const statusLabel =
    property.status === "available"
      ? "Available"
      : property.status === "new"
        ? "New"
        : "Under Contract"

  return (
    <div ref={ref} style={{ backgroundColor: "#F5F0E8", minHeight: "100vh" }}>
      {/* Hero gallery */}
      <div
        className="relative"
        style={{
          height: "90vh",
          minHeight: "560px",
          backgroundColor: "#0F0F0D",
          paddingTop: "80px",
        }}
      >
        <img
          src={imgs[activeImg]}
          alt={`${property.name} — primary view`}
          className="w-full h-full object-cover transition-opacity duration-700 cursor-zoom-in"
          style={{ opacity: 0.85 }}
          onClick={() => setLightbox(true)}
          loading="eager"
          decoding="async"
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, rgba(15,15,13,0.3) 0%, transparent 30%, rgba(15,15,13,0.6) 100%)",
          }}
        />

        {/* Gallery thumbs */}
        <div className="absolute bottom-8 left-6 lg:left-16 flex gap-3">
          {imgs.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveImg(i)}
              className="transition-all duration-300"
              style={{
                width: "60px",
                height: "45px",
                outline:
                  i === activeImg
                    ? "2px solid #C9A96E"
                    : "2px solid transparent",
                outlineOffset: "2px",
              }}
              aria-label={`View image ${i + 1}`}
              aria-current={i === activeImg}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>

        {/* Property badge */}
        <div className="absolute top-28 left-6 lg:left-16">
          <p className="eyebrow mb-2" style={{ color: "#C9A96E" }}>
            {property.neighborhood} · {property.type}
          </p>
          <p
            className="text-xs font-light"
            style={{ color: "rgba(245,240,232,0.7)" }}
          >
            {property.location}, Jeddah
          </p>
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={() => toggleFavorite(property.id)}
          className="absolute top-28 right-6 lg:right-16 px-4 py-2 flex items-center gap-2 text-xs tracking-[0.2em] uppercase font-light transition-all"
          style={{
            backgroundColor: saved ? "#C9A96E" : "rgba(15,15,13,0.6)",
            color: saved ? "#0F0F0D" : "#F5F0E8",
            backdropFilter: "blur(8px)",
          }}
          aria-label={saved ? "Remove from saved" : "Save this property"}
          aria-pressed={saved}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill={saved ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {saved ? "Saved" : "Save"}
        </button>

        {/* Quick stats overlay */}
        <div
          className="absolute bottom-8 right-6 lg:right-16 hidden sm:flex gap-6"
          style={{
            backgroundColor: "rgba(15,15,13,0.7)",
            backdropFilter: "blur(10px)",
            padding: "16px 24px",
          }}
        >
          {[
            { label: "Beds", val: property.beds },
            { label: "Baths", val: property.baths },
            { label: "Area", val: `${property.area}m²` },
            { label: "Year", val: property.year },
          ].map((m) => (
            <div key={m.label} className="text-center">
              <p
                className="text-lg font-light"
                style={{ fontFamily: "var(--font-display)", color: "#F5F0E8" }}
              >
                {m.val}
              </p>
              <p className="text-xs font-light" style={{ color: "#A09890" }}>
                {m.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          {/* Left: details */}
          <div className="lg:col-span-8">
            <div
              className="flex flex-col md:flex-row md:justify-between md:items-end mb-12 pb-12 border-b"
              style={{ borderColor: "rgba(15,15,13,0.1)" }}
              data-reveal
            >
              <div>
                <h1
                  className="text-display-lg mb-3"
                  style={{ color: "#0F0F0D" }}
                >
                  {property.name}
                </h1>
                <p className="text-sm font-light" style={{ color: "#6B6560" }}>
                  {property.location}, {property.city}
                </p>
              </div>
              <div className="mt-6 md:mt-0 text-right">
                <p
                  className="font-light"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(1.5rem, 3vw, 2.5rem)",
                    color: "#0F0F0D",
                  }}
                >
                  {property.price}
                </p>
                <span
                  className="text-xs px-3 py-1 font-light tracking-[0.15em] uppercase"
                  style={{
                    backgroundColor: "rgba(201,169,110,0.15)",
                    color: "#C9A96E",
                  }}
                >
                  {statusLabel}
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="mb-16" data-reveal>
              <p
                className="font-light leading-relaxed"
                style={{
                  fontSize: "1.15rem",
                  color: "#1C1C1A",
                  maxWidth: "720px",
                }}
              >
                {property.description}
              </p>
            </div>

            {/* Amenities */}
            <div className="mb-16" data-reveal>
              <h2 className="text-heading-md mb-8" style={{ color: "#0F0F0D" }}>
                Amenities
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {property.amenities.map((a) => (
                  <div
                    key={a}
                    className="px-4 py-3 text-xs font-light tracking-[0.1em] uppercase"
                    style={{
                      border: "1px solid rgba(15,15,13,0.12)",
                      color: "#6B6560",
                    }}
                  >
                    {a}
                  </div>
                ))}
              </div>
            </div>

            {/* Photo story */}
            <div className="mb-16" data-reveal>
              <h2 className="text-heading-md mb-8" style={{ color: "#0F0F0D" }}>
                The Property
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {imgs.map((src, i) => (
                  <div
                    key={i}
                    className={`overflow-hidden cursor-zoom-in ${
                      i === 0 ? "md:col-span-2" : ""
                    }`}
                    style={{ aspectRatio: i === 0 ? "16/7" : "4/3" }}
                    onClick={() => {
                      setActiveImg(i)
                      setLightbox(true)
                    }}
                  >
                    <img
                      src={src}
                      alt={`${property.name} view ${i + 1}`}
                      className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Location */}
            <div className="mb-16" data-reveal>
              <h2 className="text-heading-md mb-4" style={{ color: "#0F0F0D" }}>
                Location
              </h2>
              <p
                className="text-sm font-light mb-6"
                style={{ color: "#6B6560" }}
              >
                {property.location}, Jeddah, Saudi Arabia
              </p>
              <div
                className="w-full flex items-center justify-center"
                style={{
                  height: "300px",
                  backgroundColor: "#EDE6D6",
                  border: "1px solid rgba(15,15,13,0.08)",
                }}
              >
                <p className="text-sm font-light" style={{ color: "#A09890" }}>
                  Interactive map · Available on full implementation
                </p>
              </div>
            </div>
          </div>

          {/* Right: sidebar */}
          <div className="lg:col-span-4">
            <div className="sticky top-28 flex flex-col gap-6">
              {/* Agent card */}
              <div
                className="p-8 border"
                style={{ borderColor: "rgba(15,15,13,0.1)" }}
                data-reveal
              >
                <div className="flex items-start gap-4 mb-6">
                  <div
                    className="overflow-hidden flex-none"
                    style={{ width: "72px", height: "90px" }}
                  >
                    <img
                      src={agent.image}
                      alt={agent.name}
                      className="w-full h-full object-cover"
                      style={{ filter: "grayscale(20%)" }}
                      loading="lazy"
                    />
                  </div>
                  <div>
                    <p
                      className="font-light mb-1"
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "1.15rem",
                        color: "#0F0F0D",
                      }}
                    >
                      {agent.name}
                    </p>
                    <p
                      className="text-xs tracking-[0.15em] uppercase font-light mb-2"
                      style={{ color: "#C9A96E" }}
                    >
                      {agent.role}
                    </p>
                    <p
                      className="text-xs font-light"
                      style={{ color: "#A09890" }}
                    >
                      {agent.experience} years · {agent.properties} properties
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <a
                    href={`tel:${agent.phone.replace(/[^+\d]/g, "")}`}
                    className="flex-1 text-center py-3 text-xs tracking-[0.2em] uppercase font-light border transition-colors"
                    style={{
                      borderColor: "rgba(15,15,13,0.2)",
                      color: "#0F0F0D",
                    }}
                  >
                    Call
                  </a>
                  <a
                    href={`mailto:${agent.email}`}
                    className="flex-1 text-center py-3 text-xs tracking-[0.2em] uppercase font-light"
                    style={{ backgroundColor: "#0F0F0D", color: "#F5F0E8" }}
                  >
                    Email
                  </a>
                </div>
              </div>

              {/* Viewing form */}
              <div
                className="p-8 border"
                style={{ borderColor: "rgba(15,15,13,0.1)" }}
                data-reveal
              >
                <h3
                  className="text-heading-md mb-6"
                  style={{ color: "#0F0F0D" }}
                >
                  Schedule a Viewing
                </h3>

                {status === "success" ? (
                  <div className="flex flex-col gap-4 py-6">
                    <p className="text-heading-md" style={{ color: "#0F0F0D" }}>
                      Thank you.
                    </p>
                    <p
                      className="text-sm font-light"
                      style={{ color: "#6B6560" }}
                    >
                      Your viewing request has been received. Our advisor will
                      confirm shortly.
                    </p>
                    <button
                      type="button"
                      onClick={() => setStatus("idle")}
                      className="self-start mt-2 text-xs tracking-[0.25em] uppercase font-light transition-colors hover:text-[#C9A96E]"
                      style={{ color: "#0F0F0D" }}
                    >
                      Request Another →
                    </button>
                  </div>
                ) : REMOTE && !user ? (
                  <div className="flex flex-col gap-5 py-2">
                    <p
                      className="text-sm font-light"
                      style={{ color: "#6B6560" }}
                    >
                      Sign in to request a viewing — we'll use your account
                      details and keep you updated on status.
                    </p>
                    <Link
                      to="/auth"
                      state={{ from: location.pathname }}
                      className="w-full text-center py-3 text-xs tracking-[0.2em] uppercase font-light"
                      style={{ backgroundColor: "#0F0F0D", color: "#F5F0E8" }}
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/auth"
                      state={{ from: location.pathname, register: true }}
                      className="w-full text-center py-3 text-xs tracking-[0.2em] uppercase font-light border transition-colors hover:border-[#C9A96E]"
                      style={{
                        borderColor: "rgba(15,15,13,0.2)",
                        color: "#0F0F0D",
                      }}
                    >
                      Create Account
                    </Link>
                  </div>
                ) : (
                  <form
                    onSubmit={handleViewing}
                    className="flex flex-col gap-4"
                  >
                    {[
                      ...(REMOTE
                        ? []
                        : [
                            {
                              key: "name" as const,
                              placeholder: "Your name",
                              type: "text",
                            },
                            {
                              key: "email" as const,
                              placeholder: "Email address",
                              type: "email",
                            },
                            {
                              key: "phone" as const,
                              placeholder: "Phone number",
                              type: "tel",
                            },
                          ]),
                      {
                        key: "date" as const,
                        placeholder: "Preferred date",
                        type: "date",
                      },
                      ...(REMOTE
                        ? [
                            {
                              key: "time" as const,
                              placeholder: "Preferred time",
                              type: "time",
                            },
                          ]
                        : []),
                    ].map((f) => (
                      <input
                        key={f.key}
                        type={f.type}
                        required
                        placeholder={f.placeholder}
                        value={form[f.key]}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            [f.key]: e.target.value,
                          }))
                        }
                        className="w-full border-b py-3 text-sm font-light outline-none bg-transparent"
                        style={{
                          borderColor: "rgba(15,15,13,0.15)",
                          color: "#0F0F0D",
                        }}
                      />
                    ))}
                    <textarea
                      placeholder="Message (optional)"
                      value={form.message}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          message: e.target.value,
                        }))
                      }
                      rows={3}
                      className="w-full border-b py-3 text-sm font-light outline-none bg-transparent resize-none"
                      style={{
                        borderColor: "rgba(15,15,13,0.15)",
                        color: "#0F0F0D",
                      }}
                    />
                    {status === "error" && (
                      <p
                        className="text-sm font-light"
                        role="alert"
                        style={{ color: "#B4432E" }}
                      >
                        {errorMessage}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={status === "sending"}
                      className="w-full py-4 text-xs tracking-[0.3em] uppercase font-light transition-colors disabled:opacity-60"
                      style={{ backgroundColor: "#0F0F0D", color: "#F5F0E8" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#C9A96E"
                        e.currentTarget.style.color = "#0F0F0D"
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#0F0F0D"
                        e.currentTarget.style.color = "#F5F0E8"
                      }}
                    >
                      {status === "sending" ? "Sending…" : "Request Viewing"}
                    </button>
                  </form>
                )}
              </div>

              {/* Mortgage estimate — buy only */}
              {property.listingType === "buy" && monthlyPayment !== null && (
                <div
                  className="p-8"
                  style={{ backgroundColor: "#EDE6D6" }}
                  data-reveal
                >
                  <p className="eyebrow mb-3" style={{ color: "#C9A96E" }}>
                    Est. Monthly Payment
                  </p>
                  <p
                    className="font-light mb-3"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "2rem",
                      color: "#0F0F0D",
                    }}
                  >
                    {formatPrice(monthlyPayment)}
                  </p>
                  <div className="flex flex-col gap-4 mb-4">
                    <label
                      className="flex items-center gap-3 text-xs font-light"
                      style={{ color: "#6B6560" }}
                    >
                      <span className="w-16">Term</span>
                      <input
                        type="range"
                        min={5}
                        max={30}
                        step={1}
                        value={mortgage.years}
                        onChange={(e) =>
                          setMortgage((m) => ({
                            ...m,
                            years: Number(e.target.value),
                          }))
                        }
                        className="flex-1"
                        style={{ accentColor: "#C9A96E" }}
                      />
                      <span className="w-10 text-right">
                        {mortgage.years}yr
                      </span>
                    </label>
                    <label
                      className="flex items-center gap-3 text-xs font-light"
                      style={{ color: "#6B6560" }}
                    >
                      <span className="w-16">Rate</span>
                      <input
                        type="range"
                        min={2}
                        max={8}
                        step={0.5}
                        value={mortgage.rate}
                        onChange={(e) =>
                          setMortgage((m) => ({
                            ...m,
                            rate: Number(e.target.value),
                          }))
                        }
                        className="flex-1"
                        style={{ accentColor: "#C9A96E" }}
                      />
                      <span className="w-10 text-right">{mortgage.rate}%</span>
                    </label>
                  </div>
                  <p
                    className="text-xs font-light"
                    style={{ color: "#6B6560" }}
                  >
                    Indicative estimate at {mortgage.rate}% over{" "}
                    {mortgage.years} years.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Related properties */}
        {related.length > 0 && (
          <div
            className="mt-24 pt-16 border-t"
            style={{ borderColor: "rgba(15,15,13,0.1)" }}
            data-reveal
          >
            <h2 className="text-heading-xl mb-12" style={{ color: "#0F0F0D" }}>
              More in {property.neighborhood}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {related.map((p) => (
                <div key={p.id} data-reveal>
                  <PropertyCard property={p} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ backgroundColor: "rgba(15,15,13,0.95)" }}
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Property image viewer"
        >
          <button
            type="button"
            className="absolute top-6 right-6 text-xs tracking-[0.3em] uppercase font-light"
            style={{ color: "rgba(245,240,232,0.6)" }}
            onClick={() => setLightbox(false)}
          >
            Close ✕
          </button>
          <img
            src={imgs[activeImg]}
            alt={`${property.name} — image ${activeImg + 1}`}
            className="max-w-full max-h-full object-contain"
            style={{ maxWidth: "90vw", maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl p-4"
            style={{ color: "#F5F0E8" }}
            onClick={(e) => {
              e.stopPropagation()
              setActiveImg((i) => (i - 1 + imgs.length) % imgs.length)
            }}
            aria-label="Previous image"
          >
            ←
          </button>
          <button
            type="button"
            className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl p-4"
            style={{ color: "#F5F0E8" }}
            onClick={(e) => {
              e.stopPropagation()
              setActiveImg((i) => (i + 1) % imgs.length)
            }}
            aria-label="Next image"
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}
