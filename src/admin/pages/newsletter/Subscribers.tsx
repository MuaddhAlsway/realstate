import { useCallback, useEffect, useState } from "react"
import {
  newsletterAdminApi,
  type NewsletterStats,
  type NewsletterSubscriber,
  type SubscriberStatus,
} from "../../../services/newsletter"
import {
  Badge,
  Button,
  EmptyState,
  Spinner,
  Table,
  TextInput,
  SelectInput,
  formatDate,
} from "../../ui"

function StatTile({ label, value }: { label: string, value: number }) {
  return (
    <div
      className="p-6"
      style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(15,15,13,0.1)" }}
    >
      <p className="text-[11px] tracking-[0.18em] uppercase font-light text-[#6B6560]">
        {label}
      </p>
      <p className="text-3xl font-light mt-2" style={{ fontFamily: "var(--font-display)" }}>
        {value}
      </p>
    </div>
  )
}

export default function NewsletterSubscribers() {
  const [rows, setRows] = useState<NewsletterSubscriber[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<SubscriberStatus | "">("")
  const [stats, setStats] = useState<NewsletterStats | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    newsletterAdminApi
      .subscribers({ q: query.trim() || undefined, status: status || undefined, page })
      .then((result) => {
        setRows(result.items)
        setTotal(result.total)
        setTotalPages(Math.max(1, result.totalPages))
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load subscribers")
      })
      .finally(() => setLoading(false))
  }, [query, status, page])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    newsletterAdminApi
      .stats()
      .then(setStats)
      .catch(() => { /* non-critical summary */ })
  }, [])

  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-light" style={{ fontFamily: "var(--font-display)" }}>
        Newsletter
      </h1>
      <p className="text-sm font-light text-[#6B6560] mt-1 mb-8">
        Subscribers, welcome emails, campaigns and delivery history.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatTile label="Subscribers" value={stats?.subscribers.total ?? 0} />
        <StatTile label="Active" value={stats?.subscribers.active ?? 0} />
        <StatTile label="Unsubscribed" value={stats?.subscribers.unsubscribed ?? 0} />
        <StatTile label="Emails sent" value={stats?.emails.sent ?? 0} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="w-64">
          <TextInput
            value={query}
            onChange={setQuery}
            placeholder="Search email…"
          />
        </div>
        <div className="w-48">
          <SelectInput
            value={status}
            onChange={(v) => setStatus(v as SubscriberStatus | "")}
            options={[
              { value: "", label: "Any status" },
              { value: "ACTIVE", label: "Active" },
              { value: "UNSUBSCRIBED", label: "Unsubscribed" },
            ]}
          />
        </div>
        <Button variant="ghost" onClick={load}>
          Refresh
        </Button>
      </div>

      {error ? (
        <EmptyState message={error} />
      ) : loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState message="No subscribers yet — ones from the site footer will appear here." />
      ) : (
        <>
          <Table headers={["Email", "Status", "Subscribed", "Unsubscribed"]}>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[#0F0F0D]/8 hover:bg-[#EDE6D6]/60 transition-colors"
              >
                <td className="px-4 py-3 text-sm font-light text-[#0F0F0D]">
                  {row.email}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={row.status === "ACTIVE" ? "green" : "neutral"}>
                    {row.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm font-light text-[#6B6560]">
                  {formatDate(row.subscribedAt)}
                </td>
                <td className="px-4 py-3 text-sm font-light text-[#6B6560]">
                  {formatDate(row.unsubscribedAt)}
                </td>
              </tr>
            ))}
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-xs font-light text-[#6B6560]">
                Page {page} of {totalPages} · {total} total
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}