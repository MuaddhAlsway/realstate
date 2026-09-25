import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { api } from "../services/api"
import { REMOTE } from "../services/http"
import { useAuth } from "./AuthContext"

interface FavoritesContextValue {
  favorites: string[]
  loading: boolean
  isFavorite: (id: string) => boolean
  toggleFavorite: (id: string) => Promise<void>
  clearFavorites: () => Promise<void>
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

const STORAGE_KEY = "estate.favorites"

function readInitial(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as string[] : []
  } catch {
    return []
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [favorites, setFavorites] = useState<string[]>(readInitial)
  const [loading, setLoading] = useState(false)

  const serverSync = REMOTE && Boolean(user)

  useEffect(() => {
    if (!REMOTE || !user?.id) return
    let cancelled = false
    setLoading(true)
    api
      .fetchFavorites()
      .then((saved) => {
        if (!cancelled) setFavorites(saved.map((s) => s.id))
      })
      .catch(() => {
        /* keep local list on transient failures */
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [REMOTE, user?.id])

  useEffect(() => {
    if (!serverSync) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
      } catch {
        /* ignore */
      }
    }
  }, [favorites, serverSync])

  const toggleFavorite = useCallback(
    async (id: string) => {
      const removing = favorites.includes(id)
      setFavorites((prev) =>
        removing ? prev.filter((i) => i !== id) : [...prev, id],
      )
      if (!serverSync) return
      try {
        if (removing) await api.removeFavorite(id)
        else await api.addFavorite(id)
      } catch {
        setFavorites((prev) =>
          removing
            ? prev.includes(id)
              ? prev
              : [...prev, id]
            : prev.filter((i) => i !== id),
        )
      }
    },
    [favorites, serverSync],
  )

  const clearFavorites = useCallback(async () => {
    if (serverSync) {
      const ids = [...favorites]
      await Promise.allSettled(ids.map((id) => api.removeFavorite(id)))
    }
    setFavorites([])
  }, [favorites, serverSync])

  const value = useMemo<FavoritesContextValue>(
    () => ({
      favorites,
      loading,
      isFavorite: (id) => favorites.includes(id),
      toggleFavorite,
      clearFavorites,
    }),
    [favorites, loading, toggleFavorite, clearFavorites],
  )

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext)
  if (!ctx)
    throw new Error("useFavorites must be used within FavoritesProvider")
  return ctx
}