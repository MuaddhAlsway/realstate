import { Router } from "express"
import propertiesRouter from "./properties.js"
import agentsRouter from "./agents.js"
import authRouter from "./auth.js"
import favoritesRouter from "./favorites.js"
import viewingsRouter from "./viewings.js"
import meRouter from "./me.js"
import agentRouter from "./agent.js"
import adminRouter from "./admin.js"
import contentRouter from "./content.js"

const router = Router()

router.use("/properties", propertiesRouter)
router.use("/agents", agentsRouter)
router.use("/auth", authRouter)
router.use("/favorites", favoritesRouter)
router.use("/viewings", viewingsRouter)
router.use("/me", meRouter)
router.use("/agent", agentRouter)
router.use("/admin", adminRouter)
router.use("/content", contentRouter)

export default router
