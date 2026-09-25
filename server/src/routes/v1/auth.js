import { Router } from "express"
import { validate } from "../../middleware/validate.js"
import { requireAuth } from "../../middleware/auth.js"
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
} from "../../schemas/auth.js"
import * as authController from "../../controllers/v1/auth.js"

/**
 * /api/v1/auth — register, login, refresh-token rotation, logout, session info.
 */
const router = Router()

router.post("/register", validate(registerSchema), authController.register)
router.post("/login", validate(loginSchema), authController.login)
router.post("/refresh", validate(refreshTokenSchema), authController.refresh)
router.post("/logout", validate(refreshTokenSchema), authController.logout)
router.get("/me", requireAuth, authController.me)

export default router
