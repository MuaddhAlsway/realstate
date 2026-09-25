import { Link } from "react-router-dom"
import { agents } from "../data/properties"
import { useReveal } from "../hooks/useReveal"

export default function About() {
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
            Who We Are
          </p>
          <h1
            className="text-display-lg"
            style={{ color: "#F5F0E8" }}
            data-reveal
          >
            About Estate
          </h1>
        </div>
      </div>

      {/* Intro */}
      <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 mb-32">
          <div className="lg:col-span-6" data-reveal>
            <p
              className="font-light leading-relaxed"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.5rem, 2.5vw, 2.2rem)",
                color: "#0F0F0D",
                lineHeight: "1.4",
              }}
            >
              Since 2012, we have been Jeddah's most trusted name in luxury real
              estate — not by volume, but by the singular standard we hold every
              property and every client relationship to.
            </p>
          </div>
          <div className="lg:col-span-5 lg:col-start-8" data-reveal>
            <p
              className="text-sm font-light leading-relaxed mb-6"
              style={{ color: "#6B6560" }}
            >
              Estate was founded on a singular belief: that exceptional
              properties deserve exceptional representation. We are not a
              marketplace — we are curators, advisors, and advocates.
            </p>
            <p
              className="text-sm font-light leading-relaxed"
              style={{ color: "#6B6560" }}
            >
              Our team combines deep local knowledge with international
              perspectives, allowing us to serve clients from across Saudi
              Arabia and the world with the same precision and discretion.
            </p>
          </div>
        </div>

        {/* Full-width image */}
        <div
          className="mb-32"
          style={{ height: "clamp(300px, 55vh, 600px)" }}
          data-frame
        >
          <img
            src="https://images.unsplash.com/photo-1502005097973-6a7082348e28?w=1920&h=700&fit=crop&auto=format"
            alt="Estate office architecture"
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>

        {/* Values */}
        <div className="mb-32">
          <p className="eyebrow mb-12" style={{ color: "#C9A96E" }} data-reveal>
            Our Values
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
            {[
              {
                num: "01",
                title: "Curation",
                text: "We select fewer than 5% of available properties — only those meeting our exacting criteria for architecture, location, and living quality.",
              },
              {
                num: "02",
                title: "Discretion",
                text: "Every transaction is conducted with absolute confidentiality. Our clients' privacy is never a variable.",
              },
              {
                num: "03",
                title: "Expertise",
                text: "Over twelve years, hundreds of transactions, and a team with careers dedicated entirely to the luxury segment.",
              },
            ].map((v) => (
              <div
                key={v.num}
                className="p-10"
                style={{ backgroundColor: "#EDE6D6" }}
                data-reveal
              >
                <span
                  className="block font-light mb-6"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "3rem",
                    color: "rgba(15,15,13,0.15)",
                  }}
                >
                  {v.num}
                </span>
                <h3
                  className="text-heading-md mb-4"
                  style={{ color: "#0F0F0D" }}
                >
                  {v.title}
                </h3>
                <p
                  className="text-sm font-light leading-relaxed"
                  style={{ color: "#6B6560" }}
                >
                  {v.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Team */}
        <div className="mb-24">
          <p className="eyebrow mb-12" style={{ color: "#C9A96E" }} data-reveal>
            The Team
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
            {agents.map((a) => (
              <div key={a.id} className="group" data-reveal>
                <div
                  className="overflow-hidden mb-5"
                  style={{ height: "420px" }}
                >
                  <img
                    src={a.image}
                    alt={a.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    style={{ filter: "grayscale(15%)" }}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <h3
                  className="text-heading-md mb-1"
                  style={{ color: "#0F0F0D" }}
                >
                  {a.name}
                </h3>
                <p className="eyebrow mb-2" style={{ color: "#C9A96E" }}>
                  {a.role}
                </p>
                <p className="text-xs font-light" style={{ color: "#A09890" }}>
                  {a.experience} years · {a.languages}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div
          className="flex flex-col md:flex-row md:items-center md:justify-between py-16 px-10 md:px-16"
          style={{ backgroundColor: "#0F0F0D" }}
          data-reveal
        >
          <h2
            className="text-heading-xl mb-8 md:mb-0"
            style={{ color: "#F5F0E8" }}
          >
            Ready to find your perfect home?
          </h2>
          <div className="flex gap-4">
            <Link to="/properties" className="btn-on-dark btn-primary">
              Browse Properties
            </Link>
            <Link to="/contact" className="btn-on-dark btn-outline">
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
