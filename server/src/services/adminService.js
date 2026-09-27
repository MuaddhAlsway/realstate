import { asc, count, desc, eq, sql } from "drizzle-orm"
import { getDb } from "../db/index.js"
import * as schema from "../db/schema/index.js"
import { HttpError } from "../errors/index.js"
import { ErrorCodes } from "../errors/error-codes.js"
import { translateDatabaseError } from "../errors/pg.js"
import { hashPassword } from "../auth/password.js"

/**
 * Admin aggregation + reference reads (Phase 09).
 *
 * These endpoints are ADMIN-gated at the router; the service itself has no
 * notion of the caller (middleware already resolved `req.user.role`). Every
 * query stays scoped: users lists never touch password_hash or tokens, and
 * agent updates are limited to the editable profile columns.
 */

const {
  agents,
  users,
  neighborhoods,
  amenities,
  properties,
  viewingRequests,
  favorites,
  inquiries,
} = schema

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

// ── Dashboard ────────────────────────────────────────────────────────

export async function getDashboard() {
  const db = requireDb()
  const countAll = (table) => () =>
    run(() => db.select({ n: count() }).from(table))

  const [propertiesTotal, propertiesAvailable, propertiesPending, propertiesDraft,
    propertiesSold, propertiesRented, propertiesSale, propertiesRent, propertiesFeatured,
    usersTotal, agentsTotal, viewingsTotal, viewingsPending, viewingsConfirmed,
    viewingsCompleted, viewingsCancelled, favoritesTotal, neighborhoodsTotal, amenitiesTotal,
    inquiriesTotal, inquiriesPending, inquiriesInProgress, inquiriesCompleted, inquiriesCancelled] =
    await Promise.all([
      countAll(properties)(),
      run(() =>
        db
          .select({ n: count() })
          .from(properties)
          .where(eq(properties.status, "AVAILABLE")),
      ),
      run(() =>
        db
          .select({ n: count() })
          .from(properties)
          .where(eq(properties.status, "PENDING")),
      ),
      run(() =>
        db
          .select({ n: count() })
          .from(properties)
          .where(eq(properties.status, "DRAFT")),
      ),
      run(() =>
        db
          .select({ n: count() })
          .from(properties)
          .where(eq(properties.status, "SOLD")),
      ),
      run(() =>
        db
          .select({ n: count() })
          .from(properties)
          .where(eq(properties.status, "RENTED")),
      ),
      run(() =>
        db
          .select({ n: count() })
          .from(properties)
          .where(eq(properties.purpose, "SALE")),
      ),
      run(() =>
        db
          .select({ n: count() })
          .from(properties)
          .where(eq(properties.purpose, "RENT")),
      ),
      run(() =>
        db
          .select({ n: count() })
          .from(properties)
          .where(eq(properties.featured, true)),
      ),
      countAll(users)(),
      countAll(agents)(),
      countAll(viewingRequests)(),
      run(() =>
        db
          .select({ n: count() })
          .from(viewingRequests)
          .where(eq(viewingRequests.status, "PENDING")),
      ),
      run(() =>
        db
          .select({ n: count() })
          .from(viewingRequests)
          .where(eq(viewingRequests.status, "CONFIRMED")),
      ),
      run(() =>
        db
          .select({ n: count() })
          .from(viewingRequests)
          .where(eq(viewingRequests.status, "COMPLETED")),
      ),
      run(() =>
        db
          .select({ n: count() })
          .from(viewingRequests)
          .where(eq(viewingRequests.status, "CANCELLED")),
      ),
      countAll(favorites)(),
      countAll(neighborhoods)(),
      countAll(amenities)(),
      countAll(inquiries)(),
      run(() =>
        db
          .select({ n: count() })
          .from(inquiries)
          .where(eq(inquiries.status, "PENDING")),
      ),
      run(() =>
        db
          .select({ n: count() })
          .from(inquiries)
          .where(eq(inquiries.status, "IN_PROGRESS")),
      ),
      run(() =>
        db
          .select({ n: count() })
          .from(inquiries)
          .where(eq(inquiries.status, "COMPLETED")),
      ),
      run(() =>
        db
          .select({ n: count() })
          .from(inquiries)
          .where(eq(inquiries.status, "CANCELLED")),
      ),
    ])

  const n = (row) => row?.[0]?.n ?? 0

  return {
    properties: {
      total: n(propertiesTotal),
      byStatus: {
        AVAILABLE: n(propertiesAvailable),
        PENDING: n(propertiesPending),
        DRAFT: n(propertiesDraft),
        SOLD: n(propertiesSold),
        RENTED: n(propertiesRented),
      },
      byPurpose: {
        SALE: n(propertiesSale),
        RENT: n(propertiesRent),
      },
      featured: n(propertiesFeatured),
    },
    users: n(usersTotal),
    agents: n(agentsTotal),
    neighborhoods: n(neighborhoodsTotal),
    amenities: n(amenitiesTotal),
    favorites: n(favoritesTotal),
    viewingRequests: {
      total: n(viewingsTotal),
      byStatus: {
        PENDING: n(viewingsPending),
        CONFIRMED: n(viewingsConfirmed),
        COMPLETED: n(viewingsCompleted),
        CANCELLED: n(viewingsCancelled),
      },
    },
    inquiries: {
      total: n(inquiriesTotal),
      byStatus: {
        PENDING: n(inquiriesPending),
        IN_PROGRESS: n(inquiriesInProgress),
        COMPLETED: n(inquiriesCompleted),
        CANCELLED: n(inquiriesCancelled),
      },
    },
    // Closed deals — completed inquiries are the pipeline's terminal row.
    deals: n(inquiriesCompleted),
  }
}

