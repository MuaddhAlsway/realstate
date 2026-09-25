import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useGSAP } from "@gsap/react"
import { gsap } from "../animations/gsap"
import { EASE } from "../animations/easings"
import { useReveal } from "../hooks/useReveal"
import { useReducedMotion } from "../hooks/useReducedMotion"
import { useFavorites } from "../context/FavoritesContext"
import { Counter } from "../components/motion/Counter"
import { TextReveal } from "../components/motion/TextReveal"
import { Magnetic } from "../components/motion/Magnetic"
import { PropertyCard } from "../components/property/PropertyCard"
import {
  properties,
  neighborhoods,
  agents,
  type Property,
} from "../data/properties"
import { applyPropertyFilters, type PropertyQuery } from "../utils/properties"
import { useSiteContent } from "../services/siteContent"

const FLAGSHIP: Property =
  properties.find((p) => p.listingType === "buy") ?? properties[0]

/* ───────────────────────────── 01 · HERO ───────────────────────────── */

function Hero() {
  const heroRef = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { content } = useSiteContent()
  const home = content.home
  const [active, setActive] = useState<"buy" | "rent">("buy")
  const [query, setQuery] = useState("")

  useGSAP(
    () => {
      const el = heroRef.current
      if (!el || reduced) return

      const wrap = el.querySelector("[data-hero-image-wrap]")
      const img = el.querySelector("[data-hero-image]")
      const copy = el.querySelector("[data-hero-copy]")

      const tl = gsap.timeline({ defaults: { ease: EASE.cinematic } })
      tl.fromTo(
        wrap,
        { scale: 1.15 },
        { scale: 1.05, duration: 2.4, ease: "power2.out" },
        0,
      )
        .fromTo(
          img,
          { opacity: 0 },
          { opacity: 1, duration: 1.6, ease: "power2.out" },
          0,
        )
        .to(
          el.querySelectorAll("[data-hero-line]"),
          { yPercent: 0, duration: 1.5, stagger: 0.16 },
          0.45,
        )
        .to(
          el.querySelectorAll("[data-hero-fade]"),
          { y: 0, opacity: 1, duration: 1.1, stagger: 0.12 },
          1,
        )

      gsap.to(wrap, {
        yPercent: 16,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      })
      if (copy) {
        gsap.to(copy, {
          yPercent: -12,
          opacity: 0.1,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top top",
            end: "bottom 30%",
            scrub: true,
          },
        })
      }
    },
    { scope: heroRef, dependencies: [reduced] },
  )

  return (
    <section
      ref={heroRef}
      className="relative h-screen min-h-[640px] overflow-hidden"
      style={{ backgroundColor: "#0F0F0D" }}
    >
      <div
        data-hero-image-wrap
        className="absolute inset-0 will-change-transform"
      >
        <img
          data-hero-image
          src={home.heroImage}
          alt={home.heroImageAlt}
          className="w-full h-full object-cover opacity-0"
          fetchPriority="high"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(15,15,13,0.32) 0%, rgba(15,15,13,0.08) 40%, rgba(15,15,13,0.62) 100%)",
          }}
        />
      </div>

      <div
        data-hero-copy
        className="relative z-10 h-full flex flex-col justify-between px-6 lg:px-16 pt-40 pb-16 max-w-[1440px] mx-auto"
      >
        <div className="max-w-4xl">
          <p
            data-hero-fade
            className="eyebrow mb-8"
            style={{ color: "#C9A96E" }}
          >
            {home.heroEyebrow}
          </p>
          <h1
            className="font-light text-display-xl mb-8"
            style={{ color: "#F5F0E8" }}
          >
            <span className="line-mask">
              <span data-hero-line>{home.heroLine1}</span>
            </span>
            <span className="line-mask">
              <span data-hero-line>
                <em className="italic" style={{ color: "#C9A96E" }}>
                  {home.heroLine2}
                </em>
              </span>
            </span>
            <span className="line-mask">
              <span data-hero-line>{home.heroLine3}</span>
            </span>
          </h1>
          <p
            data-hero-fade
            className="text-base font-light max-w-md"
            style={{ color: "rgba(245,240,232,0.65)" }}
          >
            {home.heroDescription}
          </p>
        </div>

        <div>
          <div
            className="flex flex-col sm:flex-row items-stretch sm:items-stretch gap-px max-w-3xl"
            style={{
              backgroundColor: "rgba(245,240,232,0.18)",
              border: "1px solid rgba(245,240,232,0.16)",
            }}
          >
            <div className="flex" role="tablist" aria-label="Buy or rent">
              {(["buy", "rent"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={active === t}
                  onClick={() => setActive(t)}
                  className="px-6 py-3.5 text-xs tracking-[0.2em] uppercase font-light transition-colors duration-300"
                  style={{
                    backgroundColor: active === t ? "#C9A96E" : "transparent",
                    color: active === t ? "#0F0F0D" : "rgba(245,240,232,0.7)",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Search neighborhoods, addresses…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 min-w-0 bg-transparent px-4 py-3.5 text-sm font-light outline-none"
              style={{ color: "#F5F0E8" }}
              aria-label="Search neighborhoods or addresses"
            />
            <Magnetic>
              <Link
                to={`/properties?type=${active}${
                  query ? `&q=${encodeURIComponent(query)}` : ""
                }`}
                className="btn-magnetic text-center px-8 py-3.5 text-xs tracking-[0.2em] uppercase font-light transition-colors duration-300"
                style={{ backgroundColor: "#F5F0E8", color: "#0F0F0D" }}
              >
                Search
              </Link>
            </Magnetic>
          </div>

          <div
            data-hero-fade
            className="flex items-center gap-6 sm:gap-8 mt-8 flex-wrap"
          >
            <div>
              <span
                className="text-xs font-light"
                style={{ color: "rgba(245,240,232,0.4)" }}
              >
                Properties
              </span>
              <p className="text-sm font-light" style={{ color: "#F5F0E8" }}>
                250+ available
              </p>
            </div>
            <div
              className="w-px h-8"
              style={{ backgroundColor: "rgba(245,240,232,0.15)" }}
            />
            <div>
              <span
                className="text-xs font-light"
                style={{ color: "rgba(245,240,232,0.4)" }}
              >
                Location
              </span>
              <p className="text-sm font-light" style={{ color: "#F5F0E8" }}>
                21.4858° N · 39.1925° E
              </p>
            </div>
            <div
              className="w-px h-8"
              style={{ backgroundColor: "rgba(245,240,232,0.15)" }}
            />
            <div>
              <span
                className="text-xs font-light"
                style={{ color: "rgba(245,240,232,0.4)" }}
              >
                Year founded
              </span>
              <p className="text-sm font-light" style={{ color: "#F5F0E8" }}>
                2012
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        className="absolute bottom-8 right-8 lg:right-16 flex flex-col items-center gap-2"
        data-hero-fade
        aria-hidden="true"
      >
        <span
          className="text-xs tracking-[0.3em] uppercase"
          style={{ color: "rgba(245,240,232,0.4)", writingMode: "vertical-rl" }}
        >
          Scroll
        </span>
        <div
          className="w-px h-12"
          style={{
            background:
              "linear-gradient(to bottom, rgba(201,169,110,0.6), transparent)",
          }}
        />
      </div>
    </section>
  )
}

/* ──────────────────────── 02 · SELECTED RESIDENCES ──────────────────── */

function FeaturedSection() {
  const ref = useReveal<HTMLElement>()
  const { content } = useSiteContent()
  const home = content.home
  const featured = properties.filter((p) => p.listingType === "buy").slice(0, 3)

  return (
    <section
      ref={ref}
      className="py-28 lg:py-32 max-w-[1440px] mx-auto px-6 lg:px-16"
    >
      <div
        className="flex justify-between items-end mb-16 lg:mb-20"
        data-reveal
      >
        <div className="max-w-3xl">
          <p className="eyebrow mb-4" style={{ color: "#C9A96E" }}>
            {home.featuredEyebrow}
          </p>
          <TextReveal
            as="h2"
            text={home.featuredTitle}
            className="text-heading-xl"
            style={{}}
          />
        </div>
        <Link
          to="/properties"
          className="hidden md:flex items-center gap-3 text-xs tracking-[0.2em] uppercase font-light transition-colors duration-300 hover:text-[#C9A96E]"
          style={{ color: "#6B6560" }}
        >
          {home.featuredCta} <span style={{ color: "#C9A96E" }}>→</span>
        </Link>
      </div>

      <div className="flex flex-col gap-20 lg:gap-28">
        {featured.map((p, i) => (
          <div
            key={p.id}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
          >
            <div
              className={`lg:col-span-7 ${
                i % 2 === 1 ? "lg:col-start-6 lg:row-start-1" : ""
              }`}
              data-frame
              data-cursor="View"
              style={{ aspectRatio: "16/10" }}
            >
              <Link
                to={`/properties/${p.id}`}
                className="absolute inset-0 group"
                aria-label={`View ${p.name}`}
              >
                <div className="card-img w-full h-full">
                  <img
                    src={p.image}
                    alt={`${p.name} — ${p.location}`}
                    className="w-full h-full object-cover"
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                </div>
                <div
                  className="card-overlay absolute inset-0 flex items-end p-6"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(15,15,13,0.6), transparent)",
                  }}
                >
                  <span
                    className="text-xs tracking-[0.3em] uppercase font-light px-6 py-3 border transition-colors"
                    style={{ borderColor: "#F5F0E8", color: "#F5F0E8" }}
                  >
                    View Property
                  </span>
                </div>
              </Link>
            </div>

            <div
              className={`lg:col-span-4 ${
                i % 2 === 0 ? "lg:col-start-9" : "lg:col-start-1 lg:row-start-1"
              }`}
            >
              <div data-reveal>
                <span
                  className="block eyebrow mb-6"
                  style={{ color: "#C9A96E" }}
                >
                  0{i + 1}
                </span>
                <h3
                  className="text-heading-md mb-3"
                  style={{ color: "#0F0F0D" }}
                >
                  {p.name}
                </h3>
                <p
                  className="text-sm font-light mb-6"
                  style={{ color: "#6B6560" }}
                >
                  {p.location}, {p.city}
                </p>
                <div className="flex gap-6 mb-8">
                  {[
                    { label: "Beds", val: p.beds },
                    { label: "Baths", val: p.baths },
                    { label: "Area", val: `${p.area}m²` },
                  ].map((m) => (
                    <div key={m.label}>
                      <p className="eyebrow mb-1" style={{ color: "#A09890" }}>
                        {m.label}
                      </p>
                      <p
                        className="text-sm font-light"
                        style={{ color: "#0F0F0D" }}
                      >
                        {m.val}
                      </p>
                    </div>
                  ))}
                </div>
                <div
                  className="flex items-center justify-between pt-6 border-t"
                  style={{ borderColor: "rgba(15,15,13,0.1)" }}
                >
                  <span
                    className="font-light text-heading-md"
                    style={{ color: "#0F0F0D" }}
                  >
                    {p.price}
                  </span>
                  <Link
                    to={`/properties/${p.id}`}
                    className="text-xs tracking-[0.2em] uppercase font-light transition-colors duration-300 hover:text-[#C9A96E]"
                    style={{ color: "#0F0F0D" }}
                  >
                    Details →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ───────────────────────── 03 · HORIZONTAL EXPLORATION ──────────────── */

function HorizontalShowcase() {
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const { content } = useSiteContent()
  const home = content.home

  useGSAP(
    () => {
      const sec = sectionRef.current
      const track = trackRef.current
      if (!sec || !track || reduced) return

      const mm = gsap.matchMedia()
      mm.add("(min-width: 1025px)", () => {
        const amount = () => Math.max(track.scrollWidth - window.innerWidth, 0)
        gsap.to(track, {
          x: () => -amount(),
          ease: "none",
          scrollTrigger: {
            trigger: sec,
            start: "top top",
            end: () => `+=${amount() + 300}`,
            pin: true,
            scrub: 1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        })
      })
      return () => mm.revert()
    },
    { dependencies: [reduced] },
  )

  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    if (window.matchMedia("(min-width: 1025px)").matches) return

    let dragging = false
    let pointerId = -1
    let startX = 0
    let startScroll = 0
    let dragged = 0

    const onWheel = (e: WheelEvent) => {
      if (row.scrollWidth <= row.clientWidth) return
      e.preventDefault()
      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      row.scrollLeft += delta
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return
      dragging = true
      pointerId = e.pointerId
      dragged = 0
      startX = e.clientX
      startScroll = row.scrollLeft
      row.style.cursor = "grabbing"
      row.style.userSelect = "none"
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pointerId) return
      const dx = e.clientX - startX
      dragged = Math.max(dragged, Math.abs(dx))
      row.scrollLeft = startScroll - dx
    }

    const endDrag = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pointerId) return
      dragging = false
      pointerId = -1
      row.style.cursor = ""
      row.style.userSelect = ""
    }

    const onClickCapture = (e: Event) => {
      if (dragged > 8) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    row.addEventListener("wheel", onWheel, { passive: false })
    row.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", endDrag)
    window.addEventListener("pointercancel", endDrag)
    row.addEventListener("click", onClickCapture, true)

    return () => {
      row.removeEventListener("wheel", onWheel)
      row.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", endDrag)
      window.removeEventListener("pointercancel", endDrag)
      row.removeEventListener("click", onClickCapture, true)
    }
  }, [reduced])

  return (
    <section
      ref={sectionRef}
      style={{ backgroundColor: "#0F0F0D" }}
      data-cursor="Drag"
    >
      <div className="px-6 lg:px-16 pt-24 pb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-4" style={{ color: "#C9A96E" }}>
            {home.showcaseEyebrow}
          </p>
          <p
            className="text-sm font-light"
            style={{ color: "rgba(245,240,232,0.45)" }}
          >
            {reduced ? "Scroll to explore" : home.showcaseHint}
          </p>
        </div>
        <span
          className="hidden lg:block eyebrow"
          style={{ color: "rgba(245,240,232,0.3)" }}
        >
          {String(properties.length).padStart(2, "0")} residences
        </span>
      </div>

      <div
        ref={rowRef}
        className="overflow-x-auto lg:overflow-hidden px-6 lg:px-16 pb-16 no-scrollbar"
        data-draggable
      >
        <div ref={trackRef} className="flex gap-6 w-max will-change-transform">
          {properties.map((p, i) => (
            <Link
              key={p.id}
              to={`/properties/${p.id}`}
              className="block group flex-none"
              style={{ width: "clamp(300px, 30vw, 460px)" }}
              data-cursor="View"
            >
              <div
                className="relative overflow-hidden"
                style={{ height: "62vh", minHeight: 420 }}
              >
                <img
                  src={p.image}
                  alt={`${p.name} — ${p.location}`}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
                <div
                  className="absolute inset-0 flex flex-col justify-end p-8"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(15,15,13,0.88) 0%, transparent 55%)",
                  }}
                >
                  <span
                    className="block text-6xl font-light mb-4 opacity-30"
                    style={{
                      fontFamily: "var(--font-display)",
                      color: "#F5F0E8",
                      lineHeight: 1,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="eyebrow mb-2" style={{ color: "#C9A96E" }}>
                    {p.location}
                  </p>
                  <h3
                    className="font-light text-heading-md mb-3"
                    style={{ color: "#F5F0E8" }}
                  >
                    {p.name}
                  </h3>
                  <p
                    className="text-sm font-light mb-4"
                    style={{ color: "rgba(245,240,232,0.6)" }}
                  >
                    {p.price}
                  </p>
                  <div
                    className="flex gap-4 text-xs font-light"
                    style={{ color: "rgba(245,240,232,0.5)" }}
                  >
                    <span>{p.beds} Beds</span>
                    <span>·</span>
                    <span>{p.area} m²</span>
                    <span>·</span>
                    <span className="capitalize">{p.type}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ───────────────────────── 04 · FLAGSHIP STORY ──────────────────────── */

const CHAPTERS: { num: string, title: string, text: string, img: string }[] = [
  {
    num: "01",
    title: "Exterior",
    text: "A sculptural facade of limestone and glass, poised above the Red Sea with every principal room facing the water.",
    img: FLAGSHIP.images[0],
  },
  {
    num: "02",
    title: "Living Spaces",
    text: "Double-height living volumes where natural light moves through the day as quietly as the tide below.",
    img: FLAGSHIP.images[1],
  },
  {
    num: "03",
    title: "Kitchen & Craft",
    text: "A marble-clad kitchen conceived for entertaining at scale, finished by Jeddah\u2019s finest artisans.",
    img: FLAGSHIP.images[2],
  },
  {
    num: "04",
    title: "Master Suite",
    text: "A private suite with a terrace suspended over the water — the city, the sea, and silence.",
    img: FLAGSHIP.images[3],
  },
]

function PinnedStory() {
  const rootRef = useRef<HTMLElement>(null)

  useGSAP(() => {
    const el = rootRef.current
    if (!el) return

    const slides = gsap.utils.toArray<HTMLElement>(".story-slide")
    slides.forEach((slide, i) => {
      gsap.set(slide, { autoAlpha: i === 0 ? 1 : 0 })
    })

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: el,
        start: "top top",
        end: "+=2600",
        pin: true,
        scrub: 1,
        anticipatePin: 1,
      },
    })

    slides.slice(1).forEach((slide) => {
      const num = slide.querySelector<HTMLElement>(".story-num")
      tl.to(slides, { autoAlpha: 0, duration: 0.5 }).fromTo(
        slide,
        { autoAlpha: 0 },
        {
          autoAlpha: 1,
          duration: 0.8,
          ease: "power2.inOut",
        },
      )
      if (num) {
        tl.fromTo(num, { xPercent: -12 }, {
          xPercent: 0,
          duration: 0.7,
          ease: "power2.out",
        })
      }
    })
  })

  return (
    <section
      ref={rootRef}
      className="relative h-screen overflow-hidden"
      style={{ backgroundColor: "#0F0F0D" }}
    >
      <div className="px-6 lg:px-16 py-28 flex flex-col justify-between z-10 pointer-events-none">
        <div className="flex items-baseline justify-between pointer-events-auto">
          <p className="eyebrow" style={{ color: "#C9A96E" }}>
            The Flagship Residence
          </p>
          <p
            className="hidden md:block eyebrow"
            style={{ color: "rgba(245,240,232,0.35)" }}
          >
            {FLAGSHIP.location} · Jeddah
          </p>
        </div>
        <div className="max-w-3xl">
          <h2
            className="text-heading-xl lg:text-display-lg font-light mb-6"
            style={{ color: "#F5F0E8" }}
          >
            The Oasis House{" "}
            <em className="italic" style={{ color: "#C9A96E" }}>
              in four chapters.
            </em>
          </h2>
        </div>
      </div>

      {CHAPTERS.map((chapter, i) => (
        <div
          key={chapter.num}
          className={`story-slide absolute inset-0 ${
            i === 0 ? "" : "invisible"
          }`}
        >
          <span
            className="story-num absolute hidden lg:block text-[clamp(8rem,22vw,20rem)] font-light leading-none"
            style={{
              fontFamily: "var(--font-display)",
              color: "rgba(245,240,232,0.04)",
              top: "18%",
              left: "52%",
              zIndex: 2,
              userSelect: "none",
            }}
          >
            {chapter.num}
          </span>
          <img
            src={chapter.img}
            alt={`${chapter.title} — ${FLAGSHIP.name}`}
            className="absolute inset-0 w-full h-full object-cover opacity-60"
            loading="lazy"
            decoding="async"
            data-cursor="View"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(15,15,13,0.55) 0%, rgba(15,15,13,0.1) 35%, rgba(15,15,13,0.72) 100%)",
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 px-6 lg:px-16 pb-16 pt-32">
            <p className="eyebrow mb-3" style={{ color: "#C9A96E" }}>
              Chapter {chapter.num}
            </p>
            <h3 className="text-heading-xl mb-3" style={{ color: "#F5F0E8" }}>
              {chapter.title}
            </h3>
            <p
              className="text-sm sm:text-base font-light max-w-md lg:max-w-lg leading-relaxed"
              style={{ color: "rgba(245,240,232,0.72)" }}
            >
              {chapter.text}
            </p>
          </div>
        </div>
      ))}

      <div className="absolute right-6 lg:right-16 bottom-16 z-10 pointer-events-none">
        <p className="eyebrow" style={{ color: "rgba(245,240,232,0.4)" }}>
          Scroll
        </p>
      </div>
    </section>
  )
}

function StaticStory() {
  return (
    <section className="py-24" style={{ backgroundColor: "#0F0F0D" }}>
      <div className="px-6 lg:px-16 max-w-[1440px] mx-auto">
        <p className="eyebrow mb-4" style={{ color: "#C9A96E" }}>
          The Flagship Residence
        </p>
        <h2
          className="font-light text-heading-xl lg:text-display-lg mb-16"
          style={{ color: "#F5F0E8" }}
        >
          <em className="italic" style={{ color: "#C9A96E" }}>
            The Oasis House,
          </em>{" "}
          in four chapters.
        </h2>
        <div className="flex flex-col gap-16">
          {CHAPTERS.map((chapter) => (
            <div
              key={chapter.num}
              className="grid lg:grid-cols-12 gap-6 items-end"
            >
              <div className="lg:col-span-7" style={{ aspectRatio: "16/9" }}>
                <img
                  src={chapter.img}
                  alt={`${chapter.title} — ${FLAGSHIP.name}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="lg:col-span-4 lg:col-start-9 lg:pb-8">
                <p className="eyebrow mb-3" style={{ color: "#C9A96E" }}>
                  Chapter {chapter.num}
                </p>
                <h3
                  className="text-heading-md mb-3"
                  style={{ color: "#F5F0E8" }}
                >
                  {chapter.title}
                </h3>
                <p
                  className="text-sm font-light leading-relaxed"
                  style={{ color: "rgba(245,240,232,0.7)" }}
                >
                  {chapter.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FlagshipStory() {
  const reduced = useReducedMotion()
  const [desktop, setDesktop] = useState<boolean>(
    () => window.matchMedia("(min-width: 1025px)").matches,
  )

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1025px)")
    const onChange = (e: MediaQueryListEvent) => setDesktop(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  if (reduced || !desktop) return <StaticStory />
  return <PinnedStory />
}

/* ───────────────────────── 05 · PROPERTY DISCOVERY ──────────────────── */

function FilteredResults({ results }: { results: Property[] }) {
  const ref = useReveal<HTMLDivElement>()
  if (results.length === 0) {
    return (
      <div className="py-24 text-center" data-reveal>
        <p className="text-sm font-light" style={{ color: "#6B6560" }}>
          No residences match those criteria.
        </p>
      </div>
    )
  }
  return (
    <div
      ref={ref}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
    >
      {results.slice(0, 3).map((p, i) => (
        <div key={p.id} data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
          <PropertyCard property={p} eager={i === 0} />
        </div>
      ))}
    </div>
  )
}

function DiscoverySection() {
  const sectionRef = useRef<HTMLElement>(null)
  const { content } = useSiteContent()
  const home = content.home
  const [active, setActive] = useState<"buy" | "rent">("buy")
  const [propType, setPropType] = useState("any")
  const [beds, setBeds] = useState("any")
  const [query, setQuery] = useState("")

  const filterKey = `${active}-${propType}-${beds}-${query}`
  const results = useMemo<Property[]>(
    () =>
      applyPropertyFilters(properties, {
        type: active,
        propType,
        beds,
        q: query || undefined,
      } as PropertyQuery),
    [active, propType, beds, query],
  )

  return (
    <section
      ref={sectionRef}
      className="py-28 lg:py-32 max-w-[1440px] mx-auto px-6 lg:px-16"
    >
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between mb-14">
        <div className="mb-8 lg:mb-0">
          <p className="eyebrow mb-4" style={{ color: "#C9A96E" }}>
            {home.discoveryEyebrow}
          </p>
          <TextReveal
            as="h2"
            text={home.discoveryTitle}
            className="text-heading-xl"
          />
        </div>
        <p
          className="text-sm font-light lg:max-w-xs"
          style={{ color: "#6B6560" }}
        >
          {results.length} residence{results.length === 1 ? "" : "s"} match your
          criteria.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-14" data-reveal>
        <div
          className="flex border"
          style={{ borderColor: "rgba(15,15,13,0.18)" }}
        >
          {(["buy", "rent"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActive(t)}
              className="px-5 py-2.5 text-xs tracking-[0.2em] uppercase font-light transition-colors duration-300"
              style={{
                backgroundColor: active === t ? "#0F0F0D" : "transparent",
                color: active === t ? "#F5F0E8" : "#6B6560",
              }}
            >
              {t}
            </button>
          ))}
        </div>
        {[
          {
            value: propType,
            set: setPropType,
            options: ["any", "villa", "apartment", "penthouse", "duplex"],
            label: (v: string) =>
              v === "any"
                ? "Type: Any"
                : v.charAt(0).toUpperCase() + v.slice(1),
          },
          {
            value: beds,
            set: setBeds,
            options: ["any", "3", "4", "5"],
            label: (v: string) => (v === "any" ? "Beds: Any" : `${v}+ Beds`),
          },
        ].map((row, i) => (
          <select
            key={i}
            value={row.value}
            onChange={(e) => row.set(e.target.value)}
            className="border px-4 py-2.5 text-xs font-light bg-transparent outline-none appearance-none cursor-pointer"
            style={{ borderColor: "rgba(15,15,13,0.18)", color: "#6B6560" }}
            aria-label={i === 0 ? "Property type" : "Minimum bedrooms"}
          >
            {row.options.map((o) => (
              <option key={o} value={o}>
                {row.label(o)}
              </option>
            ))}
          </select>
        ))}
        <input
          type="text"
          placeholder="Search location…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="border px-4 py-2.5 text-xs font-light bg-transparent outline-none"
          style={{
            borderColor: "rgba(15,15,13,0.18)",
            color: "#0F0F0D",
            width: "170px",
          }}
          aria-label="Search by location"
        />
        <Link
          to={`/properties?type=${active}`}
          className="ml-auto text-xs tracking-[0.2em] uppercase font-light transition-colors duration-300 hover:text-[#C9A96E]"
          style={{ color: "#0F0F0D" }}
        >
          All {active} properties →
        </Link>
      </div>

      <FilteredResults key={filterKey} results={results} />
    </section>
  )
}

/* ───────────────────────────── 07 · STATISTICS ──────────────────────── */

function StatsSection() {
  const ref = useReveal<HTMLElement>()
  const { content } = useSiteContent()
  const stats = content.home.stats

  return (
    <section
      ref={ref}
      style={{ backgroundColor: "#1C1C1A" }}
      className="py-28 lg:py-32"
    >
      <div className="max-w-[1440px] mx-auto px-6 lg:px-16">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-16">
          {stats.map((s) => (
            <div key={s.label} data-reveal>
              <div
                className="font-light mb-4 tabular-nums text-[clamp(2.6rem,5vw,4.8rem)] leading-none"
                style={{ fontFamily: "var(--font-display)", color: "#F5F0E8" }}
              >
                <Counter
                  target={s.val}
                  prefix={s.prefix}
                  suffix={s.suffix}
                  decimals={s.decimals}
                />
              </div>
              <p
                className="text-sm font-light mb-1"
                style={{ color: "#F5F0E8" }}
              >
                {s.label}
              </p>
              <p className="text-xs font-light" style={{ color: "#6B6560" }}>
                {s.sub}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────── 07 · NEIGHBORHOODS ──────────────────────── */

function NeighborhoodsSection() {
  const ref = useReveal<HTMLElement>()
  return (
    <section
      ref={ref}
      className="py-28 lg:py-32 max-w-[1440px] mx-auto px-6 lg:px-16"
    >
      <div
        className="flex justify-between items-end mb-14 lg:mb-20"
        data-reveal
      >
        <div>
          <p className="eyebrow mb-4" style={{ color: "#C9A96E" }}>
            Discover
          </p>
          <TextReveal
            as="h2"
            text="The Neighborhood"
            className="text-heading-xl"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {neighborhoods.map((n, i) => (
          <Link
            key={n.id}
            to={`/neighborhoods/${n.id}`}
            className={`neighborhood-card ${
              i === 0 ? "sm:col-span-2 lg:col-span-2 lg:row-span-1" : ""
            }`}
            data-reveal
            data-cursor="Explore"
            style={{
              height:
                i === 0
                  ? "clamp(380px, 60vh, 560px)"
                  : "clamp(280px, 42vh, 400px)",
            }}
          >
            <img
              src={n.image}
              alt={`${n.name} neighborhood`}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
            <div className="neighborhood-overlay" />
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <p className="eyebrow mb-2" style={{ color: "#C9A96E" }}>
                {n.count} Properties
              </p>
              <h3 className="text-heading-md mb-1" style={{ color: "#F5F0E8" }}>
                {n.name}
              </h3>
              <p
                className="text-sm font-light"
                style={{ color: "rgba(245,240,232,0.65)" }}
              >
                {n.tagline}
              </p>
              <div className="neighborhood-detail mt-4">
                <p
                  className="text-xs font-light mb-3"
                  style={{ color: "rgba(245,240,232,0.6)" }}
                >
                  {n.description}
                </p>
                <p
                  className="text-xs tracking-[0.2em] uppercase font-light"
                  style={{ color: "#C9A96E" }}
                >
                  From {n.avgPrice} avg →
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

/* ──────────────────────────── 08 · WHY CHOOSE US ────────────────────── */

function WhyUsSection() {
  const ref = useReveal<HTMLElement>()
  const { content } = useSiteContent()
  const home = content.home
  const items = home.whyUs

  return (
    <section
      ref={ref}
      style={{ backgroundColor: "#EDE6D6" }}
      className="py-28 lg:py-32"
    >
      <div className="max-w-[1440px] mx-auto px-6 lg:px-16">
        <div className="mb-16 lg:mb-20" data-reveal>
          <p className="eyebrow mb-4" style={{ color: "#C9A96E" }}>
            {home.whyUsEyebrow}
          </p>
          <TextReveal
            as="h2"
            text={home.whyUsTitle}
            className="text-heading-xl"
          />
        </div>
        <div
          className="flex flex-col divide-y"
          style={{ borderColor: "rgba(15,15,13,0.12)" }}
        >
          {items.map((item) => (
            <div
              key={item.num}
              className="grid grid-cols-12 gap-6 py-10 group"
              data-reveal
            >
              <div className="col-span-2 sm:col-span-1">
                <span
                  className="font-light text-heading-md"
                  style={{
                    fontFamily: "var(--font-display)",
                    color: "rgba(15,15,13,0.25)",
                  }}
                >
                  {item.num}
                </span>
              </div>
              <div className="col-span-10 sm:col-span-4 flex items-start">
                <h3
                  className="font-light text-heading-md transition-colors duration-300 group-hover:text-[#C9A96E]"
                  style={{ color: "#0F0F0D" }}
                >
                  {item.title}
                </h3>
              </div>
              <div className="col-span-12 sm:col-span-6 sm:col-start-7 flex items-start">
                <p
                  className="text-sm font-light leading-relaxed"
                  style={{ color: "#6B6560" }}
                >
                  {item.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────── 09 · ARCHITECTURAL STATEMENT ───────────────── */

function ArchStatement() {
  const ref = useReveal<HTMLElement>()
  const { content } = useSiteContent()
  const statement = content.home.archStatement
  return (
    <section
      ref={ref}
      className="relative overflow-hidden"
      style={{ height: "75vh", minHeight: 480, backgroundColor: "#0F0F0D" }}
    >
      <div className="absolute -inset-y-16 inset-x-0" data-parallax>
        <img
          src="https://images.unsplash.com/photo-1502005097973-6a7082348e28?w=1920&h=900&fit=crop&auto=format"
          alt="Interior architecture of an Estate residence"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="relative z-10 flex items-center justify-center h-full px-6 pointer-events-none">
        <div className="text-center">
          <TextReveal
            as="h2"
            text={statement}
            className="font-light text-[clamp(2.6rem,8.5vw,7rem)] leading-[0.92]"
            style={{}}
            start="top 80%"
          />
        </div>
      </div>
    </section>
  )
}

/* ───────────────────────────── 10 · ADVISORS ────────────────────────── */

function AgentsSection() {
  const ref = useReveal<HTMLElement>()
  return (
    <section
      ref={ref}
      className="py-28 lg:py-32 max-w-[1440px] mx-auto px-6 lg:px-16"
    >
      <div
        className="flex justify-between items-end mb-14 lg:mb-20"
        data-reveal
      >
        <div>
          <p className="eyebrow mb-4" style={{ color: "#C9A96E" }}>
            Our Advisors
          </p>
          <TextReveal
            as="h2"
            text="Meet the experts"
            className="text-heading-xl"
          />
        </div>
        <Link
          to="/agents"
          className="hidden md:flex items-center gap-3 text-xs tracking-[0.2em] uppercase font-light transition-colors duration-300 hover:text-[#C9A96E]"
          style={{ color: "#6B6560" }}
        >
          All advisors <span style={{ color: "#C9A96E" }}>→</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {agents.map((a, i) => (
          <div
            key={a.id}
            className="group relative overflow-hidden"
            data-reveal
            data-cursor="View"
            style={{ height: "clamp(400px, 60vh, 600px)" }}
          >
            <Link
              to="/agents"
              className="absolute inset-0"
              aria-label={`Meet ${a.name}, ${a.role}`}
            >
              <img
                src={a.image}
                alt={`Portrait of ${a.name}`}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                style={{ filter: "grayscale(20%)" }}
                loading="lazy"
                decoding="async"
              />
              <div
                className="absolute inset-0 flex flex-col justify-end p-8"
                style={{
                  background:
                    "linear-gradient(to top, rgba(15,15,13,0.85) 0%, transparent 55%)",
                }}
              >
                <h3
                  className="font-light text-heading-md mb-1"
                  style={{ color: "#F5F0E8" }}
                >
                  {a.name}
                </h3>
                <p className="eyebrow mb-3" style={{ color: "#C9A96E" }}>
                  {a.role}
                </p>
                <div
                  className="overflow-hidden"
                  style={{ maxHeight: 0 }}
                  ref={(el) => {
                    if (!el) return
                    const parent = el.parentElement?.parentElement
                    if (!parent) return
                    parent.addEventListener(
                      "mouseenter",
                      () => (el.style.maxHeight = "120px"),
                    )
                    parent.addEventListener(
                      "mouseleave",
                      () => (el.style.maxHeight = "0"),
                    )
                  }}
                >
                  <p
                    className="text-xs font-light mb-1"
                    style={{ color: "rgba(245,240,232,0.6)" }}
                  >
                    {a.experience} years · {a.properties} properties
                  </p>
                  <p
                    className="text-xs font-light mb-3"
                    style={{ color: "rgba(245,240,232,0.5)" }}
                  >
                    {a.languages}
                  </p>
                  <p
                    className="text-xs tracking-[0.2em] uppercase font-light"
                    style={{ color: "#F5F0E8" }}
                  >
                    View profile →
                  </p>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ─────────────────────────── 11 · TESTIMONIALS ──────────────────────── */

const TESTIMONIALS = [
  {
    quote:
      "Estate didn't just find us a house — they found us a home that we'll pass down through generations.",
    client: "H.H. Prince Faisal Al-Saud",
    meta: "Horizon Villa · Obhur",
  },
  {
    quote:
      "The level of discretion and expertise was unlike anything we had experienced elsewhere.",
    client: "Amira and Tariq Hassan",
    meta: "Riviera Penthouse · Al Rawdah",
  },
  {
    quote:
      "I've worked with firms across three continents. Estate is in a class of their own.",
    client: "Dr. Khalid Al-Jabri",
    meta: "Maison Blanc · Al Shati",
  },
]

function TestimonialsSection() {
  const ref = useReveal<HTMLElement>()
  const [idx, setIdx] = useState(0)
  const reduced = useReducedMotion()

  useEffect(() => {
    const id = window.setInterval(
      () => setIdx((i) => (i + 1) % TESTIMONIALS.length),
      7000,
    )
    return () => window.clearInterval(id)
  }, [])

  useGSAP(
    () => {
      const el = ref.current
      if (!el || reduced) return
      const active = el.querySelector<HTMLElement>(
        `[data-testimonial="${idx}"]`,
      )
      if (!active) return
      gsap.fromTo(
        active.querySelectorAll("blockquote, figcaption"),
        {
          opacity: 0,
          y: 18,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: EASE.editorial,
          stagger: 0.08,
        },
      )
    },
    { scope: ref, dependencies: [idx, reduced] },
  )

  return (
    <section
      ref={ref}
      style={{ backgroundColor: "#1C1C1A" }}
      className="py-28 lg:py-36"
    >
      <div className="max-w-4xl mx-auto px-6 text-center">
        <p className="eyebrow mb-16" style={{ color: "#C9A96E" }}>
          Client Stories
        </p>
        <div className="relative min-h-[260px]">
          {TESTIMONIALS.map((t, i) => (
            <figure
              key={i}
              data-testimonial={i}
              aria-hidden={i !== idx}
              className="absolute inset-0 flex flex-col items-center justify-center transition-all duration-700"
              style={{
                opacity: i === idx ? 1 : 0,
                transform: i === idx ? "translateY(0)" : "translateY(16px)",
                pointerEvents: i === idx ? "auto" : "none",
              }}
            >
              <blockquote
                className="font-light leading-relaxed mb-8 italic text-[clamp(1.25rem,2.6vw,1.75rem)]"
                style={{ fontFamily: "var(--font-display)", color: "#F5F0E8" }}
              >
                “{t.quote}”
              </blockquote>
              <figcaption>
                <p className="text-sm font-light" style={{ color: "#F5F0E8" }}>
                  {t.client}
                </p>
                <p
                  className="text-xs font-light mt-1"
                  style={{ color: "#6B6560" }}
                >
                  {t.meta}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
        <div
          className="flex justify-center gap-2 mt-12"
          role="tablist"
          aria-label="Testimonials"
        >
          {TESTIMONIALS.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={idx === i}
              onClick={() => setIdx(i)}
              className="transition-all duration-300"
              style={{
                width: idx === i ? "32px" : "8px",
                height: "2px",
                backgroundColor:
                  idx === i ? "#C9A96E" : "rgba(245,240,232,0.2)",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
              aria-label={`Show testimonial ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────── 12 · CTA ───────────────────────────── */

function CtaSection() {
  const ref = useReveal<HTMLElement>()
  const { content } = useSiteContent()
  const home = content.home
  const ctaWords = home.ctaTitle.trim().split(/\s+/)
  const ctaLead = ctaWords.slice(0, -1).join(" ") || home.ctaTitle
  const ctaTail = ctaWords[ctaWords.length - 1] ?? ""

  return (
    <section
      ref={ref}
      className="relative overflow-hidden"
      style={{ height: "85vh", minHeight: 560, backgroundColor: "#0F0F0D" }}
    >
      <div className="absolute -inset-y-20 inset-x-0" data-parallax>
        <img
          src="https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=1920&h=1080&fit=crop&auto=format"
          alt="Luxury interior of an Estate residence"
          className="absolute inset-0 w-full h-full object-cover opacity-55"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(15,15,13,0.72) 0%, rgba(15,15,13,0.4) 100%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-6">
        <p className="eyebrow mb-8" style={{ color: "#C9A96E" }} data-reveal>
          {home.ctaEyebrow}
        </p>
        <h2
          className="font-light mb-12 text-[clamp(2.8rem,7vw,6rem)] leading-[0.9]"
          style={{ color: "#F5F0E8" }}
          data-reveal
        >
          {ctaLead}
          <br />
          <em className="italic" style={{ color: "#C9A96E" }}>
            {ctaTail}
          </em>
        </h2>
        <div className="flex flex-col sm:flex-row gap-4" data-reveal>
          <Magnetic>
            <Link to="/properties" className="btn-primary btn-on-dark">
              {home.ctaPrimaryLabel}
            </Link>
          </Magnetic>
          <Magnetic>
            <Link to="/contact" className="btn-outline btn-on-dark">
              {home.ctaSecondaryLabel}
            </Link>
          </Magnetic>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────── PAGE ─────────────────────────────── */

export default function Home() {
  return (
    <div>
      <Hero />
      <FeaturedSection />
      <HorizontalShowcase />
      <FlagshipStory />
      <DiscoverySection />
      <StatsSection />
      <NeighborhoodsSection />
      <WhyUsSection />
      <ArchStatement />
      <AgentsSection />
      <TestimonialsSection />
      <CtaSection />
    </div>
  )
}
