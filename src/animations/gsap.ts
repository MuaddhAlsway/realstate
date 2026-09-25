import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

ScrollTrigger.config({ ignoreMobileResize: true })
gsap.defaults({ ease: "power4.out", duration: 1, overwrite: "auto" })

export { gsap, ScrollTrigger }
