import { HttpError } from "./index.js"
import { ErrorCodes } from "./error-codes.js"

/**
 * Predictable PostgreSQL error → HTTP error translation.
 *
 * Raw database errors must never reach clients. Known failure classes get a
 * meaningful code + message; anything else returns null so the caller can
 * rethrow it as an unhandled 500 (logged server-side, hidden from clients).
 */

const REFERENCE_ENTITIES = {
  agents: "agent",
  neighborhoods: "neighborhood",
}

/**
 * Drizzle throws a DrizzleQueryError that wraps the driver's PostgresError
 * under `.cause` (which is where postgres.js keeps `code`/`constraint`).
 * Unwrap to the deepest error that actually carries a driver code.
 */
function driverError(err) {
  let current = err
  while (current && typeof current.code !== "string" && current.cause) {
    current = current.cause
  }
  return current && typeof current.code === "string" ? current : err
}

/** Root Postgres error code (e.g. "23505") or null when not a driver error. */
export function rootErrorCode(err) {
  const driver = driverError(err)
  return driver && typeof driver.code === "string" ? driver.code : null
}

export function translateDatabaseError(err) {
  const driver = driverError(err)
  if (!driver || typeof driver.code !== "string") return null

  switch (driver.code) {
    // unique_violation
    case "23505": {
      const constraint = driver.constraint ?? driver.constraint_name
      if (constraint === "properties_slug_key") {
        return new HttpError(
          "A property with this slug already exists",
          409,
          ErrorCodes.PROPERTY_SLUG_CONFLICT,
        )
      }
      if (constraint === "users_email_key") {
        return new HttpError(
          "An account with this email already exists",
          409,
          ErrorCodes.EMAIL_CONFLICT,
        )
      }
      return new HttpError(
        "A unique value was already taken",
        422,
        ErrorCodes.VALIDATION_ERROR,
      )
    }

    // foreign_key_violation — an agent/neighborhood reference that doesn't exist.
    case "23503": {
      const constraint = driver.constraint ?? driver.constraint_name
      const match =
        constraint && constraint.match(/properties_(\w+)_id_(\w+)_fk/)
      const entity = match
        ? (REFERENCE_ENTITIES[match[2]] ?? match[2])
        : "related"
      return new HttpError(
        `Referenced ${entity} does not exist`,
        422,
        ErrorCodes.INVALID_REFERENCE,
      )
    }

    // not_null_violation
    case "23502":
      return new HttpError(
        `Missing value for ${driver.column ?? driver.column_name ?? "a required column"}`,
        422,
        ErrorCodes.VALIDATION_ERROR,
      )

    // invalid text representation (e.g. bad enum value) / numeric out of range
    case "22P02":
    case "22003":
      return new HttpError(
        "Invalid value for a database column",
        422,
        ErrorCodes.VALIDATION_ERROR,
      )

    default:
      return null
  }
}
