import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const DATA_PATH = fileURLToPath(
  new URL("../../../shared/estate-data.json", import.meta.url),
)

const raw = JSON.parse(readFileSync(DATA_PATH, "utf8"))

export const properties = raw.properties
export const agents = raw.agents
export const neighborhoods = raw.neighborhoods

// In-memory stores for demo mutation endpoints.
const viewings = []
const contacts = []

export const store = {
  viewings: {
    list: () =>
      [...viewings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    create: (payload) => {
      const next = {
        id: `v-${Date.now()}`,
        ...payload,
        createdAt: new Date().toISOString(),
      }
      viewings.push(next)
      return next
    },
  },
  contacts: {
    list: () =>
      [...contacts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    create: (payload) => {
      const next = {
        id: `c-${Date.now()}`,
        ...payload,
        createdAt: new Date().toISOString(),
      }
      contacts.push(next)
      return next
    },
  },
}

export function findProperty(id) {
  return properties.find((p) => p.id === id) || null
}
