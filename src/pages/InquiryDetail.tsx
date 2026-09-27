import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import {
  inquiryApi,
  type InquiryDetail as InquiryDetailData,
  type InquiryMessage,
} from "../services/inquiry"
import { inquiryStatusLabel } from "../services/inquiry"
import { REMOTE } from "../services/http"

function timeLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

export default function CustomerInquiryDetail() {
  const { id = "" } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [inquiry, setInquiry] = useState<InquiryDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (!user) {
      navigate("/auth", { replace: true })
      return
    }
    if (!REMOTE) {
      navigate("/dashboard", { replace: true })
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    inquiryApi
      .myInquiry(id)
      .then((detail) => {
        if (!cancelled) setInquiry(detail)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load inquiry")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, user, navigate])

  if (!user) return null

  const sendMessage = async () => {
    const content = draft.trim()
    if (!content) return
    setSending(true)
    try {
      const sent: InquiryMessage = await inquiryApi.sendMyMessage(id, content)
      setInquiry((current) =>
        current ? { ...current, thread: [...current.thread, sent] } : current,
      )
      setDraft("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message")
    } finally {
      setSending(false)
    }
  }

  const cancelInquiry = async () => {
    setCancelling(true)
    try {
      const updated = await inquiryApi.updateMyStatus(id, {
        toStatus: "CANCELLED",
        note: "Cancelled by the customer",
      })
      setInquiry(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel inquiry")
    } finally {
      setCancelling(false)
    }
  }

  const open = inquiry?.status === "PENDING" || inquiry?.status === "IN_PROGRESS"

  return (
    <div style={{ backgroundColor: "#F5F0E8", minHeight: "100vh" }}>
      <div
        style={{
          backgroundColor: "#0F0F0D",
          paddingTop: "120px",
          paddingBottom: "64px",
        }}
      >
        <div className="max-w-[1440px] mx-auto px-6 lg:px-16">
          <Link
            to="/dashboard"
            className="text-xs tracking-[0.25em] uppercase font-light mb-6 inline-block transition-colors hover:text-[#C9A96E]"
            style={{ color: "rgba(245,240,232,0.6)" }}
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-display-lg text-[#F5F0E8]">Inquiry</h1>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-20">
        {error ? (
          <p
            className="p-8 border text-sm font-light"
            style={{ borderColor: "rgba(15,15,13,0.1)", color: "#6B6560" }}
          >
            {error}
          </p>
        ) : loading || !inquiry ? (
          <p className="text-sm font-light text-[#6B6560]">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2">
              <div className="mb-6 flex items-center gap-3">
                <span
                  className="inline-block text-[11px] tracking-[0.15em] uppercase font-light px-3 py-1"
                  style={{
                    color: "#0F0F0D",
                    backgroundColor: "#EDE6D6",
                    border: "1px solid rgba(15,15,13,0.15)",
                  }}
                >
                  {inquiryStatusLabel(inquiry.status)}
                </span>
                {inquiry.createdAt ? (
                  <span className="text-xs font-light" style={{ color: "#6B6560" }}>
                    Submitted {timeLabel(inquiry.createdAt)}
                  </span>
                ) : null}
              </div>

              {inquiry.property ? (
                <Link
                  to={`/properties/${inquiry.property.id}`}
                  className="text-sm font-light mb-6 inline-block hover:text-[#8a6d38]"
                  style={{ color: "#0F0F0D" }}
                >
                  {inquiry.property.title} — {inquiry.property.city}
                </Link>
              ) : null}

              <div
                className="p-6 mb-6"
                style={{ backgroundColor: "#EDE6D6" }}
              >
                <p className="text-sm font-light" style={{ color: "#0F0F0D" }}>
                  {inquiry.message}
                </p>
              </div>

              <p className="eyebrow mb-4" style={{ color: "#C9A96E" }}>
                Conversation
              </p>
              <div className="flex flex-col gap-4 mb-8" style={{ backgroundColor: "#FFFFFF" }}>
                {inquiry.thread.length === 0 ? (
                  <p className="text-sm font-light p-6" style={{ color: "#6B6560" }}>
                    No replies yet — the agent will respond to your inquiry.
                  </p>
                ) : (
                  inquiry.thread.map((message) => {
                    const fromAgent =
                      message.senderRole === "AGENT" ||
                      message.senderRole === "ADMIN"
                    return (
                      <div
                        key={message.id}
                        className="p-6"
                        style={{
                          backgroundColor: fromAgent ? "#0F0F0D" : "#F5F0E8",
                          borderLeft: fromAgent
                            ? "3px solid #C9A96E"
                            : "3px solid transparent",
                        }}
                      >
                        <p
                          className="text-sm font-light"
                          style={{ color: fromAgent ? "#F5F0E8" : "#0F0F0D" }}
                        >
                          {message.content}
                        </p>
                        <p
                          className="text-[11px] font-light mt-2"
                          style={{ color: fromAgent ? "rgba(245,240,232,0.5)" : "#6B6560" }}
                        >
                          {fromAgent ? (message.sender?.name ?? "Agent") : "You"} ·{" "}
                          {timeLabel(message.createdAt)}
                        </p>
                      </div>
                    )
                  })
                )}
              </div>

              {open ? (
                <div className="flex gap-3 items-end mb-10">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                    placeholder="Write a message to the agent…"
                    className="flex-1 resize-y bg-transparent text-sm font-light border px-3 py-2.5 outline-none border-[#0F0F0D]/25 focus:border-[#C9A96E] transition-colors"
                    style={{ color: "#0F0F0D" }}
                  />
                  <button
                    type="button"
                    disabled={sending || !draft.trim()}
                    onClick={sendMessage}
                    className="btn-primary disabled:opacity-40"
                  >
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>
              ) : (
                <p
                  className="text-xs font-light mb-10"
                  style={{ color: "#6B6560" }}
                >
                  This inquiry is closed — no further messages can be sent.
                </p>
              )}
            </div>

            <div>
              {inquiry.status === "PENDING" ? (
                <div
                  className="p-8 mb-6 border"
                  style={{ borderColor: "rgba(15,15,13,0.1)" }}
                >
                  <p className="eyebrow mb-4" style={{ color: "#C9A96E" }}>
                    Change your mind?
                  </p>
                  <p className="text-sm font-light mb-6" style={{ color: "#6B6560" }}>
                    You can cancel this inquiry while it is still pending.
                  </p>
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={cancelInquiry}
                    className="text-xs tracking-[0.2em] uppercase font-light px-5 py-3 border cursor-pointer disabled:opacity-40"
                    style={{ borderColor: "#A03A2E", color: "#A03A2E" }}
                  >
                    {cancelling ? "Cancelling…" : "Cancel inquiry"}
                  </button>
                </div>
              ) : null}

              <div className="p-8 border" style={{ borderColor: "rgba(15,15,13,0.1)" }}>
                <p className="eyebrow mb-4" style={{ color: "#C9A96E" }}>
                  Timeline
                </p>
                <ol className="flex flex-col gap-4">
                  {inquiry.history.map((entry, index) => (
                    <li
                      key={`${entry.createdAt}-${index}`}
                      className="relative pl-4 border-l border-[#C9A96E]/40"
                    >
                      <p className="text-sm font-light" style={{ color: "#0F0F0D" }}>
                        {entry.fromStatus
                          ? `${inquiryStatusLabel(entry.fromStatus)} → `
                          : ""}
                        {inquiryStatusLabel(entry.toStatus)}
                      </p>
                      {entry.note ? (
                        <p className="text-xs font-light mt-0.5" style={{ color: "#6B6560" }}>
                          {entry.note}
                        </p>
                      ) : null}
                      <p className="text-[11px] font-light mt-0.5" style={{ color: "#A09890" }}>
                        {timeLabel(entry.createdAt)}
                      </p>
                    </li>
                  ))}
                  <li className="relative pl-4 border-l border-[#C9A96E]/40">
                    <p className="text-sm font-light" style={{ color: "#0F0F0D" }}>
                      Submitted
                    </p>
                    <p className="text-[11px] font-light mt-0.5" style={{ color: "#A09890" }}>
                      {timeLabel(inquiry.createdAt)}
                    </p>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}