/**
 * Canonical API error codes. Every non-2xx response carries one of these
 * under `error.code`. Keep codes stable — the frontend and API docs rely
 * on them (no stack traces or internal SQL should reach clients).
 */
export const ErrorCodes = Object.freeze({
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  PROPERTY_NOT_FOUND: "PROPERTY_NOT_FOUND",
  AGENT_NOT_FOUND: "AGENT_NOT_FOUND",
  NEIGHBORHOOD_NOT_FOUND: "NEIGHBORHOOD_NOT_FOUND",
  // Phase 03 — property CRUD
  PROPERTY_SLUG_CONFLICT: "PROPERTY_SLUG_CONFLICT",
  INVALID_REFERENCE: "INVALID_REFERENCE",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  // Phase 04 — advanced querying (malformed query parameters)
  INVALID_QUERY: "INVALID_QUERY",
  // Phase 05 — authentication & authorization
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  EMAIL_CONFLICT: "EMAIL_CONFLICT",
  // Phase 06 — favorites (saved properties)
  FAVORITE_NOT_FOUND: "FAVORITE_NOT_FOUND",
  // Phase 07 — viewing requests
  VIEWING_NOT_FOUND: "VIEWING_NOT_FOUND",
})

/** Default human-readable message per HTTP status (used for untyped errors). */
export const STATUS_MESSAGES = Object.freeze({
  400: "Bad request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Resource not found",
  409: "Conflict",
  422: "Validation failed",
  429: "Too many requests",
  500: "Something went wrong",
  503: "Service unavailable",
})
