import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { agentApi, type InquiryListItem, type InquiryStatus } from "../../services/inquiry"
import {
  Badge,
  Button,
  EmptyState,
  SelectInput,
  Spinner,
  Table,
  formatDate,
  formatPrice,
} from "../../admin/ui"
import { INQUIRY_STATUS_OPTIONS, inquiryStatusTone } from "../../services/inquiry"

const PAGE_SIZE = 25

export default function AgentInquiries() {
  const [rows, setRows] = useState<InquiryListItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<InquiryStatus | "">("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    agentApi
      .inquiries({ status: status || undefined, page })
      .then((result) => {
        setRows(result.items)
        setTotal(result.total)
        setTotalPages(Math.max(1, result.totalPages))
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load inquiries")
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
      <h1 className="text-3xl font-light mb-2" style={{ fontFamily: "var(--font-display)" }}>
        Inquiries
      </h1>
      <p className="text-sm font-light text-[#6B6560] mt-1 mb-8">
        {total} client inquiry{total === 1 ? "" : "s"} assigned to you
      </p>

      <div className="mb-8 w-56" style={{ backgroundColor: "#EDE6D6", padding: "12px" }}>
        <SelectInput
          value={status}
          onChange={(next) => setStatus(next as InquiryStatus | "")}
          options={INQUIRY_STATUS_OPTIONS}
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
          <Table headers={["Client", "Property", "Contact", "Date", "Status", ""]}>
            {shown.map((inquiry) => (
              <tr
                key={inquiry.id}
                className="border-b border-[#0F0F0D]/8 hover:bg-[#EDE6D6]/60 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    to={`/agent/inquiries/${inquiry.id}`}
                    className="block text-sm font-light text-[#0F0F0D] hover:text-[#8a6d38]"
                  >
                    {inquiry.customerName}
                  </Link>
                  <span className="text-xs font-light text-[#A09890]">
                    {inquiry.customerEmail}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {inquiry.property ? (
                    <>
                      <p className="text-sm font-light text-[#0F0F0D]">
                        {inquiry.property.title}
                      </p>
                      <span className="text-xs font-light text-[#A09890]">
                        {inquiry.property.city} · {formatPrice(inquiry.property.price)}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm font-light text-[#A09890]">Deleted property</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm font-light text-[#6B6560]">
                  {inquiry.preferredContactMethod ?? "EMAIL"}
                  {inquiry.viewingDate ? (
                    <>
                      <span className="block text-xs text-[#A09890]">
                        Viewing {formatDate(inquiry.viewingDate)}
                      </span>
                    </>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-sm font-light text-[#6B6560]">
                  {formatDate(inquiry.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={inquiryStatusTone(inquiry.status)}>{inquiry.status}</Badge>
                </td>
                <td className="px-4 py-3 w-24 text-right">
                  <Link
                    to={`/agent/inquiries/${inquiry.id}`}
                    className="text-xs tracking-[0.2em] uppercase font-light hover:text-[#8a6d38]"
                    style={{ color: "#0F0F0D" }}
                  >
                    View
                  </Link>
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