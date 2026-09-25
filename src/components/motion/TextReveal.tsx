import { useId, type CSSProperties, type JSX } from "react"
import { useGSAP } from "@gsap/react"
import { gsap } from "../../animations/gsap"
import { EASE } from "../../animations/easings"
import { useReducedMotion } from "../../hooks/useReducedMotion"

interface TextRevealProps {
  text: string
  as?: keyof JSX.IntrinsicElements
  className?: string
  style?: CSSProperties
  stagger?: number
  delay?: number
  start?: string
}

/**
 * Editorial word-reveal: each word sits in an overflow-hiding mask and
 * rises into place on scroll. Reserved for headline moments.
 */
export function TextReveal({
  text,
  as = "p",
  className,
  style,
  stagger = 0.05,
  delay = 0,
  start = "top 86%",
}: TextRevealProps) {
  const Tag = as
  const id = `tr-${useId().replace(/[:]/g, "")}`
  const reduced = useReducedMotion()
  const words = text.split(" ")

  useGSAP(() => {
    const el = document.getElementById(id)
    if (!el) return

    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.set(el.querySelectorAll(".tr-word"), { yPercent: 0, opacity: 1 })
        return
      }
      gsap.fromTo(
        el.querySelectorAll(".tr-word"),
        { yPercent: 115, opacity: 0.001 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 1.15,
          ease: EASE.cinematic,
          stagger,
          delay,
          scrollTrigger: { trigger: el, start, once: true },
        },
      )
    }, el)

    return () => ctx.revert()
  }, [reduced, text, id])

  return (
    <Tag id={id} className={className} style={style} aria-label={text}>
      {words.map((word, i) => (
        <span key={i} className="tr-mask" aria-hidden="true">
          <span className="tr-word">{word}</span>
        </span>
      ))}
    </Tag>
  )
}
