import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { adminApi, type DashboardData, type EmailCampaignStatus } from "../../services/admin"
import { Badge, EmptyState, Spinner, formatDate } from "../ui"

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: number
  hint?: string
}) {
  return (
    <div
      className="p-6"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid rgba(15,15,13,0.1)",
      }}
    >
      <p className="text-[11px] tracking-[0.18em] uppercase font-light text-[#6B6560] mb-3">
        {label}
      </p>
      <p
        className="text-4xl font-light leading-none tabular-nums"
        style={{ fontFamily: "var(--font-display)", color: "#0F0F0D" }}
      >
        {value}
      </p>
      {hint ? (
        <p className="text-xs font-light text-[#A09890] mt-2">{hint}</p>
      ) : null}
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    adminApi
      .dashboard()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load dashboard",
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <EmptyState message={error} />
  if (!data) return <Spinner />

  const { properties, viewingRequests } = data
  const latestViewingsSource = viewingRequests

  return (
    <div className="max-w-6xl">
      <h1
        className="text-3xl font-light mb-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Dashboard
      </h1>
      <p className="text-sm font-light text-[#6B6560] mb-10">
        Overview of listings, requests, deals and accounts across the platform.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
        <StatCard
          label="Properties"
          value={properties.total}
          hint={`${properties.featured} featured`}
        />
        <StatCard
          label="Inquiries"
          value={data.inquiries.total}
          hint={`${data.inquiries.byStatus.PENDING} pending`}
        />
        <StatCard label="Deals closed" value={data.deals} />
        <StatCard
          label="Viewing requests"
          value={viewingRequests.total}
          hint={`${viewingRequests.byStatus.PENDING} pending`}
        />
        <StatCard label="Users" value={data.users} />
        <StatCard label="Agents" value={data.agents} />
        <StatCard label="Favorites" value={data.favorites} />
        <StatCard label="Neighborhoods" value={data.neighborhoods} />
        <StatCard label="Amenities" value={data.amenities} />
        <StatCard
          label="Subscribers"
          value={data.newsletter.subscribers.active}
          hint={`${data.newsletter.subscribers.total} total · ${data.newsletter.subscribers.unsubscribed} unsubscribed`}
        />
        <StatCard
          label="Emails sent"
          value={data.newsletter.deliveries.sent}
          hint={`${data.newsletter.deliveries.total} total attempts`}
        />
        <StatCard
          label="Emails failed"
          value={data.newsletter.deliveries.failed}
          hint={data.newsletter.deliveries.failed > 0 ? "Check Email History" : "All clear"}
        />
        <div
          className="p-6"
          style={{
            backgroundColor: "#0F0F0D",
            border: "1px solid rgba(15,15,13,0.1)",
          }}
        >
          <p
            className="text-[11px] tracking-[0.18em] uppercase font-light mb-3"
            style={{ color: "#C9A96E" }}
          >
            Purpose
          </p>
          <p className="text-sm font-light text-[#F5F0E8]">
            {properties.byPurpose.SALE} sale · {properties.byPurpose.RENT} rent
          </p>
        </div>
      </div>

      <div className="mb-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2
              className="text-2xl font-light"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Email & Newsletter
            </h2>
            <p className="text-sm font-light text-[#6B6560] mt-1">
              Manage your subscriber list and send campaigns automatically.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin/newsletter/compose"
              className="text-xs tracking-[0.2em] uppercase font-light px-4 py-2 cursor-pointer"
              style={{ backgroundColor: "#C9A96E", color: "#0F0F0D" }}
            >
              Compose email
            </Link>
            <Link
              to="/admin/newsletter"
              className="text-xs tracking-[0.2em] uppercase font-light px-4 py-2 cursor-pointer bg-transparent"
              style={{ border: "1px solid rgba(15,15,13,0.2)", color: "#0F0F0D" }}
            >
              Subscribers
            </Link>
            <Link
              to="/admin/newsletter/campaigns"
              className="text-xs tracking-[0.2em] uppercase font-light px-4 py-2 cursor-pointer bg-transparent"
              style={{ border: "1px solid rgba(15,15,13,0.2)", color: "#0F0F0D" }}
            >
              Campaigns
            </Link>
            <Link
              to="/admin/newsletter/history"
              className="text-xs tracking-[0.2em] uppercase font-light px-4 py-2 cursor-pointer bg-transparent"
              style={{ border: "1px solid rgba(15,15,13,0.2)", color: "#0F0F0D" }}
            >
              Email history
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div
            className="p-6"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid rgba(15,15,13,0.1)",
            }}
          >
            <h3 className="text-[11px] tracking-[0.18em] uppercase font-light text-[#6B6560] mb-4">
              Delivery status
            </h3>
            {data.emailProvider === "smtp" ? (
              <>
                <p className="flex items-center gap-2 text-sm font-light text-[#0F0F0D]">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: "#3A7D44" }}
                  />
                  SMTP active — sending via Nodemailer
                </p>
                <p className="text-xs font-light text-[#A09890] mt-3">
                  Broadcasts and agent emails go out automatically to your
                  subscriber list.
                </p>
              </>
            ) : data.emailProvider === "resend" ? (
              <>
                <p className="flex items-center gap-2 text-sm font-light text-[#0F0F0D]">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: "#3A7D44" }}
                  />
                  Resend active — sending via HTTPS API
                </p>
                <p className="text-xs font-light text-[#A09890] mt-3">
                  Broadcasts and agent emails go out automatically through the
                  Resend API (no SMTP egress required).
                </p>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 text-sm font-light text-[#0F0F0D]">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: "#C9A96E" }}
                  />
                  Log mode (no delivery)
                </p>
                <p className="text-xs font-light text-[#A09890] mt-3">
                  Outbound email is disabled. To send automatically, set{" "}
                  <code className="text-[#0F0F0D]">EMAIL_PROVIDER=smtp</code>{" "}
                  with valid SMTP credentials on the server, e.g. for Gmail:
                  host{" "}
                  <code className="text-[#0F0F0D]">smtp.gmail.com</code>, port{" "}
                  <code className="text-[#0F0F0D]">587</code>, your Gmail
                  address as user plus a 16-character Google App Password. If
                  SMTP egress is blocked on the host, use{" "}
                  <code className="text-[#0F0F0D]">EMAIL_PROVIDER=resend</code>{" "}
                  with a Resend API key instead.
                </p>
              </>
            )}
            <div className="mt-6 pt-6 flex flex-col gap-2" style={{ borderTop: "1px solid rgba(15,15,13,0.08)" }}>
              <Link
                to="/admin/newsletter/history"
                className="text-xs tracking-[0.2em] uppercase font-light text-[#6B6560] hover:text-[#0F0F0D] transition-colors"
              >
                View delivery history →
              </Link>
            </div>
          </div>

          <div
            className="p-6 lg:col-span-2"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid rgba(15,15,13,0.1)",
            }}
          >
            <h3 className="text-[11px] tracking-[0.18em] uppercase font-light text-[#6B6560] mb-4">
              Recent campaigns
            </h3>
            {data.newsletter.recentCampaigns.length === 0 ? (
              <EmptyState message="No campaigns yet — compose your first email to get started." />
            ) : (
              <div className="flex flex-col">
                {data.newsletter.recentCampaigns.map((c) => {
                  const tone: Record<EmailCampaignStatus, "green" | "gold" | "red" | "neutral"> = {
                    SENT: "green",
                    SENDING: "gold",
                    FAILED: "red",
                    DRAFT: "neutral",
                  }
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-4 py-3"
                      style={{ borderBottom: "1px solid rgba(15,15,13,0.08)" }}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-light text-[#0F0F0D] truncate">{c.subject}</p>
                        <p className="text-xs font-light text-[#A09890] mt-0.5">
                          {c.sentAt ? `Sent ${formatDate(c.sentAt)}` : `Created ${formatDate(c.createdAt)}`}
                        </p>
                      </div>
                      <Badge tone={tone[c.status]}>{c.status}</Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-12">
        <div
          className="p-6"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid rgba(15,15,13,0.1)",
          }}
        >
          <h2 className="text-[11px] tracking-[0.18em] uppercase font-light text-[#6B6560] mb-6">
            Properties by status
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(properties.byStatus).map(([status, count]) => (
              <Badge
                key={status}
                tone={
                  status === "AVAILABLE"
                    ? "green"
                    : status === "DRAFT"
                      ? "neutral"
                      : "gold"
                }
              >
                {status} · {count}
              </Badge>
            ))}
          </div>
        </div>
        <div
          className="p-6"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid rgba(15,15,13,0.1)",
          }}
        >
          <h2 className="text-[11px] tracking-[0.18em] uppercase font-light text-[#6B6560] mb-6">
            Inquiry pipeline
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.inquiries.byStatus).map(([status, count]) => (
              <Badge
                key={status}
                tone={
                  status === "PENDING"
                    ? "gold"
                    : status === "COMPLETED"
                      ? "green"
                      : status === "CANCELLED"
                        ? "red"
                        : "neutral"
                }
              >
                {status} · {count}
              </Badge>
            ))}
          </div>
        </div>
        <div
          className="p-6"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid rgba(15,15,13,0.1)",
          }}
        >
          <h2 className="text-[11px] tracking-[0.18em] uppercase font-light text-[#6B6560] mb-6">
            Viewing requests by status
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(viewingRequests.byStatus).map(([status, count]) => (
              <Badge
                key={status}
                tone={
                  status === "PENDING"
                    ? "gold"
                    : status === "COMPLETED"
                      ? "green"
                      : "neutral"
                }
              >
                {status} · {count}
              </Badge>
            ))}
          </div>
          <p className="text-xs font-light text-[#A09890] mt-5">
            Last check: {formatDate(new Date().toISOString())}
          </p>
        </div>
      </div>

      <p className="text-[11px] font-light text-[#A09890]">
        {latestViewingsSource.total} total viewing requests across the platform.
      </p>
    </div>
  )
}
