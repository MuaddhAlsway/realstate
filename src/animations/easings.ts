export const EASE = {
  // Micro interactions: 0.15–0.35s
  micro: "power2.out",
  // UI transitions: 0.3–0.6s
  ui: "power3.out",
  // Editorial reveals: 0.6–1.2s
  editorial: "power4.out",
  // Signature cinematic curve
  cinematic: "expo.out",
  // Scrub-based, sustained motion
  scrub: "none",
} as const

export const DURATION = {
  micro: 0.3,
  ui: 0.5,
  editorial: 1,
  cinematic: 1.4,
} as const

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"
export const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)"
