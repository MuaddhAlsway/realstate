/**
 * Auth serializers — the wire shape for user/session payloads. Never expose
 * passwordHash, token hashes, or anything internal.
 */

export function serializeSessionUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  }
}

/** /me — adds the linked agent profile when the account has one. */
export function serializeMe(user) {
  return {
    ...serializeSessionUser(user),
    createdAt: user.createdAt?.toISOString?.() ?? null,
    agent: user.agent
      ? {
          id: user.agent.id,
          name: user.agent.name,
          role: user.agent.role ?? null,
          email: user.agent.email ?? null,
          phone: user.agent.phone ?? null,
          imageUrl: user.agent.imageUrl ?? null,
          experienceYears: user.agent.experienceYears,
        }
      : null,
  }
}
