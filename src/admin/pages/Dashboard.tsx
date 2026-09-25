import { useEffect, useState } from "react"
import { adminApi, type DashboardData } from "../../services/admin"
import { Badge, EmptyState, Spinner, formatDate } from "../ui"

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
          setError(err instanceof Error ? err.message : "Could not load dashboard")
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
      <h1 className="text-3xl font-light mb-2" style={{ fontFamily: "var(--font-display)" }}>
        Dashboard
      </h1>
      <p className="text-sm font-light text-[#6B6560] mb-10">
        Overview of listings, requests and accounts across the platform.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
        <StatCard label="Properties" value={properties.total} hint={`${properties.featured} featured`} />
        <StatCard label="Viewing requests" value={viewingRequests.total} hint={`${viewingRequests.byStatus.PENDING} pending`} />
        <StatCard label="Users" value={data.users} />
        <StatCard label="Agents" value={data.agents} />
        <StatCard label="Favorites" value={data.favorites} />
        <StatCard label="Neighborhoods" value={data.neighborhoods} />
        <StatCard label="Amenities" value={data.amenities} />
        <div className="p-6" style={{ backgroundColor: "#0F0F0D", border: "1px solid rgba(15,15,13,0.1)" }}>
          <p className="text-[11px] tracking-[0.18em] uppercase font-light mb-3" style={{ color: "#C9A96E" }}>
            Purpose
          </p>
          <p className="text-sm font-light text-[#F5F0E8]">
            {properties.byPurpose.SALE} sale · {properties.byPurpose.RENT} rent
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-12">
        <div className="p-6" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(15,15,13,0.1)" }}>
          <h2 className="text-[11px] tracking-[0.18em] uppercase font-light text-[#6B6560] mb-6">
            Properties by status
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(properties.byStatus).map(([status, count]) => (
              <Badge key={status} tone={status === "AVAILABLE" ? "green" : status === "DRAFT" ? "neutral" : "gold"}>
                {status} · {count}
              </Badge>
            ))}
          </div>
        </div>
        <div className="p-6" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(15,15,13,0.1)" }}>
          <h2 className="text-[11px] tracking-[0.18em] uppercase font-light text-[#6B6560] mb-6">
            Viewing requests by status
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(viewingRequests.byStatus).map(([status, count]) => (
              <Badge key={status} tone={status === "PENDING" ? "gold" : status === "COMPLETED" ? "green" : "neutral"}>
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