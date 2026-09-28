import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import {
  agentApi,
  type AgentEmail,
  type InquiryDetail,
  type InquiryMessage,
  type InquiryStatus,
} from "../../services/inquiry"
import { inquiryStatusLabel, inquiryStatusTone } from "../../services/inquiry"
import { Badge, Button, EmptyState, Spinner, TextInput, Textarea, formatDate, formatPrice } from "../../admin/ui"
import { useToast } from "../../admin/Toast"

const ALLOWED: Record<InquiryStatus, InquiryStatus[]> = {
  PENDING: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
}

function timeLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

export default function AgentInquiryDetail() {
  const { id = "" } = useParams()
  const { toast } = useToast()

  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)

  const [emails, setEmails] = useState<AgentEmail[]>([])
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody] = useState("")
  const [emailSending, setEmailSending] = useState(false)

  const [target, setTarget] = useState<InquiryStatus | "">("")
  const [note, setNote] = useState("")
  const [confirm, setConfirm] = useState(false)
  const [updating, setUpdating] = useState(false)

  const load = () => {
    setLoading(true)
    setError(null)
    agentApi
      .inquiry(id)
      .then((detail) => {
        setInquiry(detail)
        setTarget("")
        setNote("")
        setConfirm(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load inquiry")
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!id) return
    let active = true
    agentApi
      .leadEmails(id)
      .then((rows) => {
        if (active) setEmails(rows)
      })
      .catch(() => {
        if (active) setEmails([])
      })
    return () => {
      active = false
    }
  }, [id])

  const allowedOptions = useMemo(() => {
    if (!inquiry) return []
    return ALLOWED[inquiry.status] ?? []
  }, [inquiry])

  if (error) return <EmptyState message={error} />
  if (loading) return <Spinner />
  if (!inquiry) return <EmptyState message="Inquiry not found." />

  const propertyCanTransact =
    inquiry.property?.status === "AVAILABLE" &&
    inquiry.property.purpose !== undefined

  const sendMessage = async () => {
    const content = draft.trim()
    if (!content) return
    setSending(true)
    try {
      const sent = await agentApi.sendMessage(id, content)
      setInquiry((current) =>
        current
          ? { ...current, thread: [...current.thread, sent] }
          : current,
      )
      setDraft("")
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not send message", "error")
    } finally {
      setSending(false)
    }
  }

  const updateStatus = async () => {
    if (!target) return
    setUpdating(true)
    try {
      const updated = await agentApi.updateStatus(id, {
        toStatus: target,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(target === "COMPLETED" && confirm ? { confirmTransaction: true } : {}),
      })
      setInquiry(updated)
      setTarget("")
      setNote("")
      setConfirm(false)
      toast("Inquiry updated")
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not update status", "error")
    } finally {
      setUpdating(false)
    }
  }

  const sendEmail = async () => {
    const subject = emailSubject.trim()
    const body = emailBody.trim()
    if (!subject || !body) return
    setEmailSending(true)
    try {
      const sent = await agentApi.sendLeadEmail(id, { subject, body })
      setEmails((current) => [sent, ...current])
      setEmailSubject("")
      setEmailBody("")
      toast("Email sent to the client")
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not send email", "error")
    } finally {
      setEmailSending(false)
    }
  }

  const messages = inquiry.thread

  return (
    <div className="max-w-6xl">
      <Link
        to="/agent/inquiries"
        className="text-xs tracking-[0.2em] uppercase font-light hover:text-[#8a6d38] mb-6 inline-block"
        style={{ color: "#6B6560" }}
      >
        ← Inquiries
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-light mb-2" style={{ fontFamily: "var(--font-display)" }}>
            {inquiry.customerName}
          </h1>
          <p className="text-sm font-light text-[#6B6560]">
            {inquiry.customerEmail}
            {inquiry.customerPhone ? ` · ${inquiry.customerPhone}` : ""}
            {" · "}Prefers {inquiry.preferredContactMethod}
          </p>
          {inquiry.viewingDate ? (
            <p className="text-sm font-light text-[#6B6560] mt-1">
              Requested viewing {formatDate(inquiry.viewingDate)}
              {inquiry.viewingTime ? ` at ${inquiry.viewingTime}` : ""}
            </p>
          ) : null}
        </div>
        <Badge tone={inquiryStatusTone(inquiry.status)}>{inquiry.status}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        {/* Conversation */}
        <div
          className="lg:col-span-2 flex flex-col"
          style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(15,15,13,0.1)" }}
        >
          <div className="px-6 py-4 border-b border-[#0F0F0D]/8">
            <h2 className="text-[11px] tracking-[0.18em] uppercase font-light text-[#6B6560]">
              Conversation
            </h2>
          </div>
          <div className="px-6 py-6 flex flex-col gap-4 flex-1">
            {messages.length === 0 ? (
              <p className="text-sm font-light text-[#A09890]">
                No messages yet — the client&apos;s initial request is below.
              </p>
            ) : (
              messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            )}
          </div>

          {inquiry.status === "CANCELLED" || inquiry.status === "COMPLETED" ? (
            <div className="px-6 py-4 border-t border-[#0F0F0D]/8">
              <p className="text-xs font-light text-[#6B6560]">
                This inquiry is {inquiry.status.toLowerCase()} — messaging is closed.
              </p>
            </div>
          ) : (
            <div className="px-6 py-4 border-t border-[#0F0F0D]/8 flex gap-3 items-end">
              <div className="flex-1">
                <Textarea
                  value={draft}
                  onChange={setDraft}
                  rows={2}
                  placeholder="Reply to the client…"
                />
              </div>
              <Button
                variant="dark"
                disabled={sending || !draft.trim()}
                onClick={sendMessage}
              >
                Send
              </Button>
            </div>
          )}
        </div>

        {/* Status workflow */}
        <div className="flex flex-col gap-6">
          <div className="p-6" style={{ backgroundColor: "#EDE6D6", border: "1px solid rgba(15,15,13,0.1)" }}>
            <h2 className="text-[11px] tracking-[0.18em] uppercase font-light text-[#6B6560] mb-4">
              Update status
            </h2>
            {allowedOptions.length === 0 ? (
              <p className="text-xs font-light text-[#6B6560]">
                No further transitions from {inquiryStatusLabel(inquiry.status)}.
              </p>
            ) : (
              <>
                <label className="block mb-4">
                  <span className="text-[11px] tracking-[0.18em] uppercase font-light mb-2 block text-[#6B6560]">
                    Next status
                  </span>
                  <select
                    value={target}
                    onChange={(e) => setTarget(e.target.value as InquiryStatus | "")}
                    className="w-full bg-transparent text-sm font-light border px-3 py-2.5 outline-none text-[#0F0F0D]"
                  >
                    <option value="">Select…</option>
                    {allowedOptions.map((option) => (
                      <option key={option} value={option}>
                        {inquiryStatusLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block mb-4">
                  <span className="text-[11px] tracking-[0.18em] uppercase font-light mb-2 block text-[#6B6560]">
                    Note (optional)
                  </span>
                  <Textarea
                    value={note}
                    onChange={setNote}
                    rows={2}
                    placeholder="Visible on the timeline"
                  />
                </label>

                {target === "COMPLETED" && (
                  <label className="block mb-4 flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirm}
                      onChange={(e) => setConfirm(e.target.checked)}
                      className="mt-1"
                    />
                    <span className="text-xs font-light text-[#6B6560]">
                      Confirm transaction — flip the property to
                      {inquiry.property?.purpose === "RENT" ? " RENTED" : " SOLD"}{" "}
                      and remove it from the public catalog
                      {!propertyCanTransact &&
                        ` (currently ${inquiry.property?.status ?? "unknown"})`}
                    </span>
                  </label>
                )}

                <Button
                  variant="gold"
                  disabled={updating || !target}
                  onClick={updateStatus}
                  className="w-full justify-center"
                >
                  Update
                </Button>
              </>
            )}
          </div>

          <div className="p-6" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(15,15,13,0.1)" }}>
            <h2 className="text-[11px] tracking-[0.18em] uppercase font-light text-[#6B6560] mb-4">
              Property
            </h2>
            {inquiry.property ? (
              <>
                <Link
                  to={`/properties/${inquiry.property.id}`}
                  className="block text-sm font-light text-[#0F0F0D] hover:text-[#8a6d38]"
                >
                  {inquiry.property.title}
                </Link>
                <p className="text-xs font-light text-[#A09890] mt-1">
                  {inquiry.property.city} · {formatPrice(inquiry.property.price)} ·{" "}
                  {inquiry.property.purpose}
                </p>
              </>
            ) : (
              <p className="text-xs font-light text-[#A09890]">Deleted property</p>
            )}
          </div>

          {/* Email client */}
          <div className="p-6" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(15,15,13,0.1)" }}>
            <h2 className="text-[11px] tracking-[0.18em] uppercase font-light text-[#6B6560] mb-4">
              Email client
            </h2>
            <p className="text-xs font-light text-[#A09890] mb-4">
              Sent directly to {inquiry.customerEmail} — the address on the lead.
            </p>
            {inquiry.status === "CANCELLED" || inquiry.status === "COMPLETED" ? (
              <p className="text-xs font-light text-[#6B6560]">
                Emailing is closed for {inquiry.status.toLowerCase()} inquiries.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <TextInput
                  value={emailSubject}
                  onChange={setEmailSubject}
                  placeholder="Subject"
                />
                <Textarea
                  value={emailBody}
                  onChange={setEmailBody}
                  rows={3}
                  placeholder="Write the client an email…"
                />
                <div className="flex justify-end">
                  <Button
                    variant="dark"
                    disabled={emailSending || !emailSubject.trim() || !emailBody.trim()}
                    onClick={sendEmail}
                  >
                    Send email
                  </Button>
                </div>
              </div>
            )}
            {emails.length > 0 ? (
              <div className="mt-6 pt-4 border-t border-[#0F0F0D]/10 flex flex-col gap-3">
                {emails.map((email) => (
                  <div key={email.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-light text-[#0F0F0D]">{email.subject}</p>
                      <Badge tone={email.status === "FAILED" ? "red" : "green"}>
                        {email.status}
                      </Badge>
                    </div>
                    <p className="text-xs font-light text-[#6B6560] mt-1">{email.body}</p>
                    <p className="text-[11px] font-light text-[#A09890] mt-0.5">
                      {timeLabel(email.createdAt ?? "")}
                      {email.errorMessage ? ` · ${email.errorMessage}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Timeline */}
          <div className="p-6" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(15,15,13,0.1)" }}>
            <h2 className="text-[11px] tracking-[0.18em] uppercase font-light text-[#6B6560] mb-4">
              Timeline
            </h2>
            <ol className="flex flex-col gap-4">
              {inquiry.history.map((entry, index) => (
                <li key={`${entry.createdAt}-${index}`} className="relative pl-4 border-l border-[#C9A96E]/40">
                  <p className="text-sm font-light text-[#0F0F0D]">
                    {entry.fromStatus ? `${inquiryStatusLabel(entry.fromStatus)} → ` : ""}
                    {inquiryStatusLabel(entry.toStatus)}
                  </p>
                  {entry.note ? (
                    <p className="text-xs font-light text-[#6B6560] mt-0.5">{entry.note}</p>
                  ) : null}
                  <p className="text-[11px] font-light text-[#A09890] mt-0.5">
                    {entry.changedBy?.name ?? "System"} · {timeLabel(entry.createdAt)}
                  </p>
                </li>
              ))}
              <li className="relative pl-4 border-l border-[#C9A96E]/40">
                <p className="text-sm font-light text-[#0F0F0D]">Submitted</p>
                <p className="text-[11px] font-light text-[#A09890] mt-0.5">
                  {timeLabel(inquiry.createdAt)}
                </p>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: InquiryMessage }) {
  const fromAgent = message.senderRole === "AGENT" || message.senderRole === "ADMIN"
  return (
    <div className={fromAgent ? "self-end max-w-[85%]" : "self-start max-w-[85%]"}>
      <div
        className="px-4 py-3 text-sm font-light"
        style={
          fromAgent
            ? { backgroundColor: "#0F0F0D", color: "#F5F0E8" }
            : { backgroundColor: "#EDE6D6", color: "#0F0F0D" }
        }
      >
        {message.content}
      </div>
      <p className="text-[11px] font-light text-[#A09890] mt-1">
        {message.sender?.name ?? (fromAgent ? "You" : message.senderRole.toLowerCase())} ·{" "}
        {timeLabel(message.createdAt)}
      </p>
    </div>
  )
}