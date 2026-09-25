import { and, count, desc, eq, or } from "drizzle-orm"
import { getDb } from "../db/index.js"
import * as schema from "../db/schema/index.js"
import { HttpError } from "../errors/index.js"
import { ErrorCodes } from "../errors/error-codes.js"
import { translateDatabaseError } from "../errors/pg.js"

/**
 * Viewing-request service (Phase 07).
 *
 * Ownership model:
 *  - A signed-in user creates a request on a property; `userId` always comes
 *    from the session, `agentId` is inherited from the property.
 *  - "My requests" = requests a USER made, + the INBOX for the AGENT whose
 *    profile is assigned (+ everything for ADMIN).
 *  - Status transitions are role-gated: the requester may only CANCEL a
 *    PENDING request; the assigned agent or an admin may CONFIRM / COMPLETE /
 *    CANCEL. PENDING is creation-only and can never be set via PATCH.
 *  - Delete: requester, assigned agent, or admin.
 */

const { viewingRequests, properties, users } = schema

const VIEWING_ROLES = new Set(["AGENT", "ADMIN"])

function requireDb() {
  const db = getDb()
  if (!db)
    throw new HttpError(
      "Database is not configured",
      503,
      ErrorCodes.SERVICE_UNAVAILABLE,
    )
  return db
}

/** Run one DB call, translating predictable driver errors to HttpErrors. */
async function run(fn) {
  try {
    return await fn()
  } catch (err) {
    const translated = translateDatabaseError(err)
    if (translated) throw translated
    throw err
  }
}

const propertyColumns = {
  images: {
    orderBy: (img, { asc: ascOp }) => [ascOp(img.displayOrder)],
    columns: {
      id: true,
      url: true,
      altText: true,
      displayOrder: true,
      isCover: true,
    },
  },
  neighborhood: { columns: { id: true, name: true, slug: true } },
  agent: { columns: { id: true, name: true } },
}

const viewingColumns = {
  property: { with: propertyColumns },
  agent: {
    columns: {
      id: true,
      name: true,
      email: true,
      phone: true,
      imageUrl: true,
    },
  },
  user: { columns: { id: true, name: true, email: true } },
}

/** The user's agent profile id (null for users with no agent link). */
async function resolveMyAgentId(db, userId) {
  const row = await run(() =>
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true },
      with: { agent: { columns: { id: true } } },
    }),
  )
  return row?.agent?.id ?? null
}

async function findById(db, id) {
  return run(() =>
    db.query.viewingRequests.findFirst({
      where: eq(viewingRequests.id, id),
      with: viewingColumns,
    }),
  )
}

/** Create a request for the signed-in user, inheriting the property's agent. */
export async function createViewing(userId, input) {
  const db = requireDb()
  const property = await run(() =>
    db.query.properties.findFirst({
      where: eq(properties.id, input.propertyId),
      columns: { id: true, agentId: true },
    }),
  )
  if (!property)
    throw new HttpError(
      "This property does not exist",
      404,
      ErrorCodes.PROPERTY_NOT_FOUND,
    )

  const [inserted] = await run(() =>
    db.insert(viewingRequests)
      .values({
        userId,
        agentId: property.agentId,
        propertyId: property.id,
        date: input.date,
        time: input.time ?? null,
        message: input.message ?? null,
      })
      .returning({ id: viewingRequests.id }),
  )

  return findById(db, inserted.id)
}

/**
 * List requests visible to the caller: their own, plus the assigned-agent
 * inbox (AGENT) or everything (ADMIN). Newest first, paginated.
 */
export async function listViewings(userId, role, query = {}) {
  const db = requireDb()
  const page = query.page ?? 1
  const limit = query.limit ?? 12

  const scope = []
  if (role !== "ADMIN") {
    scope.push(eq(viewingRequests.userId, userId))
    if (role === "AGENT") {
      const myAgentId = await resolveMyAgentId(db, userId)
      if (myAgentId) scope.push(eq(viewingRequests.agentId, myAgentId))
    }
  }
  const scopeWhere =
    scope.length === 0 ? undefined : scope.length > 1 ? or(...scope) : scope[0]
  const where = query.status
    ? and(scopeWhere, eq(viewingRequests.status, query.status))
    : scopeWhere

  const [rows, totals] = await Promise.all([
    run(() =>
      db.query.viewingRequests.findMany({
        where,
        orderBy: desc(viewingRequests.createdAt),
        limit,
        offset: (page - 1) * limit,
        with: viewingColumns,
      }),
    ),
    run(() => db.select({ n: count() }).from(viewingRequests).where(where)),
  ])

  const total = totals[0]?.n ?? 0
  return {
    items: rows,
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.max(1, Math.ceil(total / limit)),
  }
}

export async function updateViewingStatus(id, userId, role, { status }) {
  const db = requireDb()
  const row = await run(() =>
    db.query.viewingRequests.findFirst({
      where: eq(viewingRequests.id, id),
      columns: { id: true, userId: true, agentId: true, status: true },
    }),
  )
  if (!row)
    throw new HttpError(
      "This viewing request does not exist",
      404,
      ErrorCodes.VIEWING_NOT_FOUND,
    )

  if (status === "PENDING") {
    throw new HttpError(
      "PENDING is the initial state and cannot be set via update",
      403,
      ErrorCodes.FORBIDDEN,
    )
  }

  if (row.userId === userId) {
    if (status !== "CANCELLED") {
      throw new HttpError(
        "A requester can only cancel their own request",
        403,
        ErrorCodes.FORBIDDEN,
      )
    }
    if (row.status !== "PENDING") {
      throw new HttpError(
        "Only a PENDING request can be cancelled",
        403,
        ErrorCodes.FORBIDDEN,
      )
    }
  } else if (VIEWING_ROLES.has(role)) {
    const myAgentId =
      role === "AGENT" ? await resolveMyAgentId(db, userId) : null
    const assigned =
      role === "ADMIN" || (myAgentId != null && row.agentId === myAgentId)
    if (!assigned) {
      throw new HttpError(
        "You are not authorized to update this request",
        403,
        ErrorCodes.FORBIDDEN,
      )
    }
  } else {
    throw new HttpError(
      "You are not authorized to update this request",
      403,
      ErrorCodes.FORBIDDEN,
    )
  }

  await run(() =>
    db.update(viewingRequests)
      .set({ status, updatedAt: new Date() })
      .where(eq(viewingRequests.id, id)),
  )
  return findById(db, id)
}

export async function deleteViewing(id, userId, role) {
  const db = requireDb()
  const row = await run(() =>
    db.query.viewingRequests.findFirst({
      where: eq(viewingRequests.id, id),
      columns: { id: true, userId: true, agentId: true },
    }),
  )
  if (!row)
    throw new HttpError(
      "This viewing request does not exist",
      404,
      ErrorCodes.VIEWING_NOT_FOUND,
    )

  const requester = row.userId === userId
  let agentSide = false
  if (role === "ADMIN") {
    agentSide = true
  } else if (role === "AGENT") {
    const myAgentId = await resolveMyAgentId(db, userId)
    agentSide = myAgentId != null && row.agentId === myAgentId
  }
  if (!requester && !agentSide) {
    throw new HttpError(
      "You are not authorized to delete this request",
      403,
      ErrorCodes.FORBIDDEN,
    )
  }

  await run(() =>
    db.delete(viewingRequests)
      .where(eq(viewingRequests.id, id))
      .returning({ id: viewingRequests.id }),
  )
}
