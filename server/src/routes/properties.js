import { Router } from "express"
import * as db from "../models/db.js"
import { applyPropertyFilters } from "../utils/filters.js"
import { HttpError } from "../utils/HttpError.js"
import { normalizeQuery } from "../validators/index.js"
import { asyncHandler } from "../middleware/index.js"

const router = Router()

router.get(
  "/",
  asyncHandler((req, res) => {
    const query = normalizeQuery(req.query, [
      "type",
      "q",
      "neighborhood",
      "city",
      "beds",
      "propType",
      "maxPrice",
      "sort",
    ])
    const items = applyPropertyFilters(db.properties, query)
    res.json({
      success: true,
      data: items,
      message: `${items.length} properties`,
    })
  }),
)

router.get(
  "/:id",
  asyncHandler((req, res) => {
    const property = db.findProperty(req.params.id)
    if (!property)
      throw new HttpError("Property not found", 404, "PROPERTY_NOT_FOUND")
    res.json({ success: true, data: property })
  }),
)

export default router
