import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto"
import { JWT_SECRET } from "../config/env.js"

/**
 * Token primitives for Phase 05.
 *
 * Access tokens   — short-lived HS256 JWTs (15 min). Stateless, verified with
 *   `crypto.timingSafeEqual`; payload carries only `sub` (user id), `role`
 *   and `typ: "access"`.
 *
 * Refresh tokens  — opaque 256-bit random values (base64url). The raw token
 *   is handed to the client once and NEVER stored: only its SHA-256 hash
 *   lives in `refresh_tokens.token_hash` (the schema was built for exactly
 *   this in Phase 02). Rotation (family_id + replaced_by_token_hash) and
 *   family-wide reuse detection are exercised in services/authService.js.
 *
 * Deliberately dependency-free: HS256 is a single HMAC — a 60-line standard
 * constant-time implementation beats pulling in a JWT library for two calls.
 */

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60 // 15 minutes
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days

const B64URL = (buf) =>
  Buffer.from(buf).toString("base64url").replace(/=+$/, "")

const b64urlToBuffer = (s) =>
  Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64")

function hmacSign(input) {
  return createHmac("sha256", JWT_SECRET).update(input).digest()
}

function signAccessToken(userId, role, nowSeconds) {
  const header = B64URL(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const body = B64URL(
    JSON.stringify({
      sub: userId,
      role,
      typ: "access",
      iat: nowSeconds,
      exp: nowSeconds + ACCESS_TOKEN_TTL_SECONDS,
    }),
  )
  return `${header}.${body}.${B64URL(hmacSign(`${header}.${body}`))}`
}

/** Returns the verified payload {sub, role} or null for any invalid token. */
export function verifyAccessToken(token) {
  if (typeof token !== "string") return null
  const parts = token.split(".")
  if (parts.length !== 3) return null

  const [header, body, signature] = parts
  const expected = hmacSign(`${header}.${body}`)
  let supplied
  try {
    supplied = b64urlToBuffer(signature)
  } catch {
    return null
  }
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return null
  }

  let payload
  try {
    payload = JSON.parse(b64urlToBuffer(body).toString("utf8"))
  } catch {
    return null
  }

  const now = Math.floor(Date.now() / 1000)
  if (
    typeof payload.sub !== "string" ||
    typeof payload.role !== "string" ||
    payload.typ !== "access" ||
    typeof payload.exp !== "number" ||
    payload.exp <= now
  ) {
    return null
  }
  return { sub: payload.sub, role: payload.role }
}

export function createAccessToken(userId, role) {
  return signAccessToken(userId, role, Math.floor(Date.now() / 1000))
}

/** Opaque refresh token: 32 random bytes, base64url (43 chars). */
export function createRefreshToken() {
  return B64URL(randomBytes(32))
}

/** Stored representation — the raw token is never persisted. */
export function hashRefreshToken(token) {
  return createHash("sha256").update(token).digest("hex")
}

export function refreshTokenExpiry(now = new Date()) {
  return new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000)
}
