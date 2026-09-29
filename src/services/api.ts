import type {
  Agent,
  Neighborhood,
  Property,
  User,
  ViewingRequest,
} from "../data/properties"
import { agents } from "../data/properties"
import type { PropertyQuery } from "../utils/properties"
import { http, API_BASE, REMOTE } from "./http"
import {
  mapAgent,
  mapProperty,
  mapPropertyList,
  mapViewingList,
} from "./mapping"

export interface SessionResult {
  user: User
  accessToken: string
  refreshToken: string
}

export interface PropertyDetailResult {
  property: Property
  agent: Agent | null
}

export interface SavedFavorite {
  id: string
  savedAt: string
}

export type CreateViewingBody = {
  propertyId: string
  date: string
  time?: string
  message?: string
  name?: string
  email?: string
  phone?: string
}

const ROOT = API_BASE ? "/api/v1" : "/api"

/**
 * The live API keys properties by UUID (`properties.id`); the bundled
 * design dataset keys them by short slug (`p1`, `p2`, …). Any request that
 * takes a property id must therefore be given a real UUID — a slug would be
 * rejected with `422 propertyId: must be a valid UUID`.
 *
 * This guards the call sites so a stray design-dataset id fails fast with a
 * readable message instead of a confusing server validation error.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isRemoteId(id: string | null | undefined): boolean {
  return typeof id === "string" && UUID_RE.test(id)
}

function requireRemoteId(id: string, action: string): string {
  if (!isRemoteId(id)) {
    throw Object.assign(
      new Error(
        `Cannot ${action}: this listing is not available on the live server.`,
      ),
      { status: 422, code: "VALIDATION_ERROR" },
    )
  }
  return id
}

function toQuery(query: PropertyQuery): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, value)
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

function toBackendQuery(query: PropertyQuery): string {
  const params = new URLSearchParams()
  if (query.type === "buy") params.set("purpose", "SALE")
  if (query.type === "rent") params.set("purpose", "RENT")
  if (query.q) params.set("search", query.q)
  if (query.propType && query.propType !== "any") {
    params.set("propertyType", query.propType.toUpperCase())
  }
  if (query.beds && query.beds !== "any") params.set("minBedrooms", query.beds)
  if (query.maxPrice && query.maxPrice !== "any") {
    params.set("maxPrice", query.maxPrice)
  }
  if (query.city) params.set("city", query.city)
  if (
    query.sort === "price-asc" ||
    query.sort === "price-desc" ||
    query.sort === "newest"
  ) {
    params.set("sort", query.sort)
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

export const api = {
  fetchProperties: async (query: PropertyQuery = {}): Promise<Property[]> => {
    if (API_BASE) {
      const data = await http.get<unknown[]>(
        `${ROOT}/properties${toBackendQuery(query)}`,
      )
      return mapPropertyList(data)
    }
    return http.get<Property[]>(`${ROOT}/properties${toQuery(query)}`)
  },

  fetchProperty: async (id: string): Promise<PropertyDetailResult> => {
    const data = await http.get<Record<string, unknown>>(
      `${ROOT}/properties/${encodeURIComponent(id)}`,
    )
    if (API_BASE) {
      return {
        property: mapProperty(data),
        agent: (data?.agent ? mapAgent(data.agent) : null) as Agent | null,
      }
    }
    const property = data as unknown as Property
    return {
      property,
      agent: agents.find((a) => a.id === property.agentId) ?? null,
    }
  },

  fetchNeighborhoods: () =>
    http.get<Neighborhood[]>("/api/neighborhoods"),

  fetchAgents: async (): Promise<Agent[]> => {
    if (API_BASE) {
      const data = await http.get<unknown[]>(`${ROOT}/agents`)
      return data.map(mapAgent)
    }
    return http.get<Agent[]>("/api/agents")
  },

  fetchFavorites: async (): Promise<SavedFavorite[]> => {
    const data = await http.get<Array<Record<string, unknown>>>(
      `${ROOT}/favorites`,
    )
    return data.map((item) => ({
      id: String(item?.id ?? ""),
      savedAt: String(item?.savedAt ?? ""),
    }))
  },

  fetchFavoriteProperties: async (): Promise<Property[]> => {
    if (!API_BASE) return []
    const data = await http.get<unknown[]>(`${ROOT}/favorites`)
    return mapPropertyList(data)
  },

  addFavorite: (id: string) =>
    http.put<unknown>(
      `${ROOT}/favorites/${encodeURIComponent(requireRemoteId(id, "save this property"))}`,
    ),

  removeFavorite: (id: string) =>
    http.delete<unknown>(
      `${ROOT}/favorites/${encodeURIComponent(requireRemoteId(id, "unsave this property"))}`,
    ),

  fetchViewings: async (): Promise<ViewingRequest[]> => {
    const data = await http.get<unknown[]>(`${ROOT}/viewings`)
    return mapViewingList(data)
  },

  createViewing: (body: CreateViewingBody) =>
    http.post<unknown>(`${ROOT}/viewings`, {
      ...body,
      propertyId: REMOTE
        ? requireRemoteId(body.propertyId, "request a viewing")
        : body.propertyId,
    }),

  createContact: (body: {
    name: string
    email: string
    phone?: string
    subject?: string
    message: string
  }) => http.post<{ id: string }>("/api/contact", body),

  login: (email: string, password: string) =>
    http.post<SessionResult>(`${ROOT}/auth/login`, { email, password }),

  register: (payload: { name: string, email: string, password: string }) =>
    http.post<SessionResult>(`${ROOT}/auth/register`, payload),

  refresh: (refreshToken: string) =>
    http.post<SessionResult>(`${ROOT}/auth/refresh`, { refreshToken }),

  logout: (refreshToken: string) =>
    http.post<unknown>(`${ROOT}/auth/logout`, { refreshToken }),

  me: async (): Promise<User> => {
    // The backend returns the serialized me(user) directly as `data`.
    return http.get<User>(`${ROOT}/auth/me`)
  },
}