import { HttpError } from "../errors/index.js"
import { ErrorCodes } from "../errors/error-codes.js"
import { verifyAccessToken } from "../auth/tokens.js"

/**
 * Authentication & authorization middleware.
 *
 * requireAuth   — parses `Authorization: Bearer <access token>`, verifies
 *   signature + expiry, and attaches `req.user = { id, role }`.
 * requireRole   — after requireAuth: allows only the listed roles.
 * Both fail with the canonical envelope (401 UNAUTHORIZED / 403 FORBIDDEN).
 */

export function requireAuth(req, _res, next) {
  const header = req.get("authorization") ?? ""
  const match = header.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]
  const payload = token ? verifyAccessToken(token) : null
  if (!payload) {
    return next(
      new HttpError("Authentication required", 401, ErrorCodes.UNAUTHORIZED),
    )
  }
  req.user = { id: payload.sub, role: payload.role }
  return next()
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(
        new HttpError("Authentication required", 401, ErrorCodes.UNAUTHORIZED),
      )
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new HttpError("Insufficient permissions", 403, ErrorCodes.FORBIDDEN),
      )
    }
    return next()
  }
}

/**
 * optionalAuth — attach `req.user` when a valid access token is present but
 * never fail the request (public routes that happily serve guests). Used by
 * the public inquiry endpoint so signed-in customers are linked to their
 * account (and their dashboard) without requiring a login wall.
 */
export function optionalAuth(req, _res, next) {
  const header = req.get("authorization") ?? ""
  const match = header.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]
  const payload = token ? verifyAccessToken(token) : null
  if (payload) req.user = { id: payload.sub, role: payload.role }
  return next()
}
