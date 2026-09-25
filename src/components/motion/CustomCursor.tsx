import { useRef, useEffect, useState } from "react"
import { gsap } from "../../animations/gsap"
import {
  REDUCED_MOTION_QUERY,
  FINE_POINTER_QUERY,
} from "../../animations/easings"

/**
 * Restrained contextual cursor: a hairline ring + label that activates over
 * elements carrying `data-cursor="View"`. Desktop fine pointers only, and
 * fully disabled under prefers-reduced-motion. Native cursor is preserved.
 */
export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const prefersReduced = window.matchMedia(REDUCED_MOTION_QUERY).matches
    const finePointer = window.matchMedia(FINE_POINTER_QUERY).matches
    if (prefersReduced || !finePointer) return
    setEnabled(true)
  }, [])

  useEffect(() => {
    if (!enabled) return

    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    const dotX = gsap.quickTo(dot, "x", { duration: 0.15, ease: "power3.out" })
    const dotY = gsap.quickTo(dot, "y", { duration: 0.15, ease: "power3.out" })
    const ringX = gsap.quickTo(ring, "x", {
      duration: 0.45,
      ease: "power3.out",
    })
    const ringY = gsap.quickTo(ring, "y", {
      duration: 0.45,
      ease: "power3.out",
    })

    const onMove = (e: MouseEvent) => {
      dotX(e.clientX)
      dotY(e.clientY)
      ringX(e.clientX)
      ringY(e.clientY)
    }

    const labelEl = ring.querySelector(".cursor-label")
    const activate = (label: string) => {
      if (!labelEl) return
      labelEl.textContent = label
      gsap.to(ring, { scale: 1, opacity: 1, duration: 0.3, ease: "power2.out" })
      dot.style.opacity = "0"
    }
    const deactivate = () => {
      gsap.to(ring, {
        scale: 0.6,
        opacity: 0,
        duration: 0.3,
        ease: "power2.out",
      })
      dot.style.opacity = "1"
    }

    const onOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      const cursorEl = target?.closest?.("[data-cursor]") as HTMLElement | null
      if (cursorEl) activate(cursorEl.dataset.cursor || "View")
      else deactivate()
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseover", onOver)

    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseover", onOver)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <div className="custom-cursor" aria-hidden="true">
      <div ref={dotRef} className="cursor-dot" />
      <div ref={ringRef} className="cursor-ring">
        <span className="cursor-label" />
      </div>
    </div>
  )
}
