import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  newsletterAdminApi,
  type NewsletterCampaign,
} from "../../../services/newsletter"
import {
  Badge,
  Button,
  EmptyState,
  Spinner,
  Table,
  formatDate,
} from "../../ui"

function campaignTone(status: string): "gold" | "green" | "red" | "neutral" {
  if (status === "DRAFT") return "neutral"
  if (status === "SENDING") return "gold"
  if (status === "SENT") return "green"
  if (status === "FAILED") return "red"
  return "neutral"
}

export default function NewsletterCampaigns() {
  const [rows, setRows] = useState<NewsletterCampaign[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    newsletterAdminApi
      .campaigns({ page })
      .then((result) => {
        setRows(result.items)
        setTotal(result.total)
        setTotalPages(Math.max(1, result.totalPages))
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load campaigns")
      })
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-light" style={{ fontFamily: "var(--font-display)" }}>
            Campaigns
          </h1>
          <p className="text-sm font-light text-[#6B6560] mt-1">
            {total} campaign{total === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          to="/admin/newsletter/compose"
          className="text-xs tracking-[0.2em] uppercase font-light px-5 py-3 cursor-pointer"
          style={{ backgroundColor: "#C9A96E", color: "#0F0F0D" }}
        >
          Compose email
        </Link>
      </div>

      {error ? (
        <EmptyState message={error} />
      ) : loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState message="No campaigns yet — compose the first one." />
      ) : (
        <>
          <Table headers={["Name", "Subject", "Status", "Delivered", "Sent", "Author", "Created"]}>
            {rows.map((campaign) => (
              <tr
                key={campaign.id}
                className="border-b border-[#0F0F0D]/8 hover:bg-[#EDE6D6]/60 transition-colors"
              >
                <td className="px-4 py-3">
                  <p className="text-sm font-light text-[#0F0F0D]">{campaign.name}</p>
                  {campaign.failedReason ? (
                    <p className="text-xs font-light text-[#A03A2E]">
                      {campaign.failedReason}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-sm font-light text-[#6B6560]">
                  {campaign.subject}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={campaignTone(campaign.status)}>{campaign.status}</Badge>
                </td>
                <td className="px-4 py-3 text-sm font-light text-[#6B6560]">
                  {campaign.stats.sent}/{campaign.stats.total}
                </td>
                <td className="px-4 py-3 text-sm font-light text-[#6B6560]">
                  {campaign.stats.failed}
                </td>
                <td className="px-4 py-3 text-sm font-light text-[#6B6560]">
                  {campaign.createdBy?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm font-light text-[#6B6560]">
                  {formatDate(campaign.createdAt)}
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