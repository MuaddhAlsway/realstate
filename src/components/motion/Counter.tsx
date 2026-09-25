import { useRef } from "react"
import { useGSAP } from "@gsap/react"
import { gsap } from "../../animations/gsap"
import { useReducedMotion } from "../../hooks/useReducedMotion"

interface CounterProps {
  target: number
  prefix?: string
  suffix?: string
  decimals?: number
  duration?: number
  className?: string
}

/** Scroll-triggered count-up. Renders the formatted number into a span. */
export function Counter({
  target,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 2,
  className,
}: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduced = useReducedMotion()

  useGSAP(() => {
    const el = ref.current
    if (!el) return

    if (reduced) {
      el.textContent = `${prefix}${target.toFixed(decimals)}${suffix}`
      return
    }

    const state = { v: 0 }
    gsap.to(state, {
      v: target,
      duration,
      ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 92%", once: true },
      onUpdate: () => {
        el.textContent = `${prefix}${state.v.toFixed(decimals)}${suffix}`
      },
      onComplete: () => {
        el.textContent = `${prefix}${target.toFixed(decimals)}${suffix}`
      },
    })
  }, [target, reduced])

  return (
    <span ref={ref} className={className}>
      {`${prefix}${(0).toFixed(decimals)}${suffix}`}
    </span>
  )
}
