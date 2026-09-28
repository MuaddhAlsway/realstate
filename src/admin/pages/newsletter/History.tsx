import { useCallback, useEffect, useState } from "react"
import {
  newsletterAdminApi,
  type DeliveryKind,
  type DeliveryStatus,
  type NewsletterDelivery,
} from "../../../services/newsletter"
import {
  Badge,
  Button,
  EmptyState,
  SelectInput,
  Spinner,
  Table,
  formatDate,
} from "../../ui"

function deliveryTone(status: string): "green" | "red" | "neutral" {
  if (status === "SENT") return "green"
  if (status === "FAILED") return "red"
  return "neutral"
}

export default function NewsletterHistory() {
  const [rows, setRows] = useState<NewsletterDelivery[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [kind, setKind] = useState<DeliveryKind | "">("")
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus | "">("")

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    newsletterAdminApi
      .deliveries({ kind: kind || undefined, status: deliveryStatus || undefined, page })
      .then((result) => {
        setRows(result.items)
        setTotal(result.total)
        setTotalPages(Math.max(1, result.totalPages))
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load delivery history")
      })
      .finally(() => setLoading(false))
  }, [kind, deliveryStatus, page])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-light" style={{ fontFamily: "var(--font-display)" }}>
        Email history
      </h1>
      <p className="text-sm font-light text-[#6B6560] mt-1 mb-8">
        Every welcome, campaign and agent email we attempted — {total} total.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="w-48">
          <SelectInput
            value={kind}
            onChange={(v) => setKind(v as DeliveryKind | "")}
            options={[
              { value: "", label: "Any kind" },
              { value: "WELCOME", label: "Welcome" },
              { value: "CAMPAIGN", label: "Campaign" },
              { value: "AGENT", label: "Agent" },
            ]}
          />
        </div>
        <div className="w-48">
          <SelectInput
            value={deliveryStatus}
            onChange={(v) => setDeliveryStatus(v as DeliveryStatus | "")}
            options={[
              { value: "", label: "Any outcome" },
              { value: "SENT", label: "Sent" },
              { value: "FAILED", label: "Failed" },
              { value: "QUEUED", label: "Queued" },
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
        <EmptyState message="No email activity yet." />
      ) : (
        <>
          <Table headers={["Kind", "Recipient", "Subject", "Outcome", "When"]}>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[#0F0F0D]/8 hover:bg-[#EDE6D6]/60 transition-colors"
              >
                <td className="px-4 py-3">
                  <Badge tone="neutral">{row.kind}</Badge>
                </td>
                <td className="px-4 py-3 text-sm font-light text-[#0F0F0D]">
                  {row.recipientEmail}
                </td>
                <td className="px-4 py-3 text-sm font-light text-[#6B6560]">
                  {row.subject ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={deliveryTone(row.status)}>{row.status}</Badge>
                  {row.errorMessage ? (
                    <p className="text-xs font-light text-[#A03A2E] mt-1">
                      {row.errorMessage}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-sm font-light text-[#6B6560]">
                  {formatDate(row.createdAt)}
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