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
import Home from "./pages/Home"
import Properties from "./pages/Properties"
import PropertyDetail from "./pages/PropertyDetail"
import Neighborhoods from "./pages/Neighborhoods"
import NeighborhoodDetail from "./pages/NeighborhoodDetail"
import Agents from "./pages/Agents"
import Saved from "./pages/Saved"
import About from "./pages/About"
import Contact from "./pages/Contact"
import Auth from "./pages/Auth"
import Dashboard from "./pages/Dashboard"

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

function Layout() {
  return (
    <PageShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/properties" element={<Properties />} />
        <Route path="/properties/:id" element={<PropertyDetail />} />
        <Route path="/neighborhoods" element={<Neighborhoods />} />
        <Route path="/neighborhoods/:id" element={<NeighborhoodDetail />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Home />} />
      </Routes>
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
        <BrowserRouter>
          <ScrollProgress />
          <CustomCursor />
          <Layout />
        </BrowserRouter>
      </FavoritesProvider>
    </AuthProvider>
  )
}
