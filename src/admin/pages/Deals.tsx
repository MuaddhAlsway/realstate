import { useCallback, useEffect, useState } from "react"
import { adminApi, type AdminDeal } from "../../services/admin"
import {
  Badge,
  Button,
  EmptyState,
  Spinner,
  Table,
  formatDate,
  formatPrice,
} from "../ui"

const PAGE_SIZE = 25

export default function Deals() {
  const [rows, setRows] = useState<AdminDeal[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    adminApi
      .deals({ page })
      .then((result) => {
        setRows(result.items)
        setTotal(result.total)
        setTotalPages(Math.max(1, result.totalPages))
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load deals")
      })
      .finally(() => setLoading(false))
  }, [page])

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
        Deals
      </h1>
      <p className="text-sm font-light text-[#6B6560] mt-1 mb-8">
        {total} completed deal{total === 1 ? "" : "s"}
      </p>

      {error ? (
        <EmptyState message={error} />
      ) : loading ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <EmptyState message="No completed deals yet." />
      ) : (
        <>
          <Table
            headers={["Client", "Property", "Agent", "Finalized", "Amount"]}
          >
            {shown.map((deal) => (
              <tr
                key={deal.id}
                className="border-b border-[#0F0F0D]/8 hover:bg-[#EDE6D6]/60 transition-colors"
              >
                <td className="px-4 py-3">
                  <p className="text-sm font-light text-[#0F0F0D]">
                    {deal.customerName}
                  </p>
                  <p className="text-xs font-light text-[#A09890]">
                    {deal.customerEmail}
                  </p>
                </td>
                <td className="px-4 py-3">
                  {deal.property ? (
                    <>
                      <p className="text-sm font-light text-[#0F0F0D]">
                        {deal.property.title}
                      </p>
                      <span className="text-xs font-light text-[#A09890]">
                        {deal.property.city} ·{" "}
                        {formatPrice(deal.property.price)}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm font-light text-[#A09890]">
                      Deleted property
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm font-light text-[#6B6560]">
                  {deal.agent?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm font-light text-[#6B6560]">
                  {formatDate(deal.completedAt)}
                </td>
                <td className="px-4 py-3">
                  {deal.property ? (
                    <Badge tone="gold">
                      {formatPrice(deal.property.price)}
                    </Badge>
                  ) : (
                    <span className="text-sm font-light text-[#A09890]">—</span>
                  )}
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
