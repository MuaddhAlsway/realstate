import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { User } from "../data/properties"
import { api } from "../services/api"
import { REMOTE } from "../services/http"
import {
  clearSession,
  getSession,
  saveSession,
  updateSessionUser,
} from "../services/session"

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (name: string, email: string, password: string) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(
    () => getSession()?.user ?? null,
  )
  const [loading, setLoading] = useState(false)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function rehydrate() {
      if (!getSession()) {
        setBooting(false)
        return
      }
      if (REMOTE) {
        try {
          const me = await api.me()
          if (cancelled) return
          updateSessionUser(me)
          setUser(me)
        } catch {
          if (cancelled) return
          clearSession()
          setUser(null)
        }
      }
      setBooting(false)
    }
    void rehydrate()
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading: loading || booting,
      login: async (email, password) => {
        setLoading(true)
        try {
          const session = await api.login(email, password)
          saveSession({
            user: session.user,
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
          })
          setUser(session.user)
          return session.user
        } finally {
          setLoading(false)
        }
      },
      register: async (name, email, password) => {
        setLoading(true)
        try {
          const session = await api.register({ name, email, password })
          saveSession({
            user: session.user,
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
          })
          setUser(session.user)
          return session.user
        } finally {
          setLoading(false)
        }
      },
      logout: async () => {
        const refreshToken = getSession()?.refreshToken
        if (REMOTE && refreshToken) {
          try {
            await api.logout(refreshToken)
          } catch {
            /* session is cleared regardless */
          }
        }
        clearSession()
        setUser(null)
      },
    }),
    [user, loading, booting],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}