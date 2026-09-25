import { HttpError } from "../utils/HttpError.js"

export function requireFields(body, fields) {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === "")
  if (missing.length) {
    throw new HttpError(
      `Missing required field(s): ${missing.join(", ")}`,
      422,
      "VALIDATION_ERROR",
    )
  }
}

export function assertEmail(value) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
    throw new HttpError(
      "A valid email address is required",
      422,
      "VALIDATION_ERROR",
    )
  }
}

export function assertId(value) {
  if (!/^[a-z0-9-]+$/i.test(String(value))) {
    throw new HttpError("Invalid identifier", 400, "VALIDATION_ERROR")
  }
}

export function normalizeQuery(query, allowed) {
  const out = {}
  for (const key of allowed) {
    const value = query[key]
    if (value !== undefined && value !== "") out[key] = value
  }
  return out
}
