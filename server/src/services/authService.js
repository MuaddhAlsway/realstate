import { eq } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import { getDb } from "../db/index.js"
import * as schema from "../db/schema/index.js"
import { HttpError } from "../errors/index.js"
import { ErrorCodes } from "../errors/error-codes.js"
import { rootErrorCode, translateDatabaseError } from "../errors/pg.js"
import { hashPassword, verifyPassword } from "../auth/password.js"
import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
} from "../auth/tokens.js"
import { serializeSessionUser, serializeMe } from "../serializers/auth.js"

/**
 * Auth service — registration, session issuance and refresh-token rotation.
 *
 * Security model (matches the refresh_tokens schema built in Phase 02):
 *  - Access tokens are stateless HS256 JWTs (15 min).
 *  - Refresh tokens are opaque random values; only their SHA-256 hash is
 *    stored. Every refresh ROTATES: the presented hash is marked with its
 *    replacement (replacedByTokenHash) and a new hash is inserted into the
 *    SAME family.
 *  - Reuse detection: presenting an already-rotated token means theft →
 *    the whole family is revoked and the request gets 401.
 *  - Logout revokes the entire family.
 *  - Role is fixed at registration (never from body input): users must be
 *    promoted to AGENT/ADMIN by the seed or an operator.
 */

const { users, refreshTokens } = schema

function requireDb() {
  const db = getDb()
  if (!db)
    throw new HttpError(
      "Database is not configured",
      503,
      ErrorCodes.SERVICE_UNAVAILABLE,
    )
  return db
}

async function run(fn) {
  try {
    return await fn()
  } catch (err) {
    const translated = translateDatabaseError(err)
    if (translated) throw translated
    throw err
  }
}

function invalidCredentials() {
  return new HttpError(
    "Invalid email or password",
    401,
    ErrorCodes.UNAUTHORIZED,
  )
}

async function requireUser(userId) {
  const db = requireDb()
  const row = await run(() =>
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, name: true, email: true, role: true },
    }),
  )
  if (!row)
    throw new HttpError(
      "The account for this session no longer exists",
      401,
      ErrorCodes.UNAUTHORIZED,
    )
  return row
}

async function insertRefreshSession(db, { userId, familyId, userAgent, ip }) {
  const refreshToken = createRefreshToken()
  await run(() =>
    db.insert(refreshTokens).values({
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      familyId,
      expiresAt: refreshTokenExpiry(),
      userAgent: userAgent ?? null,
      ip: ip ?? null,
    }),
  )
  return refreshToken
}

export async function registerUser(input, meta = {}) {
  const db = requireDb()

  const existing = await run(() =>
    db.query.users.findFirst({
      where: eq(users.email, input.email),
      columns: { id: true },
    }),
  )
  if (existing) {
    throw new HttpError(
      "An account with this email already exists",
      409,
      ErrorCodes.EMAIL_CONFLICT,
    )
  }

  const passwordHash = await hashPassword(input.password)
  let created
  try {
    created = await run(() =>
      db.insert(users)
        .values({
          name: input.name,
          email: input.email,
          passwordHash,
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
        }),
    )
  } catch (err) {
    // Guard the email uniqueness race (unique index users_email_key).
    if (rootErrorCode(err) === "23505") {
      throw new HttpError(
        "An account with this email already exists",
        409,
        ErrorCodes.EMAIL_CONFLICT,
      )
    }
    throw err
  }

  const user = created[0]
  const familyId = randomUUID()
  const refreshToken = await insertRefreshSession(db, {
    userId: user.id,
    familyId,
    userAgent: meta.userAgent,
    ip: meta.ip,
  })
  return {
    user: serializeSessionUser(user),
    accessToken: createAccessToken(user.id, user.role),
    refreshToken,
  }
}

export async function loginUser(input, meta = {}) {
  const db = requireDb()
  const row = await run(() =>
    db.query.users.findFirst({
      where: eq(users.email, input.email),
      columns: {
        id: true,
        name: true,
        email: true,
        role: true,
        passwordHash: true,
      },
    }),
  )
  if (!row || !(await verifyPassword(input.password, row.passwordHash))) {
    throw invalidCredentials()
  }

  const user = {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
  }
  const familyId = randomUUID()
  const refreshToken = await insertRefreshSession(db, {
    userId: user.id,
    familyId,
    userAgent: meta.userAgent,
    ip: meta.ip,
  })
  return {
    user: serializeSessionUser(user),
    accessToken: createAccessToken(user.id, user.role),
    refreshToken,
  }
}

export async function refreshSession({ refreshToken: rawToken }, meta = {}) {
  const db = requireDb()
  const tokenHash = hashRefreshToken(rawToken)
  const row = await run(() =>
    db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, tokenHash),
    }),
  )

  if (!row || row.revokedAt) {
    throw new HttpError("Invalid refresh token", 401, ErrorCodes.UNAUTHORIZED)
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(
      "Refresh token expired — please sign in again",
      401,
      ErrorCodes.UNAUTHORIZED,
    )
  }
  if (row.replacedByTokenHash) {
    // A rotated token resurfaced — that is reuse, i.e. likely theft.
    await run(() =>
      db.update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.familyId, row.familyId)),
    )
    throw new HttpError(
      "Refresh token reuse detected — session revoked, please sign in again",
      401,
      ErrorCodes.UNAUTHORIZED,
    )
  }

  // Rotate.
  const nextRaw = createRefreshToken()
  const nextHash = hashRefreshToken(nextRaw)
  await run(() =>
    db.update(refreshTokens)
      .set({ replacedByTokenHash: nextHash })
      .where(eq(refreshTokens.id, row.id)),
  )
  await run(() =>
    db.insert(refreshTokens).values({
      userId: row.userId,
      tokenHash: nextHash,
      familyId: row.familyId,
      expiresAt: refreshTokenExpiry(),
      userAgent: meta.userAgent ?? null,
      ip: meta.ip ?? null,
    }),
  )

  const user = await requireUser(row.userId)
  return {
    user: serializeSessionUser(user),
    accessToken: createAccessToken(user.id, user.role),
    refreshToken: nextRaw,
  }
}

export async function logoutUser({ refreshToken: rawToken }) {
  const db = requireDb()
  const row = await run(() =>
    db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, hashRefreshToken(rawToken)),
      columns: { familyId: true, revokedAt: true },
    }),
  )
  if (row && !row.revokedAt) {
    await run(() =>
      db.update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.familyId, row.familyId)),
    )
  }
}

export async function getCurrentUser(userId) {
  const db = requireDb()
  const row = await run(() =>
    db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        agent: {
          columns: {
            id: true,
            name: true,
            email: true,
            phone: true,
            imageUrl: true,
            role: true,
            experienceYears: true,
          },
        },
      },
    }),
  )
  if (!row)
    throw new HttpError(
      "The account for this session no longer exists",
      401,
      ErrorCodes.UNAUTHORIZED,
    )
  return serializeMe(row)
}
