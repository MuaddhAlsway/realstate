/**
 * HttpError — the single error type controllers/services throw to describe
 * an API failure. The error middleware serializes it into the standard
 * `{ success: false, error: { code, message } }` envelope.
 */
export class HttpError extends Error {
  constructor(message, status = 500, code = "INTERNAL_ERROR") {
    super(message)
    this.name = "HttpError"
    this.status = status
    this.code = code
  }
}
