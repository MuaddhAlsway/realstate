import { Router } from "express"
import { APP_NAME, API_VERSION } from "../config/env.js"

const router = Router()

// Service index — a human-friendly landing for the bare backend host so the
// root URL is not swallowed by the global 404 handler. No data, no secrets.
router.get("/", (_req, res) => {
  res.json({
    success: true,
    data: {
      service: APP_NAME,
      version: API_VERSION,
      status: "ok",
      endpoints: {
        health: "/api/health",
        api: "/api/v1",
      },
      timestamp: new Date().toISOString(),
    },
  })
})

export default router