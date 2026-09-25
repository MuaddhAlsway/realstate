import { Router } from "express"
import { APP_NAME, API_VERSION, NODE_ENV } from "../config/env.js"
import { hasDatabase, pingDatabase } from "../db/index.js"
import { asyncHandler } from "../middleware/error.js"

const router = Router()

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const checks = { db: "skipped" }
    let status = "ok"
    let httpStatus = 200

    if (hasDatabase()) {
      try {
        await pingDatabase()
        checks.db = "connected"
      } catch (err) {
        // Keep the failure internal — never leak the connection string.
        // Pino replaces console in Phase 09.
        if (NODE_ENV !== "test") {
          // eslint-disable-next-line no-console
          console.error("[health] database check failed:", err.message)
        }
        checks.db = "unavailable"
        status = "degraded"
        httpStatus = 503
      }
    }

    res.status(httpStatus).json({
      success: true,
      data: {
        status,
        service: APP_NAME,
        version: API_VERSION,
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
        checks,
      },
    })
  }),
)

export default router
