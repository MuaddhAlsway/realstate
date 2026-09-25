import { useEffect, useRef, type ReactNode } from "react"
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom"
import { useGSAP } from "@gsap/react"
import { gsap } from "./animations/gsap"
import { primeScrollTriggers } from "./animations/motion"
import { EASE } from "./animations/easings"
import Navigation from "./components/Navigation"
import Footer from "./components/Footer"
import { ScrollProgress } from "./components/ScrollProgress"
import { CustomCursor } from "./components/motion/CustomCursor"
import { AuthProvider } from "./context/AuthContext"
import { FavoritesProvider } from "./context/FavoritesContext"
import { SiteContentProvider } from "./services/siteContent"
import { RequireAdmin } from "./admin/RequireAdmin"
import AdminLayout from "./admin/AdminLayout"
import Dashboard from "./admin/pages/Dashboard"
import Properties from "./admin/pages/Properties"
import PropertyNew from "./admin/pages/PropertyNew"
import PropertyEdit from "./admin/pages/PropertyEdit"
import Content from "./admin/pages/Content"
import Viewings from "./admin/pages/Viewings"
import Agents from "./admin/pages/Agents"
import Users from "./admin/pages/Users"
import Home from "./pages/Home"
import PropertiesPage from "./pages/Properties"
import PropertyDetail from "./pages/PropertyDetail"
import Neighborhoods from "./pages/Neighborhoods"
import NeighborhoodDetail from "./pages/NeighborhoodDetail"
import AgentsPage from "./pages/Agents"
import Saved from "./pages/Saved"
import About from "./pages/About"
import Contact from "./pages/Contact"
import Auth from "./pages/Auth"
import DashboardPage from "./pages/Dashboard"

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function PageShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const shellRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const el = shellRef.current
      if (!el) return
      gsap.fromTo(el, { opacity: 0, y: 24 }, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: EASE.ui,
        overwrite: "auto",
        clearProps: "transform",
      })
    },
    { scope: shellRef, dependencies: [location.pathname, location.search] },
  )

  return (
    <div ref={shellRef}>
      <ScrollToTop />
      <Navigation />
      <main>{children}</main>
      <Footer />
    </div>
  )
}

function PublicRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/properties" element={<PropertiesPage />} />
      <Route path="/properties/:id" element={<PropertyDetail />} />
      <Route path="/neighborhoods" element={<Neighborhoods />} />
      <Route path="/neighborhoods/:id" element={<NeighborhoodDetail />} />
      <Route path="/agents" element={<AgentsPage />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/saved" element={<Saved />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="*" element={<Home />} />
    </Routes>
  )
}

function AdminRoutes() {
  return (
    <Routes>
      <Route
        element={(
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        )}
      >
        <Route index element={<Dashboard />} />
        <Route path="properties" element={<Properties />} />
        <Route path="properties/new" element={<PropertyNew />} />
        <Route path="properties/:id/edit" element={<PropertyEdit />} />
        <Route path="content" element={<Content />} />
        <Route path="viewings" element={<Viewings />} />
        <Route path="agents" element={<Agents />} />
        <Route path="users" element={<Users />} />
      </Route>
    </Routes>
  )
}

function Layout() {
  return (
    <PageShell>
      <PublicRoutes />
    </PageShell>
  )
}

export default function App() {
  useEffect(() => {
    return primeScrollTriggers()
  }, [])

  return (
    <AuthProvider>
      <FavoritesProvider>
        <SiteContentProvider>
          <BrowserRouter>
            <ScrollProgress />
            <CustomCursor />
            <Routes>
              <Route path="/admin/*" element={<AdminRoutes />} />
              <Route path="/*" element={<Layout />} />
            </Routes>
          </BrowserRouter>
        </SiteContentProvider>
      </FavoritesProvider>
    </AuthProvider>
  )
}