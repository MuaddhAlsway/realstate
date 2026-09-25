import { Router } from "express"
import propertiesRouter from "./properties.js"
import authRouter from "./auth.js"
import favoritesRouter from "./favorites.js"
import viewingsRouter from "./viewings.js"

const router = Router()

router.use("/properties", propertiesRouter)
router.use("/auth", authRouter)
router.use("/favorites", favoritesRouter)
router.use("/viewings", viewingsRouter)

export default router
