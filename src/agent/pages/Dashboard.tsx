import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { agentApi, type AgentDashboard } from "../../services/inquiry"
import { Badge, EmptyState, Spinner, formatDate } from "../../admin/ui"
import {
  inquiryStatusLabel,
  inquiryStatusTone,
} from "../../services/inquiry"

function StatCard({ label, value, hint }: { label: string, value: number, hint?: string }) {
  return (
    <div className="p-6" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(15,15,13,0.1)" }}>
      <p className="text-[11px] tracking-[0.18em] uppercase font-light text-[#6B6560] mb-3">
        {label}
      </p>
      <p
        className="text-4xl font-light leading-none tabular-nums"
        style={{ fontFamily: "var(--font-display)", color: "#0F0F0D" }}
      >
        {value}
      </p>
      {hint ? <p className="text-xs font-light text-[#A09890] mt-2">{hint}</p> : null}
    </div>
  )
}

export default function AgentDashboard() {
  const [data, setData] = useState<AgentDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    agentApi
      .dashboard()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load dashboard")
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <EmptyState message={error} />
  if (!data) return <Spinner />

  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-light mb-2" style={{ fontFamily: "var(--font-display)" }}>
        Dashboard
      </h1>
      <p className="text-sm font-light text-[#6B6560] mb-10">
        Your assigned properties, inquiries and closed deals.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <StatCard label="Inquiries" value={data.inquiries.total} hint={`${data.inquiries.byStatus.PENDING ?? 0} pending`} />
        <StatCard label="In progress" value={data.inquiries.byStatus.IN_PROGRESS ?? 0} />
        <StatCard label="Deals closed" value={data.deals} />
        <StatCard label="Listings" value={data.properties} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-12">
        <div className="p-6" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(15,15,13,0.1)" }}>
          <h2 className="text-[11px] tracking-[0.18em] uppercase font-light text-[#6B6560] mb-6">
            Inquiry pipeline
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.inquiries.byStatus).map(([status, count]) => (
              <Badge key={status} tone={inquiryStatusTone(status)}>
                {inquiryStatusLabel(status)} · {count}
              </Badge>
            ))}
          </div>
          <p className="text-xs font-light text-[#A09890] mt-5">
            {data.notifications.unread} unread notification
            {data.notifications.unread === 1 ? "" : "s"}
          </p>
        </div>
        <div className="p-6" style={{ backgroundColor: "#0F0F0D", border: "1px solid rgba(15,15,13,0.1)" }}>
          <h2 className="text-[11px] tracking-[0.18em] uppercase font-light mb-6" style={{ color: "#C9A96E" }}>
            Recent inquiries
          </h2>
          <div className="flex flex-col divide-y" style={{ borderColor: "rgba(245,240,232,0.1)" }}>
            {data.recentInquiries.length === 0 ? (
              <p className="text-sm font-light text-[#F5F0E8]/60 py-4">No inquiries yet.</p>
            ) : (
              data.recentInquiries.slice(0, 4).map((inq) => (
                <Link
                  key={inq.id}
                  to={`/agent/inquiries/${inq.id}`}
                  className="py-3 flex items-center justify-between gap-3 text-sm font-light text-[#F5F0E8]/85 hover:text-[#C9A96E] transition-colors"
                >
                  <span className="truncate">{inq.customerName}</span>
                  <Badge tone={inquiryStatusTone(inq.status)}>{inq.status}</Badge>
                </Link>
              ))
            )}
          </div>
          <Link
            to="/agent/inquiries"
            className="inline-block mt-5 text-xs tracking-[0.2em] uppercase font-light"
            style={{ color: "#C9A96E" }}
          >
            View all →
          </Link>
        </div>
      </div>

      <p className="text-xs font-light text-[#A09890]">
        Last check: {formatDate(new Date().toISOString())}
      </p>
    </div>
  )
}