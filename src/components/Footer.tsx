import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import { publicNewsletterApi } from "../services/newsletter"
import { useSiteContent } from "../services/siteContent"

export default function Footer() {
  const { content } = useSiteContent()
  const { footer } = content
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle")
  const [feedback, setFeedback] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const subscribe = async () => {
    const value = email.trim()
    if (!value) {
      inputRef.current?.focus()
      return
    }
    setStatus("busy")
    setFeedback("")
    try {
      await publicNewsletterApi.subscribe(value)
      setStatus("done")
      setFeedback("You're on the list — welcome.")
      setEmail("")
    } catch (err) {
      setStatus("error")
      setFeedback(err instanceof Error ? err.message : "Could not subscribe")
    }
  }

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
                {footer.brandName}
              </span>
            </div>
            <p
              className="text-sm font-light leading-relaxed mb-8"
              style={{ color: "#6B6560" }}
            >
              {footer.tagline}
            </p>
            <div className="flex gap-5">
              {footer.socials.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-xs tracking-[0.2em] uppercase font-light transition-colors duration-300 hover:text-[#C9A96E]"
                  style={{ color: "#6B6560" }}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="eyebrow mb-6" style={{ color: "#C9A96E" }}>
              {footer.propertiesTitle}
            </p>
            <div className="flex flex-col gap-3">
              {footer.propertyLinks.map((item) => (
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
              {footer.companyTitle}
            </p>
            <div className="flex flex-col gap-3">
              {footer.companyLinks.map((item) => (
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
              {footer.contactTitle}
            </p>
            <div className="flex flex-col gap-3 mb-10">
              <p
                className="text-sm font-light"
                style={{ color: "rgba(245,240,232,0.6)" }}
              >
                {footer.addressLines.map((line) => (
                  <span key={line}>
                    {line}
                    <br />
                  </span>
                ))}
              </p>
              <a
                href={`tel:${footer.phone.replace(/[^0-9+]/g, "")}`}
                className="text-sm font-light transition-colors hover:text-[#C9A96E]"
                style={{ color: "rgba(245,240,232,0.6)" }}
              >
                {footer.phone}
              </a>
              <a
                href={`mailto:${footer.email}`}
                className="text-sm font-light transition-colors hover:text-[#C9A96E]"
                style={{ color: "rgba(245,240,232,0.6)" }}
              >
                {footer.email}
              </a>
            </div>
            <p className="eyebrow mb-4" style={{ color: "#6B6560" }}>
              {footer.newsletterTitle}
            </p>
            <div
              className="flex border-b"
              style={{ borderColor: "rgba(245,240,232,0.2)" }}
            >
              <input
                ref={inputRef}
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (status === "done" || status === "error") {
                    setStatus("idle")
                    setFeedback("")
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    subscribe()
                  }
                }}
                placeholder={footer.newsletterPlaceholder}
                aria-label="Email address"
                className="flex-1 bg-transparent text-sm font-light py-3 outline-none"
                style={{ color: "#F5F0E8" }}
              />
              <button
                onClick={subscribe}
                disabled={status === "busy"}
                className="text-[#C9A96E] text-xs tracking-[0.2em] uppercase py-3 pl-4 hover:text-[#F5F0E8] transition-colors disabled:opacity-50"
                aria-label="Subscribe"
              >
                →
              </button>
            </div>
            {feedback ? (
              <p
                className="text-xs font-light mt-3"
                style={{ color: status === "error" ? "#E29B85" : "#C9A96E" }}
              >
                {feedback}
              </p>
            ) : null}
          </div>
        </div>

        <div
          className="border-t mb-8"
          style={{ borderColor: "rgba(245,240,232,0.08)" }}
        />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <p className="text-xs font-light" style={{ color: "#6B6560" }}>
            {footer.copyright}
          </p>
          <div className="flex gap-6">
            {footer.legalLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-xs font-light hover:text-[#C9A96E] transition-colors"
                style={{ color: "#6B6560" }}
              >
                {item.label}
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
            {footer.brandName}
          </span>
        </div>
      </div>
    </footer>
  )
}