import {
  properties,
  agents,
  neighborhoods,
  type ViewingRequest,
  type ContactMessage,
  type User,
} from "../data/properties"
import { applyPropertyFilters, type PropertyQuery } from "../utils/properties"

const LATENCY = 320

interface StoredCollections {
  viewings: ViewingRequest[]
  contacts: ContactMessage[]
}

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

function writeStore(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable — non-fatal for sample flow */
  }
}

export function getStore(): StoredCollections {
  const viewings = readStore<ViewingRequest[]>("estate.viewings", [])
  const contacts = readStore<ContactMessage[]>("estate.contacts", [])
  return { viewings, contacts }
}

const delay = <T>(value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), LATENCY))

/** Route the frontend's REST calls against the local dataset. */
export async function mockRequest(
  path: string,
  options: { method?: string, body?: unknown } = {},
): Promise<{ data: unknown }> {
  const method = options.method ?? "GET"
  const url = new URL(path, "http://mock.local")
  const { viewings, contacts } = getStore()

  // ── Properties ──────────────────────────────────────────────
  if (url.pathname === "/api/properties" && method === "GET") {
    const query: PropertyQuery = {
      type: url.searchParams.get("type") as PropertyQuery["type"] ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      neighborhood: url.searchParams.get("neighborhood") ?? undefined,
      city: url.searchParams.get("city") ?? undefined,
      beds: url.searchParams.get("beds") ?? undefined,
      propType: url.searchParams.get("propType") ?? undefined,
      maxPrice: url.searchParams.get("maxPrice") ?? undefined,
      sort: url.searchParams.get("sort") as PropertyQuery["sort"] ?? undefined,
    }
    return delay({ data: applyPropertyFilters(properties, query) })
  }

  if (/^\/api\/properties\/[^/]+$/.test(url.pathname) && method === "GET") {
    const id = url.pathname.split("/")[3]
    const found = properties.find((p) => p.id === id)
    if (!found) {
      return Promise.reject(
        Object.assign(new Error("Property not found"), {
          status: 404,
          code: "PROPERTY_NOT_FOUND",
        }),
      )
    }
    return delay({ data: found })
  }

  // ── Neighborhoods & agents ──────────────────────────────────
  if (url.pathname === "/api/neighborhoods" && method === "GET") {
    return delay({ data: neighborhoods })
  }

  if (url.pathname === "/api/agents" && method === "GET") {
    return delay({ data: agents })
  }

  // ── Viewings ────────────────────────────────────────────────
  if (url.pathname === "/api/viewings" && method === "POST") {
    const body = (options.body ?? {}) as Partial<ViewingRequest>
    const next: ViewingRequest = {
      id: `v-${Date.now()}`,
      propertyId: String(body.propertyId ?? ""),
      name: String(body.name ?? ""),
      email: String(body.email ?? ""),
      phone: String(body.phone ?? ""),
      date: String(body.date ?? ""),
      message: body.message ? String(body.message) : undefined,
      createdAt: new Date().toISOString(),
    }
    writeStore("estate.viewings", [...viewings, next])
    return delay({ data: next })
  }

  // ── Contact ─────────────────────────────────────────────────
  if (url.pathname === "/api/contact" && method === "POST") {
    const body = (options.body ?? {}) as Partial<ContactMessage>
    const next: ContactMessage = {
      id: `c-${Date.now()}`,
      name: String(body.name ?? ""),
      email: String(body.email ?? ""),
      phone: body.phone ? String(body.phone) : undefined,
      subject: body.subject ? String(body.subject) : undefined,
      message: String(body.message ?? ""),
      createdAt: new Date().toISOString(),
    }
    writeStore("estate.contacts", [...contacts, next])
    return delay({ data: next })
  }

  // ── Auth (sample) ───────────────────────────────────────────
  if (url.pathname === "/api/auth/register" && method === "POST") {
    const body = (options.body ?? {}) as { name: string, email: string }
    const user: User = {
      id: `u-${Date.now()}`,
      name: body.name,
      email: body.email,
      createdAt: new Date().toISOString(),
    }
    return delay({
      data: {
        user,
        accessToken: `demo.${user.id}`,
        refreshToken: `demo-refresh.${user.id}`,
      },
    })
  }

  if (url.pathname === "/api/auth/login" && method === "POST") {
    const body = (options.body ?? {}) as { email: string }
    if (!body.email) {
      return Promise.reject(
        Object.assign(new Error("Invalid credentials"), {
          status: 401,
          code: "INVALID_CREDENTIALS",
        }),
      )
    }
    const user: User = {
      id: "u-demo",
      name: body.email
        .split("@")[0]
        .replace(/[._-]+/g, " ")
        .replace(/^./, (c) => c.toUpperCase()),
      email: body.email,
      createdAt: new Date().toISOString(),
    }
    return delay({
      data: {
        user,
        accessToken: `demo.${user.id}`,
        refreshToken: `demo-refresh.${user.id}`,
      },
    })
  }

  return Promise.reject(
    Object.assign(new Error(`No mock handler for ${method} ${url.pathname}`), {
      status: 404,
    }),
  )
}
