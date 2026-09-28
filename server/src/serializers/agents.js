/**
 * Public agents serializer — mirrors the agent chunk embedded in property
 * detail responses so the frontend's shared agent mapping handles both.
 */

export function serializePublicAgent(agent) {
  return {
    id: agent.id,
    name: agent.name,
    role: agent.role ?? null,
    languages: agent.languages ?? null,
    experienceYears: agent.experienceYears,
    phone: agent.phone ?? null,
    email: agent.email ?? null,
    imageUrl: agent.imageUrl ?? null,
  }
}

export function serializePublicAgentList(rows) {
  return rows.map(serializePublicAgent)
}
