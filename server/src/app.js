import express from "express"
import cors from "cors"
import { NODE_ENV, CORS_ORIGINS } from "./config/env.js"
import routes from "./routes/index.js"
import v1Router from "./routes/v1/index.js"
import healthRouter from "./routes/health.js"
import { notFound, errorHandler } from "./middleware/error.js"

// Lightweight request log for operations: method, path, status, duration and
// (on failure) the error code. No bodies, headers or tokens are ever logged.
function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint()
  res.on("finish", () => {
    const durationMs =
      Number(process.hrtime.bigint() - startedAt) / 1_000_000
    const code = res.locals.errorCode ? ` ${res.locals.errorCode}` : ""
    // eslint-disable-next-line no-console
    console.log(
      `[http] ${req.method} ${req.originalUrl} ${res.statusCode}${code} ` +
        `${durationMs.toFixed(1)}ms`,
    )
  })
  next()
}

/**
 * Assembles the Express application without binding a port, so tests and
 * scripts can drive it with Supertest later (superagent.request(app)).
 */
export function createApp() {
  const app = express()

  app.disable("x-powered-by")

  app.use(
    cors({
      origin:
        CORS_ORIGINS.length === 1 && CORS_ORIGINS[0] === "*"
          ? true
          : CORS_ORIGINS,
    }),
  )
  app.use(express.json({ limit: "100kb" }))
  app.use(express.urlencoded({ extended: true }))

  if (NODE_ENV !== "test") app.use(requestLogger)

  app.use("/api/health", healthRouter)
  app.use("/api/v1", v1Router)
  app.use("/api", routes)

  app.use(notFound)
  app.use(errorHandler)

  return app
}
