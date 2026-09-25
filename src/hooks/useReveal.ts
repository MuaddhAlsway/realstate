import { useRef } from "react"
import { useGSAP } from "@gsap/react"
import { gsap } from "../animations/gsap"
import { batchReveal, forceVisible } from "../animations/motion"
import { useReducedMotion } from "./useReducedMotion"

interface RevealOptions {
  stagger?: number
  start?: string
  /** Re-run when these values change (e.g. filtered results). */
  deps?: unknown[]
}

/**
 * GSAP-powered reveal system.
 *
 * Marks the container with a ref; every descendant carrying `[data-reveal]`
 * is batch-revealed by ScrollTrigger — no need to manage classes manually.
 * Initial hidden state lives in CSS (`[data-reveal] { opacity: 0 }`).
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options: RevealOptions = {},
) {
  const scope = useRef<T>(null)
  const reduced = useReducedMotion()
  const { stagger, start, deps = [] } = options

  useGSAP(
    () => {
      const el = scope.current
      if (!el) return
      if (reduced) {
        forceVisible(el)
        return
      }
      batchReveal(el, { stagger, start })
    },
    { scope, dependencies: [reduced, ...deps] },
  )

  return scope
}
