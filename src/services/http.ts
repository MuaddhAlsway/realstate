import { mockRequest } from "./mock"
import type { User } from "../data/properties"
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  saveSession,
} from "./session"

/**
 * API_BASE is empty inside the Figma Make preview, so requests resolve
 * against the local mock layer. Set VITE_API_URL to the running express
 * server (e.g. http://localhost:4000) to go remote: auth, favorites and
 * viewings then hit the real /api/v1 endpoints with Bearer token auth.
 */
export const API_BASE: string =
  import.meta.env.VITE_API_URL as string | undefined ?? ""

/** True when the frontend is wired to the real backend. */
export const REMOTE = Boolean(API_BASE)

export interface ApiError extends Error {
  status?: number
  code?: string
}

export interface ApiEnvelope {
  success: boolean
  data: unknown
  meta?: Record<string, unknown>
  message?: string
  error?: { code?: string, message?: string }
}

function apiError(envelope: ApiEnvelope, status: number): ApiError {
  const message =
    envelope.error?.message ??
    envelope.message ??
    `Request failed (${status})`
  const code = envelope.error?.code
  return Object.assign(new Error(message), {
    status,
    ...(code ? { code } : {}),
  })
}

async function refreshSession(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
    const envelope = (await res.json().catch(() => ({}))) as ApiEnvelope
    const data = envelope.data as
      | { user: User, accessToken: string, refreshToken?: string }
      | undefined
    if (!envelope.success || !data?.accessToken || !data.user) return false
    saveSession({
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? refreshToken,
    })
    return true
  } catch {
    return false
  }
}

/** Core remote call: returns the whole envelope (with meta) or throws. */
async function remoteEnvelope<T>(
  path: string,
  options: { method?: string, body?: unknown } = {},
  retried = false,
): Promise<ApiEnvelope> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  const token = getAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  // 204 No Content — the backend's convention for deletes and logout. An
  // empty response body is not an error; return a successful empty envelope.
  if (res.status === 204) return { success: true, data: undefined }

  const envelope = (await res.json().catch(() => ({}))) as ApiEnvelope

  if (res.status === 401 && !retried && path !== "/api/v1/auth/login") {
    if (await refreshSession()) return remoteEnvelope<T>(path, options, true)
    clearSession()
  }

  if (!res.ok || !envelope.success) throw apiError(envelope, res.status)
  return envelope
}

async function remoteRequest<T>(
  path: string,
  options: { method?: string, body?: unknown } = {},
  retried = false,
): Promise<T> {
  const envelope = await remoteEnvelope<T>(path, options, retried)
  return envelope.data as T
}

async function mockRequestSafeEnvelope<T>(
  path: string,
  options: { method?: string, body?: unknown } = {},
): Promise<ApiEnvelope> {
  try {
    return (await mockRequest(path, options)) as ApiEnvelope
  } catch (err) {
    const e = err as { message?: string, status?: number, code?: string }
    throw Object.assign(new Error(e.message || "Request failed"), {
      status: e.status,
      code: e.code,
    })
  }
}

async function mockRequestSafe<T>(
  path: string,
  options: { method?: string, body?: unknown } = {},
): Promise<T> {
  const envelope = await mockRequestSafeEnvelope<T>(path, options)
  return envelope.data as T
}

async function request<T>(
  path: string,
  options: { method?: string, body?: unknown } = {},
): Promise<T> {
  if (API_BASE) return remoteRequest<T>(path, options)
  return mockRequestSafe<T>(path, options)
}

/** Envelope-returning request (keeps `meta` for paginated admin lists). */
async function requestEnvelope<T>(
  path: string,
  options: { method?: string, body?: unknown } = {},
): Promise<ApiEnvelope & { data: T }> {
  // Envelope data is `unknown` by contract; T is the caller-asserted shape.
  const envelope = await (API_BASE
    ? remoteEnvelope<T>(path, options)
    : mockRequestSafeEnvelope<T>(path, options))
  return envelope as unknown as ApiEnvelope & { data: T }
}

export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  /** GET returning the full envelope so callers can read pagination meta. */
  getEnvelope: <T>(path: string) => requestEnvelope<T>(path, { method: "GET" }),
}