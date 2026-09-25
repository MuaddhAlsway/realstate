import { useState, type FormEvent } from "react"
import { api } from "../services/api"
import { useReveal } from "../hooks/useReveal"
import { useSiteContent } from "../services/siteContent"

interface ContactForm {
  name: string
  email: string
  phone: string
  subject: string
  message: string
}

const EMPTY: ContactForm = {
  name: "",
  email: "",
  phone: "",
  subject: "",
  message: "",
}

export default function Contact() {
  const ref = useReveal<HTMLDivElement>()
  const { content } = useSiteContent()
  const contact = content.contact
  const [form, setForm] = useState<ContactForm>(EMPTY)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      await api.createContact({
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        subject: form.subject || undefined,
        message: form.message,
      })
      setSent(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not send your message. Please try again.",
      )
    } finally {
      setSending(false)
    }
  }

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
            {contact.eyebrow}
          </p>
          <h1
            className="text-display-lg"
            style={{ color: "#F5F0E8" }}
            data-reveal
          >
            {contact.heading}
          </h1>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-20">
          {/* Contact info */}
          <div className="lg:col-span-4" data-reveal>
            <div className="mb-16">
              <p className="eyebrow mb-6" style={{ color: "#C9A96E" }}>
                {contact.officesEyebrow}
              </p>
              <p
                className="text-sm font-light mb-1"
                style={{ color: "#0F0F0D" }}
              >
                {contact.officeName}
              </p>
              <p
                className="text-sm font-light leading-relaxed"
                style={{ color: "#6B6560" }}
              >
                {contact.addressLines.map((line) => (
                  <span key={line}>
                    {line}
                    <br />
                  </span>
                ))}
              </p>
            </div>

            <div className="mb-16">
              <p className="eyebrow mb-6" style={{ color: "#C9A96E" }}>
                {contact.directEyebrow}
              </p>
              <div className="flex flex-col gap-4">
                <div>
                  <p
                    className="text-xs font-light mb-1"
                    style={{ color: "#A09890" }}
                  >
                    {contact.salesLabel}
                  </p>
                  <a
                    href={`tel:${contact.salesPhone.replace(/[^0-9+]/g, "")}`}
                    className="text-sm font-light hover:text-[#C9A96E] transition-colors"
                    style={{ color: "#0F0F0D" }}
                  >
                    {contact.salesPhone}
                  </a>
                </div>
                <div>
                  <p
                    className="text-xs font-light mb-1"
                    style={{ color: "#A09890" }}
                  >
                    {contact.emailLabel}
                  </p>
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-sm font-light hover:text-[#C9A96E] transition-colors"
                    style={{ color: "#0F0F0D" }}
                  >
                    {contact.email}
                  </a>
                </div>
              </div>
            </div>

            <div>
              <p className="eyebrow mb-6" style={{ color: "#C9A96E" }}>
                {contact.hoursEyebrow}
              </p>
              <p className="text-sm font-light" style={{ color: "#6B6560" }}>
                {contact.hoursLines.map((line) => (
                  <span key={line}>
                    {line}
                    <br />
                  </span>
                ))}
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-7 lg:col-start-6" data-reveal>
            {sent ? (
              <div className="flex flex-col items-start justify-center h-full gap-4">
                <p
                  className="font-light"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "2.5rem",
                    color: "#0F0F0D",
                  }}
                >
                  {contact.successTitle}
                </p>
                <p className="text-sm font-light" style={{ color: "#6B6560" }}>
                  {contact.successText}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSent(false)
                    setForm(EMPTY)
                  }}
                  className="mt-4 text-xs tracking-[0.2em] uppercase font-light hover:text-[#C9A96E] transition-colors"
                  style={{ color: "#0F0F0D" }}
                >
                  {contact.sendAnotherLabel}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {[
                    {
                      key: "name" as const,
                      label: "Full Name",
                      type: "text",
                      required: true,
                    },
                    {
                      key: "email" as const,
                      label: "Email Address",
                      type: "email",
                      required: true,
                    },
                    {
                      key: "phone" as const,
                      label: "Phone Number",
                      type: "tel",
                      required: false,
                    },
                    {
                      key: "subject" as const,
                      label: "Subject",
                      type: "text",
                      required: false,
                    },
                  ].map((f) => (
                    <div key={f.key} className="flex flex-col">
                      <label
                        className="eyebrow mb-3"
                        style={{ color: "#A09890" }}
                      >
                        {f.label}
                        {f.required && " *"}
                      </label>
                      <input
                        type={f.type}
                        required={f.required}
                        value={form[f.key]}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            [f.key]: e.target.value,
                          }))
                        }
                        className="border-b pb-3 text-sm font-light outline-none bg-transparent"
                        style={{
                          borderColor: "rgba(15,15,13,0.15)",
                          color: "#0F0F0D",
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-col">
                  <label className="eyebrow mb-3" style={{ color: "#A09890" }}>
                    Message *
                  </label>
                  <textarea
                    required
                    rows={6}
                    value={form.message}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, message: e.target.value }))
                    }
                    placeholder="Tell us about your property requirements…"
                    className="border-b pb-3 text-sm font-light outline-none bg-transparent resize-none"
                    style={{
                      borderColor: "rgba(15,15,13,0.15)",
                      color: "#0F0F0D",
                    }}
                  />
                </div>

                {error && (
                  <p
                    className="text-sm font-light"
                    role="alert"
                    style={{ color: "#B4432E" }}
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  className="self-start px-12 py-4 text-xs tracking-[0.3em] uppercase font-light transition-colors hover:bg-[#C9A96E] disabled:opacity-60"
                  style={{ backgroundColor: "#0F0F0D", color: "#F5F0E8" }}
                >
                  {sending ? "Sending…" : "Send Message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
