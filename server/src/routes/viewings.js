import { Router } from "express"
import * as db from "../models/db.js"
import { HttpError } from "../utils/HttpError.js"
import { requireFields, assertEmail } from "../validators/index.js"
import { asyncHandler } from "../middleware/index.js"

const router = Router()

router.post(
  "/",
  asyncHandler((req, res) => {
    const body = req.body || {}
    requireFields(body, ["propertyId", "name", "email", "phone", "date"])
    assertEmail(body.email)

    if (!db.findProperty(body.propertyId)) {
      throw new HttpError(
        "Referenced property does not exist",
        422,
        "VALIDATION_ERROR",
      )
    }

    const next = db.store.viewings.create({
      propertyId: body.propertyId,
      name: body.name,
      email: body.email,
      phone: body.phone,
      date: body.date,
      message: body.message || undefined,
    })

    res
      .status(201)
      .json({ success: true, data: next, message: "Viewing request received" })
  }),
)

export default router
