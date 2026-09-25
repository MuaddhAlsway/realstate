import { NODE_ENV } from "../config/env.js"
import { HttpError } from "../errors/index.js"
import { ErrorCodes, STATUS_MESSAGES } from "../errors/error-codes.js"

// eslint-disable-next-line no-unused-vars
export function notFound(req, _res, next) {
  next(
    new HttpError(
      `Route not found: ${req.method} ${req.originalUrl}`,
      404,
      ErrorCodes.NOT_FOUND,
    ),
  )
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = err.status ?? 500
  let code = err.code ?? ErrorCodes.INTERNAL_ERROR
  let message = err.message || STATUS_MESSAGES[status]

  // Malformed JSON body (express.json) arrives as a non-HttpError.
  if (err.type === "entity.parse.failed") {
    status = 400
    code = ErrorCodes.VALIDATION_ERROR
    message = "Malformed JSON payload"
  } else if (err.name === "SyntaxError" && status === 500) {
    status = 400
    code = ErrorCodes.VALIDATION_ERROR
    message = "Malformed request"
  }

  const isClientError = status < 500
  // Expose the code to the HTTP request logger (never to clients via headers).
  res.locals.errorCode = code
  if (!isClientError) {
    // Even in production we want the error surfaced — but never to clients.
    // eslint-disable-next-line no-console
    console.error(
      `[api] ${req.method} ${req.originalUrl} ${status} ${code}:`,
      err,
    )
  }

  const payload = {
    success: false,
    error: { code, message },
  }

  // Stack traces are developer tools — dev/test only.
  if (!isClientError && NODE_ENV !== "production") {
    payload.error.detail = err.stack
  }

  // Kept redundant `message` field for callers that predate the nested shape.
  if (NODE_ENV !== "production") payload.message = message

  res.status(status).json(payload)
}

/** Wraps async controllers so rejections reach the error middleware. */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}
