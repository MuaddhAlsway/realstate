import { Router } from "express"
import * as db from "../models/db.js"
import { HttpError } from "../utils/HttpError.js"
import { asyncHandler } from "../middleware/index.js"

const router = Router()

router.get(
  "/",
  asyncHandler((_req, res) => {
    res.json({ success: true, data: db.agents })
  }),
)

router.get(
  "/:id",
  asyncHandler((req, res) => {
    const agent = db.agents.find((a) => a.id === req.params.id)
    if (!agent) throw new HttpError("Agent not found", 404, "AGENT_NOT_FOUND")
    res.json({ success: true, data: agent })
  }),
)

export default router
