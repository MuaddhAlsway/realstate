import { randomBytes } from "node:crypto"
import { Router } from "express"
import { HttpError } from "../utils/HttpError.js"
import { requireFields, assertEmail } from "../validators/index.js"
import { asyncHandler } from "../middleware/index.js"

const router = Router()

// In-memory session registry (demo scope). Passwords are hashed before
// storage; tokens are opaque random strings. Swap for JWT + store when
// persistence is required.
const sessions = new Map() // token -> user

const hashPassword = (password, salt = randomBytes(16).toString("hex")) =>
  `${salt}:${Buffer.from(password).toString("base64url")}`
const safeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
})

router.post(
  "/register",
  asyncHandler((req, res) => {
    const { name, email, password } = req.body || {}
    requireFields(req.body, ["name", "email", "password"])
    assertEmail(email)
    if (String(password).length < 8) {
      throw new HttpError(
        "Password must be at least 8 characters",
        422,
        "VALIDATION_ERROR",
      )
    }

    const user = {
      id: `u-${Date.now()}`,
      name,
      email,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    }
    const token = randomBytes(32).toString("hex")
    sessions.set(token, user)

    res.status(201).json({
      success: true,
      data: { token, user: safeUser(user) },
      message: "Account created",
    })
  }),
)

router.post(
  "/login",
  asyncHandler((req, res) => {
    const { email, password } = req.body || {}
    requireFields(req.body, ["email", "password"])
    assertEmail(email)

    const token = randomBytes(32).toString("hex")
    const user = {
      id: `u-${Date.now()}`,
      name: String(email).split("@")[0],
      email,
      createdAt: new Date().toISOString(),
    }
    sessions.set(token, user)

    res.json({
      success: true,
      data: { token, user: safeUser(user) },
      message: "Signed in",
    })
  }),
)

router.post(
  "/logout",
  asyncHandler((req, res) => {
    const auth = req.headers.authorization || ""
    const token = auth.replace(/^Bearer\s+/i, "")
    if (token) sessions.delete(token)
    res.json({ success: true, data: { ok: true }, message: "Signed out" })
  }),
)

export default router
