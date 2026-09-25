import { Link } from "react-router-dom"
import { neighborhoods, properties } from "../data/properties"
import { useReveal } from "../hooks/useReveal"

export default function Neighborhoods() {
  const ref = useReveal<HTMLDivElement>()

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
            Jeddah
          </p>
          <h1
            className="text-display-lg"
            style={{ color: "#F5F0E8" }}
            data-reveal
          >
            Neighborhoods
          </h1>
          <p
            className="text-sm font-light mt-5 max-w-xl leading-relaxed"
            style={{ color: "rgba(245,240,232,0.75)" }}
            data-reveal
          >
            Each district has a character of its own. Begin with the water, then
            let the city lead you.
          </p>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-24">
        {neighborhoods.map((n, i) => {
          const nProps = properties.filter((p) => p.neighborhood === n.name)
          const reverse = i % 2 === 1
          return (
            <Link
              key={n.id}
              to={`/neighborhoods/${n.id}`}
              className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-32 group block"
            >
              {/* Image */}
              <div
                className={`img-mask ${
                  reverse ? "lg:col-span-6 lg:col-start-7" : "lg:col-span-6"
                }`}
                style={{ height: "clamp(350px, 55vh, 600px)" }}
                data-frame
              >
                <img
                  src={n.image}
                  alt={n.name}
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
                />
              </div>

              {/* Info */}
              <div
                className={`flex flex-col justify-center ${
                  reverse
                    ? "lg:col-span-5 lg:col-start-1 lg:row-start-1"
                    : "lg:col-span-5 lg:col-start-8"
                }`}
                data-reveal
              >
                <span
                  className="block font-light mb-4"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "5rem",
                    color: "rgba(15,15,13,0.06)",
                    lineHeight: 1,
                  }}
                >
                  0{i + 1}
                </span>
                <p className="eyebrow mb-4" style={{ color: "#C9A96E" }}>
                  {n.tagline}
                </p>
                <h2
                  className="font-light mb-6 transition-colors group-hover:text-[#C9A96E]"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(2rem, 4vw, 3.5rem)",
                    color: "#0F0F0D",
                  }}
                >
                  {n.name}
                </h2>
                <p
                  className="text-sm font-light leading-relaxed mb-8"
                  style={{ color: "#6B6560" }}
                >
                  {n.description}
                </p>
                <div
                  className="flex gap-8 mb-8 pb-8 border-b"
                  style={{ borderColor: "rgba(15,15,13,0.1)" }}
                >
                  <div>
                    <p
                      className="text-xs font-light mb-1"
                      style={{ color: "#A09890" }}
                    >
                      Properties
                    </p>
                    <p
                      className="text-lg font-light"
                      style={{
                        fontFamily: "var(--font-display)",
                        color: "#0F0F0D",
                      }}
                    >
                      {n.count}
                    </p>
                  </div>
                  <div>
                    <p
                      className="text-xs font-light mb-1"
                      style={{ color: "#A09890" }}
                    >
                      Avg. Price
                    </p>
                    <p
                      className="text-lg font-light"
                      style={{
                        fontFamily: "var(--font-display)",
                        color: "#0F0F0D",
                      }}
                    >
                      {n.avgPrice}
                    </p>
                  </div>
                  <div>
                    <p
                      className="text-xs font-light mb-1"
                      style={{ color: "#A09890" }}
                    >
                      Live Listings
                    </p>
                    <p
                      className="text-lg font-light"
                      style={{
                        fontFamily: "var(--font-display)",
                        color: "#0F0F0D",
                      }}
                    >
                      {nProps.length}
                    </p>
                  </div>
                </div>
                <span
                  className="self-start text-xs tracking-[0.3em] uppercase font-light border px-8 py-3.5 transition-colors group-hover:border-[#C9A96E] group-hover:text-[#C9A96E]"
                  style={{
                    borderColor: "rgba(15,15,13,0.25)",
                    color: "#0F0F0D",
                  }}
                >
                  Explore {nProps.length > 0 ? nProps.length : n.count}{" "}
                  Properties →
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
