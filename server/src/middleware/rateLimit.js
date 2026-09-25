import { HttpError } from "../errors/index.js"
import { ErrorCodes } from "../errors/error-codes.js"

/**
 * Minimal fixed-window rate limiter (Phase 10 — media abuse protection).
 *
 * The project has no rate-limit dependency, so this is a small in-memory
 * counter per key (user id when authenticated, otherwise IP). It protects the
 * admin upload-authorization surface from unlimited signature generation.
 * In-memory state is per-instance — acceptable for the single free-tier
 * Render service, and documented as such.
 *
 * Options can be injected per-app via `app.locals.rateLimitOptions`
 * (used by tests to assert the 429 path without making hundreds of calls).
 */

const WINDOW_MS = 15 * 60 * 1000
const MAX = 120

function keyFor(req) {
  return req.user?.id ?? req.ip ?? "anon"
}

export function createRateLimiter({ windowMs = WINDOW_MS, max = MAX } = {}) {
  const hits = new Map()

  return function rateLimiter(req, res, next) {
    const options = req.app?.locals?.rateLimitOptions ?? { windowMs, max }
    const now = Date.now()
    const key = keyFor(req)
    const bucket = hits.get(key)

    let count = 1
    if (bucket && now - bucket.startedAt < options.windowMs) {
      count = bucket.count + 1
    }
    hits.set(key, { startedAt: now, count })

    // Opportunistic pruning so a long-lived process does not grow unbounded.
    if (hits.size > 10_000) {
      for (const [k, b] of hits) {
        if (now - b.startedAt >= options.windowMs) hits.delete(k)
      }
    }

    if (count > options.max) {
      return next(
        new HttpError(
          "Too many requests — slow down",
          429,
          ErrorCodes.RATE_LIMITED,
        ),
      )
    }
    next()
  }
}
