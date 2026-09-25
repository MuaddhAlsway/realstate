import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  adminApi,
  type AdminViewing,
  type ViewingStatus,
} from "../../services/admin"
import { useToast } from "../Toast"
import {
  Badge,
  Button,
  EmptyState,
  SelectInput,
  Spinner,
  Table,
  formatDate,
  formatPrice,
} from "../ui"

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
]

function statusTone(status: ViewingStatus): "gold" | "green" | "neutral" | "red" {
  if (status === "PENDING") return "gold"
  if (status === "COMPLETED") return "green"
  if (status === "CANCELLED") return "red"
  return "neutral"
}

const PAGE_SIZE = 25

export default function Viewings() {
  const [rows, setRows] = useState<AdminViewing[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<ViewingStatus | "">("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const { toast } = useToast()

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    adminApi
      .viewings({ status: status || undefined, page })
      .then((result) => {
        setRows(result.items)
        setTotal(result.total)
        setTotalPages(Math.max(1, result.totalPages))
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load viewings")
      })
      .finally(() => setLoading(false))
  }, [status, page])

  useEffect(() => {
    setPage(1)
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  const setStatusFor = async (viewingId: string, next: ViewingStatus) => {
    setBusyId(viewingId)
    try {
      await adminApi.updateViewingStatus(viewingId, next)
      setRows((current) =>
        current.map((viewing) =>
          viewing.id === viewingId ? { ...viewing, status: next } : viewing,
        ),
      )
      toast("Viewing updated")
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not update viewing", "error")
    } finally {
      setBusyId(null)
    }
  }

  const shown = rows.slice(0, PAGE_SIZE)

  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-light" style={{ fontFamily: "var(--font-display)" }}>
        Viewings
      </h1>
      <p className="text-sm font-light text-[#6B6560] mt-1 mb-8">
        {total} viewing request{total === 1 ? "" : "s"}
      </p>

      <div className="mb-8 w-56" style={{ backgroundColor: "#EDE6D6", padding: "12px" }}>
        <SelectInput
          value={status}
          onChange={(next) => setStatus(next as ViewingStatus | "")}
          options={STATUS_OPTIONS}
          placeholder="All statuses"
        />
      </div>

      {error ? (
        <EmptyState message={error} />
      ) : loading ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <EmptyState message="No viewing requests match the current filter." />
      ) : (
        <>
          <Table
            headers={["Requester", "Property", "Agent", "Date", "Status", ""]}
          >
            {shown.map((viewing) => (
              <tr
                key={viewing.id}
                className="border-b border-[#0F0F0D]/8 hover:bg-[#EDE6D6]/60 transition-colors"
              >
                <td className="px-4 py-3">
                  <p className="text-sm font-light text-[#0F0F0D]">
                    {viewing.requester?.name ?? "Guest"}
                  </p>
                  <p className="text-xs font-light text-[#A09890]">
                    {viewing.requester?.email ?? "No account"}
                  </p>
                </td>
                <td className="px-4 py-3">
                  {viewing.property ? (
                    <>
                      <Link
                        to={`/admin/properties/${viewing.property.id}/edit`}
                        className="block text-sm font-light text-[#0F0F0D] hover:text-[#8a6d38]"
                      >
                        {viewing.property.title}
                      </Link>
                      <span className="text-xs font-light text-[#A09890]">
                        {viewing.property.city} · {formatPrice(viewing.property.price)}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm font-light text-[#A09890]">Deleted property</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm font-light text-[#6B6560]">
                  {viewing.agent?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm font-light text-[#6B6560]">
                  {formatDate(viewing.date)}
                  {viewing.time ? <span className="block text-xs text-[#A09890]">{viewing.time}</span> : null}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(viewing.status)}>{viewing.status}</Badge>
                </td>
                <td className="px-4 py-3 w-44">
                  <SelectInput
                    value={viewing.status}
                    onChange={(next) => setStatusFor(viewing.id, next as ViewingStatus)}
                    options={STATUS_OPTIONS.filter((option) => option.value !== "")}
                    placeholder="Change"
                  />
                </td>
              </tr>
            ))}
          </Table>

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
        </>
      )}
    </div>
  )
}