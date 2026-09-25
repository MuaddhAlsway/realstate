import { useRef, type ReactNode } from "react"
import { useGSAP } from "@gsap/react"
import { gsap } from "../../animations/gsap"
import { FINE_POINTER_QUERY } from "../../animations/easings"
import { useReducedMotion } from "../../hooks/useReducedMotion"

interface MagneticProps {
  children: ReactNode
  strength?: number
  className?: string
}

/**
 * Subtle magnetic pull for desktop CTAs. Transforms a wrapper span, so the
 * child link/button keeps its native hit area and focus behavior. Disabled
 * for touch devices and reduced-motion users.
 */
export function Magnetic({
  children,
  strength = 0.25,
  className,
}: MagneticProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduced = useReducedMotion()

  useGSAP(() => {
    const el = ref.current
    if (!el || reduced) return

    const finePointer = window.matchMedia(FINE_POINTER_QUERY).matches
    if (!finePointer) return

    const xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3.out" })
    const yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3.out" })
    const xInner = gsap.quickTo(el.querySelector(".magnetic-inner"), "x", {
      duration: 0.5,
      ease: "power2.out",
    })
    const yInner = gsap.quickTo(el.querySelector(".magnetic-inner"), "y", {
      duration: 0.5,
      ease: "power2.out",
    })

    const onMove = (e: globalThis.MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const relX = e.clientX - (rect.left + rect.width / 2)
      const relY = e.clientY - (rect.top + rect.height / 2)
      xTo(relX * strength)
      yTo(relY * strength)
      xInner(relX * 0.35)
      yInner(relY * 0.35)
    }
    const onLeave = () => {
      xTo(0)
      yTo(0)
      xInner(0)
      yInner(0)
    }

    el.addEventListener("mousemove", onMove)
    el.addEventListener("mouseleave", onLeave)
    return () => {
      el.removeEventListener("mousemove", onMove)
      el.removeEventListener("mouseleave", onLeave)
    }
  }, [reduced, strength])

  return (
    <span
      ref={ref}
      className={`inline-block will-change-transform ${className ?? ""}`}
    >
      <span className="magnetic-inner inline-flex will-change-transform">
        {children}
      </span>
    </span>
  )
}
