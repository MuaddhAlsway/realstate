import { useCallback, useEffect, useState } from "react"
import {
  adminApi,
  type AdminUser,
  type UserRole,
} from "../../services/admin"
import {
  Badge,
  EmptyState,
  Spinner,
  Table,
  formatDate,
} from "../ui"

function roleTone(role: UserRole): "dark" | "gold" | "neutral" {
  if (role === "ADMIN") return "dark"
  if (role === "AGENT") return "gold"
  return "neutral"
}

export default function Users() {
  const [rows, setRows] = useState<AdminUser[]>([])
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 350)
    return () => window.clearTimeout(timer)
  }, [search])

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    adminApi
      .users(debouncedSearch || undefined)
      .then((result) => {
        setRows(result.items)
        setTotal(result.total)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load users")
      })
      .finally(() => setLoading(false))
  }, [debouncedSearch])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-light" style={{ fontFamily: "var(--font-display)" }}>
        Users
      </h1>
      <p className="text-sm font-light text-[#6B6560] mt-1 mb-8">
        {total} account{total === 1 ? "" : "s"} on the platform
      </p>

      <div className="mb-8" style={{ backgroundColor: "#EDE6D6", padding: "12px" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full bg-transparent text-sm font-light border border-[#0F0F0D]/15 px-3 py-2.5 outline-none focus:border-[#C9A96E]"
        />
      </div>

      {error ? (
        <EmptyState message={error} />
      ) : loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState message="No accounts match the current search." />
      ) : (
        <Table headers={["Name", "Email", "Role", "Agent profile", "Phone", "Joined"]}>
          {rows.map((user) => (
            <tr key={user.id} className="border-b border-[#0F0F0D]/8 hover:bg-[#EDE6D6]/60">
              <td className="px-4 py-3 text-sm font-light text-[#0F0F0D]">{user.name}</td>
              <td className="px-4 py-3 text-sm font-light text-[#6B6560]">{user.email}</td>
              <td className="px-4 py-3">
                <Badge tone={roleTone(user.role)}>{user.role}</Badge>
              </td>
              <td className="px-4 py-3 text-sm font-light text-[#6B6560]">
                {user.agent?.name ?? "—"}
              </td>
              <td className="px-4 py-3 text-sm font-light text-[#6B6560]">{user.phone ?? "—"}</td>
              <td className="px-4 py-3 text-xs font-light text-[#A09890]">
                {formatDate(user.createdAt)}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}