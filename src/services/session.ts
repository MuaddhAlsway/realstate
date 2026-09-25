import type { User } from "../data/properties"

export interface Session {
  user: User
  accessToken: string
  refreshToken: string
}

const STORAGE_KEY = "estate.session"

function readInitial(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Session
    if (!parsed?.user?.id || !parsed.accessToken || !parsed.refreshToken)
      return null
    return parsed
  } catch {
    return null
  }
}

let current: Session | null = readInitial()

export function getSession(): Session | null {
  return current
}

export function getAccessToken(): string | null {
  return current?.accessToken ?? null
}

export function getRefreshToken(): string | null {
  return current?.refreshToken ?? null
}

export function saveSession(session: Session) {
  current = session
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    /* storage unavailable */
  }
}

export function updateSessionUser(user: User) {
  if (!current) return
  saveSession({ ...current, user })
}

export function clearSession() {
  current = null
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable */
  }
}