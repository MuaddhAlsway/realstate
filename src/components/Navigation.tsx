import { useState, useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useFavorites } from "../context/FavoritesContext"

const NAV_LINKS = [
  { label: "Properties", href: "/properties" },
  { label: "Buy", href: "/properties?type=buy" },
  { label: "Rent", href: "/properties?type=rent" },
  { label: "Neighborhoods", href: "/neighborhoods" },
  { label: "Agents", href: "/agents" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
]

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const { user } = useAuth()
  const { favorites } = useFavorites()

  const isDark = location.pathname !== "/"
  const isLight = !isDark && !scrolled && !menuOpen

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [location])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [menuOpen])

  const accent = isLight ? "rgba(245,240,232,0.8)" : "rgba(245,240,232,0.8)"
  const pageLink = (label: string, href: string) => (
    <Link
      key={label}
      to={href}
      className="text-xs tracking-[0.2em] uppercase font-light transition-colors duration-300 hover:text-[#C9A96E]"
      style={{ color: accent }}
    >
      {label}
    </Link>
  )

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
        style={{
          backgroundColor:
            scrolled || isDark ? "rgba(15,15,13,0.96)" : "transparent",
          backdropFilter: scrolled || isDark ? "blur(12px)" : "none",
          borderBottom:
            scrolled || isDark ? "1px solid rgba(255,255,255,0.08)" : "none",
          padding: scrolled ? "14px 0" : "22px 0",
        }}
      >
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-3 group"
            aria-label="Estate — home"
          >
            <span
              className="text-lg font-light tracking-[0.4em] uppercase"
              style={{ fontFamily: "var(--font-display)", color: "#F5F0E8" }}
            >
              Estate
            </span>
            <span
              className="mt-1 hidden sm:block h-px w-8"
              style={{ backgroundColor: "rgba(201,169,110,0.7)" }}
            />
          </Link>

          {/* Desktop links */}
          <div className="hidden lg:flex items-center gap-7 xl:gap-8">
            {NAV_LINKS.map((l) => pageLink(l.label, l.href))}
          </div>

          {/* Right actions */}
          <div className="hidden lg:flex items-center gap-6">
            <Link
              to="/saved"
              className="relative transition-colors duration-300 hover:text-[#C9A96E]"
              style={{ color: accent }}
              aria-label={`Saved properties (${favorites.length})`}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill={favorites.length ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {favorites.length > 0 && (
                <span
                  className="absolute -top-2 -right-2 w-4 h-4 flex items-center justify-center text-[10px] rounded-full"
                  style={{ backgroundColor: "#C9A96E", color: "#0F0F0D" }}
                >
                  {favorites.length}
                </span>
              )}
            </Link>

            <Link
              to={user ? "/dashboard" : "/auth"}
              className="transition-colors duration-300 hover:text-[#C9A96E]"
              style={{ color: accent }}
              aria-label={user ? "Your dashboard" : "Sign in"}
            >
              {user ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
                </svg>
              )}
            </Link>

            <Link
              to="/contact"
              className="btn-magnetic text-xs tracking-[0.2em] uppercase font-light px-6 py-2.5 border transition-all duration-300"
              style={{ borderColor: "#C9A96E", color: "#C9A96E" }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.backgroundColor =
                  "#C9A96E"
                ;(e.currentTarget as HTMLElement).style.color = "#0F0F0D"
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.backgroundColor =
                  "transparent"
                ;(e.currentTarget as HTMLElement).style.color = "#C9A96E"
              }}
            >
              List Property
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="lg:hidden flex flex-col gap-[5px] p-2"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <span
              className="block w-6 h-px transition-all duration-500"
              style={{
                backgroundColor: "#F5F0E8",
                transform: menuOpen ? "translateY(6px) rotate(45deg)" : "",
              }}
            />
            <span
              className="block w-4 h-px transition-all duration-500"
              style={{ backgroundColor: "#F5F0E8", opacity: menuOpen ? 0 : 1 }}
            />
            <span
              className="block w-6 h-px transition-all duration-500"
              style={{
                backgroundColor: "#F5F0E8",
                transform: menuOpen ? "translateY(-6px) rotate(-45deg)" : "",
              }}
            />
          </button>
        </div>
      </nav>

      {/* Fullscreen mobile menu */}
      <div className={`fullscreen-menu ${menuOpen ? "open" : ""}`}>
        <div className="flex flex-col h-full justify-center px-8 md:px-12 py-24">
          <div className="mb-12">
            <span
              className="text-2xl font-light tracking-[0.4em] uppercase"
              style={{ fontFamily: "var(--font-display)", color: "#F5F0E8" }}
            >
              Estate
            </span>
          </div>
          <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
            {NAV_LINKS.map((link, i) => (
              <Link
                key={link.label}
                to={link.href}
                className="text-4xl md:text-5xl font-light tracking-wide transition-colors duration-300 hover:text-[#C9A96E] py-1"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "#F5F0E8",
                  transitionDelay: `${i * 60}ms`,
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-12 flex flex-wrap gap-6">
            <Link
              to="/saved"
              className="text-xs tracking-[0.25em] uppercase font-light"
              style={{ color: "#C9A96E" }}
            >
              Saved ({favorites.length})
            </Link>
            <Link
              to={user ? "/dashboard" : "/auth"}
              className="text-xs tracking-[0.25em] uppercase font-light"
              style={{ color: "#C9A96E" }}
            >
              {user ? "Account" : "Sign in"}
            </Link>
          </div>
          <div className="mt-12 flex flex-col gap-4">
            <p
              className="text-xs tracking-[0.3em] uppercase"
              style={{ color: "#6B6560" }}
            >
              Contact
            </p>
            <a
              href="tel:+966123456789"
              className="text-lg font-light"
              style={{ color: "#F5F0E8" }}
            >
              +966 12 345 6789
            </a>
            <a
              href="mailto:hello@estate.sa"
              className="text-lg font-light"
              style={{ color: "#C9A96E" }}
            >
              hello@estate.sa
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