// ── Reference catalogs (form options in the admin UI) ──────────────────

export async function listAmenityOptions() {
  const db = requireDb()
  return run(() =>
    db
      .select({ id: amenities.id, name: amenities.name, category: amenities.category })
      .from(amenities)
      .orderBy(asc(amenities.name)),
  )
}

export async function listNeighborhoodOptions() {
  const db = requireDb()
  return run(() =>
    db
      .select({
        id: neighborhoods.id,
        name: neighborhoods.name,
        slug: neighborhoods.slug,
        tagline: neighborhoods.tagline,
      })
      .from(neighborhoods)
      .orderBy(asc(neighborhoods.name)),
  )
}

export async function listAgentOptions() {
  const db = requireDb()
  return run(() =>
    db.query.agents.findMany({
      orderBy: asc(agents.name),
      columns: { id: true, name: true, role: true },
    }),
  )
}

// ── Admin: agents ─────────────────────────────────────────────────────

export async function listAdminAgents() {
  const db = requireDb()
  return run(() =>
    db.query.agents.findMany({
      orderBy: asc(agents.name),
      with: { user: { columns: { id: true, name: true, email: true, role: true } } },
    }),
  )
}

export async function updateAdminAgent(id, patch) {
  const db = requireDb()
  const [existing] = await run(() =>
    db.select({ id: agents.id }).from(agents).where(eq(agents.id, id)),
  )
  if (!existing)
    throw new HttpError("Agent not found", 404, ErrorCodes.AGENT_NOT_FOUND)

  await run(() =>
    db.update(agents).set({ ...patch, updatedAt: new Date() }).where(eq(agents.id, id)),
  )

  const [row] = await run(() =>
    db.query.agents.findMany({
      where: eq(agents.id, id),
      with: { user: { columns: { id: true, name: true, email: true, role: true } } },
    }),
  )
  return row
}

/**
 * Create an agent account (Phase 11): a `users` row with role AGENT plus its
 * linked `agents` profile, so every agent logs into their own portal. Both
 * rows commit atomically; duplicate emails surface as EMAIL_CONFLICT.
 */
export async function createAgentAccount({ name, email, password, phone, ...profile }) {
  const db = requireDb()
  const passwordHash = await hashPassword(password)

  let user
  let agent
  await db.transaction(async (tx) => {
    const [insertedUser] = await run(() =>
      tx
        .insert(users)
        .values({ name, email, passwordHash, role: "AGENT", phone: phone ?? null })
        .returning({ id: users.id }),
    )
    user = insertedUser

    const [insertedAgent] = await run(() =>
      tx
        .insert(agents)
        .values({
          userId: user.id,
          name,
          role: profile.role ?? null,
          languages: profile.languages ?? null,
          experienceYears: profile.experienceYears ?? 0,
          phone: phone ?? null,
          email: email ?? null,
          imageUrl: profile.imageUrl ?? null,
        })
        .returning({ id: agents.id }),
    )
    agent = insertedAgent
  })

  const [fullAgent] = await run(() =>
    db.query.agents.findMany({
      where: eq(agents.id, agent.id),
      with: { user: { columns: { id: true, name: true, email: true, role: true } } },
    }),
  )
  return { user, agent: fullAgent }
}

// ── Admin: users ──────────────────────────────────────────────────────
// Explicit column selection — passwordHash and any token data never leak.

export async function listAdminUsers({ search } = {}) {
  const db = requireDb()
  const where = search
    ? sql`lower(${users.name}) like ${`%${search.toLowerCase()}%`} OR lower(${users.email}) like ${`%${search.toLowerCase()}%`}`
    : undefined
  return Promise.all([
    run(() =>
      db.query.users.findMany({
        where,
        orderBy: desc(users.createdAt),
        with: { agent: { columns: { id: true, name: true } } },
        columns: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
          avatarUrl: true,
          createdAt: true,
        },
      }),
    ),
    run(() => db.select({ n: count() }).from(users).where(where)),
  ]).then(([rows, totals]) => ({ items: rows, total: totals[0]?.n ?? 0 }))
}