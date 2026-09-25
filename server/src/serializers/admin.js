/**
 * Admin serializers — wire shapes for management endpoints. Reuse the
 * property/viewing serializers for their resources; these cover the
 * admin reference catalogs, agent profiles and user directory.
 */

function toIso(value) {
  return value instanceof Date ? value.toISOString() : (value ?? null)
}

export function serializeAdminAgent(agent) {
  return {
    id: agent.id,
    name: agent.name,
    role: agent.role ?? null,
    languages: agent.languages ?? null,
    experienceYears: agent.experienceYears,
    phone: agent.phone ?? null,
    email: agent.email ?? null,
    imageUrl: agent.imageUrl ?? null,
    user: agent.user
      ? {
          id: agent.user.id,
          name: agent.user.name,
          email: agent.user.email,
          role: agent.user.role,
        }
      : null,
    createdAt: toIso(agent.createdAt),
    updatedAt: toIso(agent.updatedAt),
  }
}

export function serializeAdminUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone ?? null,
    avatarUrl: user.avatarUrl ?? null,
    agent: user.agent ? { id: user.agent.id, name: user.agent.name } : null,
    createdAt: toIso(user.createdAt),
  }
}

export function serializeAdminAgentList(rows) {
  return rows.map(serializeAdminAgent)
}

export function serializeAdminUserList(rows) {
  return rows.map(serializeAdminUser)
}

export function serializeAgentOption(agent) {
  return { id: agent.id, name: agent.name, role: agent.role ?? null }
}

export function serializeAmenityOption(amenity) {
  return { id: amenity.id, name: amenity.name, category: amenity.category ?? null }
}

export function serializeNeighborhoodOption(neighborhood) {
  return {
    id: neighborhood.id,
    name: neighborhood.name,
    slug: neighborhood.slug,
    tagline: neighborhood.tagline ?? null,
  }
}