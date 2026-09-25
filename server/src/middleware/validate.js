import { HttpError } from "../errors/index.js"
import { ErrorCodes } from "../errors/error-codes.js"
import { assertNonEmptyPatch } from "../schemas/property.js"

/**
 * Zod-backed request validation middleware.
 *
 * Runs schema.safeParse against the chosen source (body | params | query)
 * and, on failure, short-circuits with the canonical error envelope. On
 * success it replaces the source with the parsed (stripped) value so
 * downstream code never handles raw input.
 *
 * Query parameters fail with INVALID_QUERY so the frontend can distinguish
 * a malformed list request from a malformed body.
 */

function describeIssues(issues) {
  return (
    issues
      .map((issue) =>
        issue.path.length
          ? `${issue.path.join(".")}: ${issue.message}`
          : issue.message,
      )
      .join("; ") || "Validation failed"
  )
}

export function validate(
  schema,
  source = "body",
  errorCode = ErrorCodes.VALIDATION_ERROR,
) {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source])
    if (!result.success) {
      return next(
        new HttpError(describeIssues(result.error.issues), 422, errorCode),
      )
    }
    // Express defines `req.query` as a getter-only accessor, so parsed query
    // data lands on `parsedQuery` (the controller reads it there).
    const target = source === "query" ? "parsedQuery" : source
    req[target] = result.data
    return next()
  }
}

/** Query-string validation — 422 INVALID_QUERY for malformed list params. */
export function validateQuery(schema) {
  return validate(schema, "query", ErrorCodes.INVALID_QUERY)
}

/** PATCH-specific validation: schema + reject an empty update object. */
export function validatePatch(schema, source = "body") {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source])
    if (!result.success) {
      return next(
        new HttpError(
          describeIssues(result.error.issues),
          422,
          ErrorCodes.VALIDATION_ERROR,
        ),
      )
    }
    if (!assertNonEmptyPatch(result.data)) {
      return next(
        new HttpError(
          "At least one property field is required for an update",
          422,
          ErrorCodes.VALIDATION_ERROR,
        ),
      )
    }
    req[source] = result.data
    return next()
  }
}
