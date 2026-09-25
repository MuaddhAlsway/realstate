import { Router } from "express"
import * as db from "../models/db.js"
import { requireFields, assertEmail } from "../validators/index.js"
import { asyncHandler } from "../middleware/index.js"

const router = Router()

router.post(
  "/",
  asyncHandler((req, res) => {
    const body = req.body || {}
    requireFields(body, ["name", "email", "message"])
    assertEmail(body.email)

    const next = db.store.contacts.create({
      name: body.name,
      email: body.email,
      phone: body.phone || undefined,
      subject: body.subject || undefined,
      message: body.message,
    })

    res.status(201).json({
      success: true,
      data: { id: next.id },
      message: "Message received",
    })
  }),
)

export default router
