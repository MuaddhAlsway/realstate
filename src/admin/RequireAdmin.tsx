import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { Spinner } from "./ui"

/**
 * Route guard for /admin/*. Defense-in-depth: this is UX only — the server
 * independently requires an ADMIN token on every /api/v1/admin route.
 * While the session is still being validated we show a loader rather than
 * flashing a redirect.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
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

  if (user.role !== "ADMIN") {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}