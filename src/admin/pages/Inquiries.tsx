import { useCallback, useEffect, useState } from "react"
import {
  adminApi,
  type AdminInquiry,
  type InquiryStatus,
} from "../../services/admin"
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
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
]

function statusTone(
  status: InquiryStatus,
): "gold" | "green" | "neutral" | "red" {
  if (status === "PENDING") return "gold"
  if (status === "CANCELLED") return "red"
  if (status === "COMPLETED") return "green"
  return "neutral"
}

const PAGE_SIZE = 25

export default function Inquiries() {
  const [rows, setRows] = useState<AdminInquiry[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<InquiryStatus | "">("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    adminApi
      .inquiries({ status: status || undefined, page })
      .then((result) => {
        setRows(result.items)
        setTotal(result.total)
        setTotalPages(Math.max(1, result.totalPages))
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Could not load inquiries",
        )
      })
      .finally(() => setLoading(false))
  }, [status, page])

  useEffect(() => {
    setPage(1)
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  const shown = rows.slice(0, PAGE_SIZE)

  return (
    <div className="max-w-6xl">
      <h1
        className="text-3xl font-light"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Inquiries
      </h1>
      <p className="text-sm font-light text-[#6B6560] mt-1 mb-8">
        {total} client inquiry{total === 1 ? "" : "s"}
      </p>

      <div
        className="mb-8 w-56"
        style={{ backgroundColor: "#EDE6D6", padding: "12px" }}
      >
        <SelectInput
          value={status}
          onChange={(next) => setStatus(next as InquiryStatus | "")}
          options={STATUS_OPTIONS}
          placeholder="All statuses"
        />
      </div>

      {error ? (
        <EmptyState message={error} />
      ) : loading ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <EmptyState message="No inquiries match the current filter." />
      ) : (
        <>
          <Table
            headers={[
              "Customer",
              "Property",
              "Agent",
              "Status",
              "Created",
              "Completed",
            ]}
          >
            {shown.map((inquiry) => (
              <tr
                key={inquiry.id}
                className="border-b border-[#0F0F0D]/8 hover:bg-[#EDE6D6]/60 transition-colors"
              >
                <td className="px-4 py-3">
                  <p className="text-sm font-light text-[#0F0F0D]">
                    {inquiry.customerName}
                  </p>
                  <p className="text-xs font-light text-[#A09890]">
                    {inquiry.customerEmail}
                  </p>
                </td>
                <td className="px-4 py-3">
                  {inquiry.property ? (
                    <>
                      <p className="text-sm font-light text-[#0F0F0D]">
                        {inquiry.property.title}
                      </p>
                      <span className="text-xs font-light text-[#A09890]">
                        {inquiry.property.city} ·{" "}
                        {formatPrice(inquiry.property.price)} ·{" "}
                        {inquiry.property.purpose}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm font-light text-[#A09890]">
                      Deleted property
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm font-light text-[#6B6560]">
                  {inquiry.agent?.name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(inquiry.status)}>
                    {inquiry.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm font-light text-[#6B6560]">
                  {formatDate(inquiry.createdAt)}
                </td>
                <td className="px-4 py-3 text-sm font-light text-[#6B6560]">
                  {inquiry.completedAt ? formatDate(inquiry.completedAt) : "—"}
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
