import { Router } from "express"
import * as db from "../models/db.js"
import { HttpError } from "../utils/HttpError.js"
import { asyncHandler } from "../middleware/index.js"

const router = Router()

router.get(
  "/",
  asyncHandler((_req, res) => {
    res.json({ success: true, data: db.neighborhoods })
  }),
)

router.get(
  "/:id",
  asyncHandler((req, res) => {
    const hood = db.neighborhoods.find((n) => n.id === req.params.id)
    if (!hood)
      throw new HttpError(
        "Neighborhood not found",
        404,
        "NEIGHBORHOOD_NOT_FOUND",
      )
    const listingCount = db.properties.filter(
      (p) => p.neighborhood === hood.name,
    ).length
    res.json({ success: true, data: { ...hood, listingCount } })
  }),
)

export default router
