import { serializePropertySummary } from "./properties.js"

/**
 * Viewing-request serializers — a request carries the property, the assigned
 * agent, and the requesting user so both sides of the conversation have what
 * they need without extra round-trips.
 */

function serializeViewing(row) {
  return {
    id: row.id,
    property: row.property ? serializePropertySummary(row.property) : null,
    agent: row.agent
      ? {
          id: row.agent.id,
          name: row.agent.name,
          email: row.agent.email ?? null,
          phone: row.agent.phone ?? null,
          imageUrl: row.agent.imageUrl ?? null,
        }
      : null,
    requester: row.user
      ? {
          id: row.user.id,
          name: row.user.name,
          email: row.user.email,
        }
      : null,
    date: row.date,
    time: row.time ? row.time.slice(0, 5) : null, // Postgres TIME reads back as HH:MM:SS
    message: row.message ?? null,
    status: row.status,
    createdAt: row.createdAt?.toISOString?.() ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? null,
  }
}

export function serializeViewingDetail(row) {
  return serializeViewing(row)
}

export function serializeViewingList(rows) {
  return rows.map(serializeViewing)
}
