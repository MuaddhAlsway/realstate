import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { Spinner } from "./ui"

/**
 * Route guard for role-gated portals (/agent/* etc.). Defense-in-depth:
 * this is UX only — the server independently enforces the role on every
 * /api/v1/agent (and /admin) route. `roles` lists the roles allowed in;
 * ADMIN is always permitted so one account can reach both surfaces.
 */
export function RequireRole({
  roles,
  children,
}: {
  roles: Array<"USER" | "AGENT" | "ADMIN">
  children: ReactNode
}) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{ backgroundColor: "#0F0F0D", minHeight: "100vh" }}>
        <Spinner className="min-h-screen" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />
  }

  if (!roles.includes(user.role as "USER" | "AGENT" | "ADMIN") && user.role !== "ADMIN") {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}