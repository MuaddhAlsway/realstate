import { describe, expect, it } from "vitest"
import { readFile } from "node:fs/promises"
import { URL } from "node:url"
import { rootErrorCode, translateDatabaseError } from "../src/errors/pg.js"
import { HttpError } from "../src/errors/index.js"
import { ErrorCodes } from "../src/errors/error-codes.js"

/**
 * Phase 07+ regression — database error translation boundary.
 *
 * These are pure unit tests (no database): they pin the translation of
 * driver errors into HTTP errors and, critically, guard against a repeat of
 * the production incident where `/api/v1/content` crashed with
 * `ReferenceError: translateError is not defined` because the content
 * service called a helper that no longer existed. The translation module
 * must always export the names the services import, and the content
 * service must never reference `translateError`.
 */

/** Build a driver-shaped error, mirroring how postgres.js surfaces failures. */
function driverError(code, extra = {}) {
  return {
    name: "PostgresError",
    message: `synthetic ${code}`,
    code,
    ...extra,
  }
}

/** Wrap a cause reachable through DrizzleQueryError → postgres.js chains. */
function withCause(inner) {
  return { name: "DrizzleQueryError", message: "query failed", cause: inner }
}

const h = (err) => translateDatabaseError(err)

describe("rootErrorCode unwraps the deepest driver code", () => {
  it("reads the code from a bare driver error", () => {
    expect(rootErrorCode(driverError("42P01"))).toBe("42P01")
  })

  it("unwraps DrizzleQueryError / postgres.js cause chains", () => {
    const wrapped = withCause(withCause(driverError("23505")))
    expect(rootErrorCode(wrapped)).toBe("23505")
  })

  it("returns null for non-driver errors", () => {
    expect(rootErrorCode(new Error("boom"))).toBeNull()
    expect(rootErrorCode({ message: "boom" })).toBeNull()
  })
})

describe("translateDatabaseError maps known classes", () => {
  it("23505 with properties_slug_key → 409 PROPERTY_SLUG_CONFLICT", () => {
    const err = h(driverError("23505", { constraint: "properties_slug_key" }))
    expect(err).toBeInstanceOf(HttpError)
    expect(err.status).toBe(409)
    expect(err.code).toBe(ErrorCodes.PROPERTY_SLUG_CONFLICT)
    expect(err.message).toMatch(/slug/i)
  })

  it("23505 with users_email_key → 409 EMAIL_CONFLICT", () => {
    const err = h(driverError("23505", { constraint: "users_email_key" }))
    expect(err.status).toBe(409)
    expect(err.code).toBe(ErrorCodes.EMAIL_CONFLICT)
  })

  it("23505 with any other constraint → 422 VALIDATION_ERROR", () => {
    const err = h(driverError("23505", { constraint: "teams_slug_key" }))
    expect(err.status).toBe(422)
    expect(err.code).toBe(ErrorCodes.VALIDATION_ERROR)
  })

  it("23503 with an agent FK → 422 INVALID_REFERENCE naming the entity", () => {
    const err = h(
      driverError("23503", {
        constraint: "properties_agent_id_agents_fk",
      }),
    )
    expect(err.status).toBe(422)
    expect(err.code).toBe(ErrorCodes.INVALID_REFERENCE)
    expect(err.message).toMatch(/agent/i)
  })

  it("23503 without a known entity → generic 422 INVALID_REFERENCE", () => {
    const err = h(driverError("23503", { constraint: "orders_user_id_fk" }))
    expect(err.status).toBe(422)
    expect(err.code).toBe(ErrorCodes.INVALID_REFERENCE)
    expect(err.message).toMatch(/related/i)
  })

  it("23502 → 422 VALIDATION_ERROR naming the offending column", () => {
    const err = h(driverError("23502", { column: "phone" }))
    expect(err.status).toBe(422)
    expect(err.code).toBe(ErrorCodes.VALIDATION_ERROR)
    expect(err.message).toMatch(/phone/i)
  })

  it("22P02 → 422 VALIDATION_ERROR (invalid enum/text representation)", () => {
    const err = h(driverError("22P02"))
    expect(err.status).toBe(422)
    expect(err.code).toBe(ErrorCodes.VALIDATION_ERROR)
  })
})

describe("unknown driver errors are passthroughs (no invented mapping)", () => {
  it("a missing table (42P01) translates to null so the caller rethrows", () => {
    const err = h(
      driverError("42P01", {
        message: 'relation "site_content" does not exist',
      }),
    )
    expect(err).toBeNull()
  })

  it("non-driver errors translate to null", () => {
    expect(h(new Error("boom"))).toBeNull()
  })
})

describe("content error path regression (production incident)", () => {
  it("contentService never references a translateError helper", async () => {
    const src = await readFile(
      new URL("../src/services/contentService.js", import.meta.url),
      "utf8",
    )
    expect(src).not.toContain("translateError")
    // The canonical, imported translation helper is used instead.
    expect(src).toContain("translateDatabaseError")
  })

  it("pg.js exports the names contentService imports", async () => {
    const src = await readFile(
      new URL("../src/errors/pg.js", import.meta.url),
      "utf8",
    )
    expect(src).toContain("export function translateDatabaseError")
  })
})
