import { agents } from "../data/properties"
import { useReveal } from "../hooks/useReveal"
import { useGSAP } from "@gsap/react"
import { gsap } from "../animations/gsap"
import { EASE } from "../animations/easings"
import { useReducedMotion } from "../hooks/useReducedMotion"

export default function Agents() {
  const ref = useReveal<HTMLDivElement>()
  const reduced = useReducedMotion()

  useGSAP(
    () => {
      const el = ref.current
      if (!el || reduced) return
      el.querySelectorAll(".agent-card").forEach((card) => {
        const img = card.querySelector("img")
        if (!img) return
        const onEnter = () =>
          gsap.to(img, { scale: 1.06, duration: 0.8, ease: EASE.ui })
        const onLeave = () =>
          gsap.to(img, { scale: 1, duration: 0.8, ease: EASE.ui })
        card.addEventListener("mouseenter", onEnter)
        card.addEventListener("mouseleave", onLeave)
      })
    },
    { dependencies: [reduced] },
  )

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
        <div className="max-w-[1440px] mx-auto px-6 lg:px-16">
          <p className="eyebrow mb-4" style={{ color: "#C9A96E" }} data-reveal>
            The Team
          </p>
          <h1
            className="text-display-lg"
            style={{ color: "#F5F0E8" }}
            data-reveal
          >
            Our Advisors
          </h1>
          <p
            className="text-sm font-light mt-5 max-w-xl leading-relaxed"
            style={{ color: "rgba(245,240,232,0.7)" }}
            data-reveal
          >
            A small team of specialists with careers devoted entirely to
            Jeddah's luxury market. Speak to one directly.
          </p>
        </div>
      </div>

      {/* Team grid */}
      <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {agents.map((a) => (
            <div key={a.id} className="agent-card" data-reveal>
              <div
                className="overflow-hidden mb-6"
                style={{ aspectRatio: "4/5" }}
              >
                <img
                  src={a.image}
                  alt={a.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                  style={{ filter: "grayscale(15%)" }}
                />
              </div>
              <h2 className="text-heading-md mb-1" style={{ color: "#0F0F0D" }}>
                {a.name}
              </h2>
              <p className="eyebrow mb-4" style={{ color: "#C9A96E" }}>
                {a.role}
              </p>
              <p
                className="text-sm font-light mb-6"
                style={{ color: "#6B6560" }}
              >
                {a.experience} years · {a.properties} properties · {a.languages}
              </p>
              <div className="flex gap-3">
                <a
                  href={`tel:${a.phone.replace(/[^+\d]/g, "")}`}
                  className="flex-1 text-center py-3 text-xs tracking-[0.2em] uppercase font-light border transition-colors"
                  style={{
                    borderColor: "rgba(15,15,13,0.2)",
                    color: "#0F0F0D",
                  }}
                  onMouseEnter={(e) => {
                    const t = e.currentTarget
                    t.style.backgroundColor = "#0F0F0D"
                    t.style.color = "#F5F0E8"
                  }}
                  onMouseLeave={(e) => {
                    const t = e.currentTarget
                    t.style.backgroundColor = ""
                    t.style.color = "#0F0F0D"
                  }}
                >
                  Call
                </a>
                <a
                  href={`mailto:${a.email}`}
                  className="flex-1 text-center py-3 text-xs tracking-[0.2em] uppercase font-light transition-colors"
                  style={{ backgroundColor: "#0F0F0D", color: "#F5F0E8" }}
                  onMouseEnter={(e) => {
                    const t = e.currentTarget
                    t.style.backgroundColor = "#C9A96E"
                    t.style.color = "#0F0F0D"
                  }}
                  onMouseLeave={(e) => {
                    const t = e.currentTarget
                    t.style.backgroundColor = "#0F0F0D"
                    t.style.color = "#F5F0E8"
                  }}
                >
                  Email
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div
          className="mt-24 p-12 md:p-16 flex flex-col md:flex-row md:items-center md:justify-between gap-8"
          style={{ backgroundColor: "#0F0F0D" }}
          data-reveal
        >
          <div>
            <h2 className="text-heading-md mb-2" style={{ color: "#F5F0E8" }}>
              Looking for the right advisor?
            </h2>
            <p
              className="text-sm font-light"
              style={{ color: "rgba(245,240,232,0.7)" }}
            >
              Tell us about your goals and we'll match you with the perfect
              partner.
            </p>
          </div>
          <a
            href="mailto:hello@estate.sa"
            className="btn-on-dark btn-primary self-start"
          >
            hello@estate.sa
          </a>
        </div>
      </div>
    </div>
  )
}
