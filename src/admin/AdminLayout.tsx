import { useState, type ReactNode } from "react"
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { ToastProvider } from "./Toast"

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/properties", label: "Properties" },
  { to: "/admin/properties/new", label: "Add Property" },
  { to: "/admin/content", label: "Content" },
  { to: "/admin/viewings", label: "Viewings" },
  { to: "/admin/agents", label: "Agents" },
  { to: "/admin/users", label: "Users" },
]

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 px-4">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `px-4 py-2.5 text-xs tracking-[0.2em] uppercase font-light transition-colors ${
              isActive
                ? "bg-[#C9A96E] text-[#0F0F0D]"
                : "text-[#F5F0E8]/70 hover:text-[#F5F0E8] hover:bg-[#F5F0E8]/5"
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

function SidebarFooter() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const handleLogout = async () => {
    await logout()
    navigate("/")
  }
  return (
    <div className="mt-auto px-4 pb-6">
      <div className="px-4 py-3 mb-3" style={{ backgroundColor: "rgba(245,240,232,0.06)" }}>
        <p className="text-xs font-light text-[#F5F0E8]/90">{user?.name}</p>
        <p className="text-[11px] font-light text-[#6B6560]">{user?.email}</p>
      </div>
      <div className="flex flex-col gap-1">
        <Link
          to="/"
          className="px-4 py-2 text-xs tracking-[0.2em] uppercase font-light text-[#F5F0E8]/60 hover:text-[#F5F0E8]"
        >
          View site
        </Link>
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-left text-xs tracking-[0.2em] uppercase font-light text-[#C9A96E] hover:text-[#F5F0E8] transition-colors cursor-pointer"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false)

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#F5F0E8]">
        <aside
          className="fixed inset-y-0 left-0 w-64 hidden md:flex flex-col"
          style={{ backgroundColor: "#0F0F0D" }}
        >
          <div className="px-6 py-6">
            <span
              className="text-xl font-light tracking-[0.3em] uppercase"
              style={{ fontFamily: "var(--font-display)", color: "#F5F0E8" }}
            >
              Estate
            </span>
            <p className="text-[11px] font-light tracking-[0.2em] uppercase text-[#C9A96E] mt-1">
              Admin
            </p>
          </div>
          <NavList />
          <SidebarFooter />
        </aside>

        {/* Mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="absolute inset-0 bg-[#0F0F0D]/60"
              onClick={() => setOpen(false)}
            />
            <aside
              className="absolute inset-y-0 left-0 w-72 flex flex-col"
              style={{ backgroundColor: "#0F0F0D" }}
            >
              <div className="flex items-center justify-between px-6 py-6">
                <span
                  className="text-xl font-light tracking-[0.3em] uppercase"
                  style={{ fontFamily: "var(--font-display)", color: "#F5F0E8" }}
                >
                  Estate
                </span>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="text-[#F5F0E8]/70 text-2xl leading-none cursor-pointer"
                >
                  ×
                </button>
              </div>
              <NavList onNavigate={() => setOpen(false)} />
              <SidebarFooter />
            </aside>
          </div>
        )}

        <div className="md:pl-64">
          <header
            className="sticky top-0 z-30 flex items-center justify-between px-6 lg:px-10 py-4"
            style={{ backgroundColor: "#EDE6D6", borderBottom: "1px solid rgba(15,15,13,0.1)" }}
          >
            <button
              onClick={() => setOpen(true)}
              className="md:hidden text-[#0F0F0D] text-sm tracking-[0.2em] uppercase font-light cursor-pointer"
              aria-label="Open menu"
            >
              Menu
            </button>
            <span className="hidden md:block text-sm font-light text-[#6B6560]">
              Content &amp; Property Management
            </span>
            <Link
              to="/admin/properties/new"
              className="text-xs tracking-[0.2em] uppercase font-light px-4 py-2 cursor-pointer"
              style={{ backgroundColor: "#C9A96E", color: "#0F0F0D" }}
            >
              New property
            </Link>
          </header>
          <main className="px-6 lg:px-10 py-10">
            <Outlet />
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}