import { useEffect, useSyncExternalStore } from "react"
import { REDUCED_MOTION_QUERY } from "../animations/easings"

function subscribe(callback: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY)
  mq.addEventListener("change", callback)
  return () => mq.removeEventListener("change", callback)
}

function getSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/** Live value of prefers-reduced-motion. Works with gsap.matchMedia via data-is-reduced-motion attr. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
