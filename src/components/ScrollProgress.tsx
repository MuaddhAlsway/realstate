import { useRef } from "react"
import { useGSAP } from "@gsap/react"
import { gsap } from "../animations/gsap"

/** Thin scroll-progress line pinned under the navigation. */
export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const el = barRef.current
    if (!el) return

    gsap.to(el, {
      scaleX: 1,
      ease: "none",
      transformOrigin: "left center",
      scrollTrigger: { start: 0, end: "max", scrub: 0.4 },
    })
  })

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[70] h-[2px] pointer-events-none"
      aria-hidden="true"
    >
      <div
        ref={barRef}
        className="h-full w-full origin-left scale-x-0"
        style={{ backgroundColor: "#C9A96E" }}
      />
    </div>
  )
}
