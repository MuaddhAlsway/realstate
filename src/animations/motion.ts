import { gsap, ScrollTrigger } from "./gsap"
import { EASE } from "./easings"

/**
 * Last-resort visibility guard for [data-reveal] elements.
 *
 * Reveal triggers are measured while the document is still settling, so
 * pinned spacers and lazy imagery can leave their start positions stale.
 * In the worst case an element never animates in and would sit invisible
 * forever ("blank" page). This guard force-reveals any reveal element that
 * is already at/above the top of the viewport but is still hidden, keeping
 * the ScrollTrigger reveal as the primary (animated) path and only stepping
 * in when that path failed to fire.
 */
let revealGuardRaf = 0
export function revealFallback() {
  if (revealGuardRaf) return
  revealGuardRaf = requestAnimationFrame(() => {
    revealGuardRaf = 0
    document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
      if (getComputedStyle(el).opacity !== "0") return
      const rect = el.getBoundingClientRect()
      if (rect.top <= 0 || rect.bottom <= 60) {
        gsap.set(el, { opacity: 1, y: 0 })
      }
    })
  })
}

/**
 * Global housekeeping shared by every animated page.
 *
 * Reveal/pin triggers are measured while the document is still settling —
 * lazy `<img>` srcs (and Google Fonts) shift layout, and `window.load` can be
 * delayed indefinitely on slow networks — so this pipeline re-measures on
 * every image/font finish (debounced) and again once heights stop changing,
 * then guards against any reveal element that still failed to animate in.
 */
export function primeScrollTriggers(): () => void {
  ScrollTrigger.refresh()

  let debounceId = 0
  const refresh = () => {
    ScrollTrigger.refresh()
    revealFallback()
  }
  const softRefresh = () => {
    window.clearTimeout(debounceId)
    debounceId = window.setTimeout(refresh, 120)
  }
  const onScroll = () => revealFallback()

  // `load` doesn't bubble, but capture traversal reaches every resource.
  document.addEventListener("load", softRefresh, true)
  window.addEventListener("load", refresh)
  document.addEventListener("visibilitychange", refresh)
  document.addEventListener("scroll", onScroll, { passive: true })

  // Re-measure once the document height stops changing.
  let lastHeight = -1
  let stable = 0
  const settle = window.setInterval(() => {
    const h = document.documentElement.scrollHeight
    if (h === lastHeight) {
      if (++stable >= 3) {
        window.clearInterval(settle)
        softRefresh()
      }
    } else {
      stable = 0
      lastHeight = h
    }
  }, 500)

  document.fonts?.ready.then(refresh).catch(() => {})

  window.setTimeout(revealFallback, 300)
  window.setTimeout(revealFallback, 1500)

  return () => {
    document.removeEventListener("load", softRefresh, true)
    window.removeEventListener("load", refresh)
    document.removeEventListener("visibilitychange", refresh)
    document.removeEventListener("scroll", onScroll)
    window.clearTimeout(debounceId)
    window.clearInterval(settle)
    if (revealGuardRaf) cancelAnimationFrame(revealGuardRaf)
    ScrollTrigger.getAll().forEach((st) => st.kill())
  }
}

/**
 * Batch-reveal every [data-reveal] inside a container as it enters the
 * viewport, wipe-reveal [data-frame] image frames, and apply a light scrub
 * parallax to [data-parallax] elements (measured against their parent).
 */
export function batchReveal(
  scope: Element,
  options?: { start?: string, stagger?: number, y?: number },
) {
  const elements = scope.querySelectorAll<HTMLElement>("[data-reveal]")
  if (elements.length > 0) {
    ScrollTrigger.batch(elements, {
      start: options?.start ?? "top 88%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          opacity: 1,
          y: 0,
          duration: 1.1,
          ease: EASE.editorial,
          stagger: options?.stagger ?? 0.09,
        }),
    })
  }

  scope.querySelectorAll<HTMLElement>("[data-frame]").forEach((frame) => {
    const img = frame.querySelector("img")
    const config = {
      trigger: frame,
      start: "top 86%",
      once: true,
    }
    gsap.fromTo(frame, { clipPath: "inset(0 0 100% 0)" }, {
      clipPath: "inset(0 0 0% 0)",
      duration: 1.2,
      ease: EASE.editorial,
      scrollTrigger: config,
    })
    if (img) {
      gsap.fromTo(img, { scale: 1.14 }, {
        scale: 1,
        duration: 1.7,
        ease: "power2.out",
        scrollTrigger: config,
      })
    }
  })

  scope.querySelectorAll<HTMLElement>("[data-parallax]").forEach((target) => {
    const parent = (target.parentElement ?? target) as HTMLElement
    gsap.fromTo(target, { yPercent: -7 }, {
      yPercent: 7,
      ease: "none",
      scrollTrigger: {
        trigger: parent,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
      },
    })
  })
}

/** Hard-set animated atoms to their resting state (reduced motion). */
export function forceVisible(scope: Element) {
  scope.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
    gsap.set(el, { opacity: 1, y: 0, clearProps: "transform" })
  })
  scope.querySelectorAll<HTMLElement>("[data-frame]").forEach((frame) => {
    gsap.set(frame, { clipPath: "inset(0 0 0% 0)", clearProps: "clipPath" })
    const img = frame.querySelector("img")
    if (img) gsap.set(img, { scale: 1, clearProps: "transform" })
  })
  scope.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
    gsap.set(el, { yPercent: 0, clearProps: "transform" })
  })
  scope
    .querySelectorAll<HTMLElement>("[data-hero-line], [data-hero-fade]")
    .forEach((el) => {
      gsap.set(el, { clearProps: "all" })
    })
}

export { gsap, ScrollTrigger }
