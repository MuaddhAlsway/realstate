import { useCallback, useEffect, useState } from "react"
import {
  agentApi,
  type NotificationItem,
} from "../../services/inquiry"
import { Badge, Button, EmptyState, Spinner } from "../../admin/ui"

const TYPE_TONE: Record<string, "gold" | "green" | "neutral" | "red" | "dark"> = {
  INQUIRY: "gold",
  MESSAGE: "neutral",
  DEAL: "green",
  SYSTEM: "dark",
}

function timeLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

const PAGE_SIZE = 25

export default function AgentNotifications() {
  const [rows, setRows] = useState<NotificationItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    agentApi
      .notifications({ page })
      .then((result) => {
        setRows(result.items)
        setTotal(result.total)
        setTotalPages(Math.max(1, result.totalPages))
        setUnreadCount(result.items.filter((item) => !item.read).length)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load notifications")
      })
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => {
    load()
  }, [load])

  const markAllRead = async () => {
    try {
      const updated = await agentApi.markNotificationsRead({ all: true })
      setRows(updated)
      setUnreadCount(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update notifications")
    }
  }

  const shown = rows.slice(0, PAGE_SIZE)

  return (
    <div className="max-w-4xl">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-light mb-2" style={{ fontFamily: "var(--font-display)" }}>
            Notifications
          </h1>
          <p className="text-sm font-light text-[#6B6560]">
            {total} total · {unreadCount} unread
          </p>
        </div>
        {unreadCount > 0 ? (
          <Button variant="ghost" onClick={markAllRead}>
            Mark all read
          </Button>
        ) : null}
      </div>

      {error ? (
        <EmptyState message={error} />
      ) : loading ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <EmptyState message="No notifications yet." />
      ) : (
        <div className="flex flex-col" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(15,15,13,0.1)" }}>
          {shown.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-4 px-6 py-4 border-b border-[#0F0F0D]/8"
              style={{ backgroundColor: item.read ? "transparent" : "rgba(201,169,110,0.08)" }}
            >
              <Badge tone={TYPE_TONE[item.type] ?? "neutral"}>{item.type}</Badge>
              <div className="flex-1">
                <p className="text-sm font-light text-[#0F0F0D]">{item.title}</p>
                {item.message ? (
                  <p className="text-xs font-light text-[#6B6560] mt-0.5">{item.message}</p>
                ) : null}
                <p className="text-[11px] font-light text-[#A09890] mt-1">
                  {timeLabel(item.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-xs font-light text-[#6B6560]">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button variant="ghost" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}