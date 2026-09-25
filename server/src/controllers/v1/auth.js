import { asyncHandler } from "../../middleware/error.js"
import * as authService from "../../services/authService.js"

/**
 * Thin auth controllers — attach request metadata (ip/user-agent) for the
 * refresh-token audit trail, translate service results into the envelope.
 */

const meta = (req) => ({
  ip: req.ip ?? null,
  userAgent: (req.get("user-agent") ?? "").slice(0, 200) || null,
})

export const register = asyncHandler(async (req, res) => {
  const session = await authService.registerUser(req.body, meta(req))
  res.status(201).json({ success: true, data: session })
})

export const login = asyncHandler(async (req, res) => {
  const session = await authService.loginUser(req.body, meta(req))
  res.json({ success: true, data: session })
})

export const refresh = asyncHandler(async (req, res) => {
  const session = await authService.refreshSession(req.body, meta(req))
  res.json({ success: true, data: session })
})

export const logout = asyncHandler(async (req, res) => {
  await authService.logoutUser(req.body)
  res.status(204).end()
})

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id)
  res.json({ success: true, data: user })
})
