import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  adminApi,
  type AdminPropertySummary,
  type PropertyStatus,
  type PropertyPurpose,
} from "../../services/admin"
import { useToast } from "../Toast"
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Spinner,
  Table,
  formatDate,
  formatPrice,
} from "../ui"

const STATUS_OPTIONS: Array<{ value: PropertyStatus | "", label: string }> = [
  { value: "", label: "All statuses" },
  { value: "AVAILABLE", label: "Available" },
  { value: "PENDING", label: "Pending" },
  { value: "SOLD", label: "Sold" },
  { value: "RENTED", label: "Rented" },
  { value: "DRAFT", label: "Draft" },
]

const PURPOSE_OPTIONS = [
  { value: "" as const, label: "All purposes" },
  { value: "SALE" as const, label: "For sale" },
  { value: "RENT" as const, label: "For rent" },
]

const PAGE_SIZE = 25

function statusTone(status: PropertyStatus): "green" | "gold" | "neutral" | "dark" {
  if (status === "AVAILABLE") return "green"
  if (status === "PENDING") return "gold"
  if (status === "DRAFT") return "neutral"
  return "dark"
}

export default function Properties() {
  const [rows, setRows] = useState<AdminPropertySummary[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<PropertyStatus | "">("")
  const [purpose, setPurpose] = useState<PropertyPurpose | "">("")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<AdminPropertySummary | null>(null)
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 350)
    return () => window.clearTimeout(timer)
  }, [search])

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    adminApi
      .listProperties({
        status: status || undefined,
        purpose: purpose || undefined,
        search: debouncedSearch || undefined,
        page,
        ...(PAGE_SIZE ? {} : {}),
      })
      .then((result) => {
        setRows(result.items)
        setTotal(result.total)
        setTotalPages(Math.max(1, result.totalPages))
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load properties")
      })
      .finally(() => setLoading(false))
  }, [status, purpose, debouncedSearch, page])

  useEffect(() => {
    setPage(1)
  }, [status, purpose, debouncedSearch])

  useEffect(() => {
    load()
  }, [load])

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await adminApi.deleteProperty(deleting.id)
      toast("Property deleted")
      setDeleting(null)
      if (rows.length === 1 && page > 1) setPage(page - 1)
      else load()
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete property", "error")
      setDeleting(null)
    } finally {
      setBusy(false)
    }
  }

  const shown = useMemo(() => rows.slice(0, PAGE_SIZE), [rows])

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-light" style={{ fontFamily: "var(--font-display)" }}>
            Properties
          </h1>
          <p className="text-sm font-light text-[#6B6560] mt-1">
            {total} listings
          </p>
        </div>
        <Link to="/admin/properties/new">
          <Button variant="dark">New property</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px] gap-3 mb-8 p-4" style={{ backgroundColor: "#EDE6D6" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, district or city…"
          className="w-full bg-transparent text-sm font-light border border-[#0F0F0D]/15 px-3 py-2.5 outline-none focus:border-[#C9A96E]"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as PropertyStatus | "")}
          className="bg-transparent text-sm font-light border border-[#0F0F0D]/15 px-3 py-2.5 outline-none cursor-pointer"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={purpose}
          onChange={(e) => setPurpose(e.target.value as PropertyPurpose | "")}
          className="bg-transparent text-sm font-light border border-[#0F0F0D]/15 px-3 py-2.5 outline-none cursor-pointer"
        >
          {PURPOSE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <EmptyState message={error} />
      ) : loading ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <EmptyState message="No properties match the current filters." />
      ) : (
        <>
          <Table
            headers={["", "Property", "Status", "Purpose", "Price", "Agent", "Updated", ""]}
          >
            {shown.map((property) => (
              <tr
                key={property.id}
                className="border-b border-[#0F0F0D]/8 hover:bg-[#EDE6D6]/60 transition-colors"
              >
                <td className="px-4 py-3 w-16">
                  {property.coverImage ? (
                    <img
                      src={property.coverImage}
                      alt=""
                      className="w-12 h-9 object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="block w-12 h-9 bg-[#EDE6D6]" />
                  )}
                </td>
                <td className="px-4 py-3">
                  <Link
                    to={`/admin/properties/${property.id}/edit`}
                    className="block text-sm font-light text-[#0F0F0D] hover:text-[#8a6d38] transition-colors"
                  >
                    {property.title}
                  </Link>
                  <span className="text-xs font-light text-[#A09890]">
                    {property.city}
                    {property.district ? ` · ${property.district}` : ""} ·{" "}
                    {property.bedrooms}bd {property.bathrooms}ba
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(property.status)}>{property.status}</Badge>
                </td>
                <td className="px-4 py-3 text-xs font-light text-[#6B6560] uppercase">
                  {property.purpose}
                </td>
                <td className="px-4 py-3 text-sm font-light text-[#0F0F0D] tabular-nums">
                  {formatPrice(property.price)}
                </td>
                <td className="px-4 py-3 text-xs font-light text-[#6B6560]">
                  {property.agent?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs font-light text-[#A09890]">
                  {formatDate(property.createdAt)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link
                    to={`/admin/properties/${property.id}/edit`}
                    className="text-xs tracking-[0.15em] uppercase font-light text-[#8a6d38] mr-4"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => setDeleting(property)}
                    className="text-xs tracking-[0.15em] uppercase font-light text-[#A03A2E] cursor-pointer"
                  >
                    Delete
                  </button>
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

      <ConfirmDialog
        open={deleting !== null}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete property"
        message={
          deleting
            ? `This permanently deletes "${deleting.title}" including its images, amenities and viewing requests. This cannot be undone.`
            : ""
        }
        confirmLabel={busy ? "Deleting…" : "Delete"}
      />
    </div>
  )
}