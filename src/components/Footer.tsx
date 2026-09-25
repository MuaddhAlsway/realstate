import { Link } from "react-router-dom"

const PROPERTY_LINKS = [
  { label: "Buy", href: "/properties?type=buy" },
  { label: "Rent", href: "/properties?type=rent" },
  { label: "All Properties", href: "/properties" },
  { label: "Neighborhoods", href: "/neighborhoods" },
  { label: "Saved", href: "/saved" },
]

const COMPANY_LINKS = [
  { label: "About", href: "/about" },
  { label: "Agents", href: "/agents" },
  { label: "Contact", href: "/contact" },
  { label: "Dashboard", href: "/dashboard" },
]

export default function Footer() {
  return (
    <footer style={{ backgroundColor: "#0F0F0D", color: "#F5F0E8" }}>
      <div className="max-w-[1440px] mx-auto px-8 pt-24 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-16 mb-24">
          <div className="lg:col-span-1">
            <div className="mb-6">
              <span
                className="text-3xl font-light tracking-[0.3em] uppercase"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Estate
              </span>
            </div>
            <p
              className="text-sm font-light leading-relaxed mb-8"
              style={{ color: "#6B6560" }}
            >
              Curating exceptional properties for discerning buyers and
              investors across Saudi Arabia.
            </p>
            <div className="flex gap-5">
              {["Instagram", "LinkedIn", "YouTube"].map((s) => (
                <a
                  key={s}
                  href="#"
                  className="text-xs tracking-[0.2em] uppercase font-light transition-colors duration-300 hover:text-[#C9A96E]"
                  style={{ color: "#6B6560" }}
                >
                  {s}
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="eyebrow mb-6" style={{ color: "#C9A96E" }}>
              Properties
            </p>
            <div className="flex flex-col gap-3">
              {PROPERTY_LINKS.map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  className="text-sm font-light transition-colors duration-300 hover:text-[#C9A96E]"
                  style={{ color: "rgba(245,240,232,0.6)" }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="eyebrow mb-6" style={{ color: "#C9A96E" }}>
              Company
            </p>
            <div className="flex flex-col gap-3">
              {COMPANY_LINKS.map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  className="text-sm font-light transition-colors duration-300 hover:text-[#C9A96E]"
                  style={{ color: "rgba(245,240,232,0.6)" }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="eyebrow mb-6" style={{ color: "#C9A96E" }}>
              Contact
            </p>
            <div className="flex flex-col gap-3 mb-10">
              <p
                className="text-sm font-light"
                style={{ color: "rgba(245,240,232,0.6)" }}
              >
                Al Shati District, Jeddah
                <br />
                Saudi Arabia 23434
              </p>
              <a
                href="tel:+966123456789"
                className="text-sm font-light transition-colors hover:text-[#C9A96E]"
                style={{ color: "rgba(245,240,232,0.6)" }}
              >
                +966 12 345 6789
              </a>
              <a
                href="mailto:hello@estate.sa"
                className="text-sm font-light transition-colors hover:text-[#C9A96E]"
                style={{ color: "rgba(245,240,232,0.6)" }}
              >
                hello@estate.sa
              </a>
            </div>
            <p className="eyebrow mb-4" style={{ color: "#6B6560" }}>
              Newsletter
            </p>
            <div
              className="flex border-b"
              style={{ borderColor: "rgba(245,240,232,0.2)" }}
            >
              <input
                type="email"
                placeholder="Your email"
                aria-label="Email address"
                className="flex-1 bg-transparent text-sm font-light py-3 outline-none"
                style={{ color: "#F5F0E8" }}
              />
              <button
                className="text-[#C9A96E] text-xs tracking-[0.2em] uppercase py-3 pl-4 hover:text-[#F5F0E8] transition-colors"
                aria-label="Subscribe"
              >
                →
              </button>
            </div>
          </div>
        </div>

        <div
          className="border-t mb-8"
          style={{ borderColor: "rgba(245,240,232,0.08)" }}
        />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <p className="text-xs font-light" style={{ color: "#6B6560" }}>
            © 2026 Estate Real Estate. All rights reserved.
          </p>
          <div className="flex gap-6">
            {["Privacy", "Terms", "Cookies"].map((item) => (
              <a
                key={item}
                href="#"
                className="text-xs font-light hover:text-[#C9A96E] transition-colors"
                style={{ color: "#6B6560" }}
              >
                {item}
              </a>
            ))}
          </div>
        </div>

        <div className="mt-16 overflow-hidden select-none">
          <span
            className="text-[clamp(4rem,15vw,14rem)] font-light tracking-[0.05em] uppercase leading-none"
            style={{
              fontFamily: "var(--font-display)",
              color: "rgba(245,240,232,0.04)",
              display: "block",
              whiteSpace: "nowrap",
            }}
          >
            Estate
          </span>
        </div>
      </div>
    </footer>
  )
}
