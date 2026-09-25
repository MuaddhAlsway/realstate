import { Router } from "express"
import propertiesRouter from "./properties.js"
import neighborhoodsRouter from "./neighborhoods.js"
import agentsRouter from "./agents.js"
import viewingsRouter from "./viewings.js"
import contactRouter from "./contact.js"
import authRouter from "./auth.js"

const router = Router()

router.use("/properties", propertiesRouter)
router.use("/neighborhoods", neighborhoodsRouter)
router.use("/agents", agentsRouter)
router.use("/viewings", viewingsRouter)
router.use("/contact", contactRouter)
router.use("/auth", authRouter)

export default router
