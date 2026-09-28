import { and, count, desc, eq, inArray } from "drizzle-orm"
import { getDb } from "../db/index.js"
import * as schema from "../db/schema/index.js"
import { HttpError } from "../errors/index.js"
import { ErrorCodes } from "../errors/error-codes.js"
import { translateDatabaseError } from "../errors/pg.js"

/**
 * Inquiry / deal-workflow service (Phase 11).
 *
 * Data model: every customer interest is an `inquiries` row with a 1:1
 * `conversations` thread (`messages`), an immutable `inquiry_status_history`
 * trail, and `notifications` for the account (agent/customer) that must hear
 * about the action.
 *
 * Ownership model (mirrors viewings):
 *  - The property's assigned agent owns the inquiry (agentId inherited from
 *    the property); ADMIN sees everything.
 *  - The signed-in customer owns their own rows (userId); guests submit with
 *    denormalized contact columns and continue via their chosen contact
 *    channel (EMAIL / PHONE / WHATSAPP).
 *  - Status workflow PENDING → IN_PROGRESS → COMPLETED (+ CANCELLED) is the
 *    only legal path; illegal moves throw INVALID_STATUS_TRANSITION (409).
 *
 * Deal completion: setting COMPLETED records completedAt/completedByUserId.
 * When the closing `confirmTransaction` flag is present the property flips
 * (SALE → SOLD, RENT → RENTED) in the same transaction, which also removes
 * it from the public catalog.
 */

const {
  agents,
  users,
  properties,
  inquiries,
  conversations,
  messages,
  notifications,
  inquiryStatusHistory,
} = schema

// PENDING can only be left — it is the creation state and never re-entered.
const STATUS_TRANSITIONS = {
  PENDING: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
}

const TERMINAL_STATUSES = new Set(["COMPLETED", "CANCELLED"])
const INQUIRABLE_STATUSES = new Set(["AVAILABLE", "RESERVED"])

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

/** The user's agent profile id (null for users with no agent link). */
export async function resolveMyAgentId(db, userId) {
  const row = await run(() =>
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true },
      with: { agent: { columns: { id: true } } },
    }),
  )
  return row?.agent?.id ?? null
}

/** Agent user account id for an agent profile (null when unlinked). */
async function agentUserId(db, agentId) {
  if (!agentId) return null
  const row = await run(() =>
    db.query.agents.findFirst({
      where: eq(agents.id, agentId),
      columns: { id: true },
      with: { user: { columns: { id: true } } },
    }),
  )
  return row?.user?.id ?? null
}

function propertyColumns() {
  return {
    columns: {
      id: true,
      title: true,
      slug: true,
      city: true,
      district: true,
      price: true,
      currency: true,
      purpose: true,
      propertyType: true,
      status: true,
    },
    with: {
      images: {
        columns: { id: true, url: true, altText: true, isCover: true },
      },
    },
  }
}

const historyColumns = {
  columns: {
    id: true,
    fromStatus: true,
    toStatus: true,
    note: true,
    createdAt: true,
  },
  with: {
    changedBy: { columns: { id: true, name: true, role: true } },
  },
}

async function findInquiryById(db, id) {
  return run(() =>
    db.query.inquiries.findFirst({
      where: eq(inquiries.id, id),
      with: {
        property: propertyColumns(),
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
        conversation: {
          with: {
            messages: {
              orderBy: (msg, { asc: ascOp }) => [ascOp(msg.createdAt)],
              columns: {
                id: true,
                senderId: true,
                senderRole: true,
                content: true,
                readAt: true,
                createdAt: true,
              },
            },
          },
        },
        history: {
          ...historyColumns,
          orderBy: (h, { asc: ascOp }) => [ascOp(h.createdAt)],
        },
      },
    }),
  )
}

/**
 * The caller's claim on an inquiry row. Returns true when the caller may
 * read/act on it: ADMIN everything, AGENT their assigned inbox, USER their
 * own rows.
 */
async function scopeWhere(db, userId, role) {
  if (role === "ADMIN") return undefined
  if (role === "AGENT") {
    const myAgentId = await resolveMyAgentId(db, userId)
    if (!myAgentId)
      throw new HttpError(
        "Your account has no agent profile",
        403,
        ErrorCodes.FORBIDDEN,
      )
    return eq(inquiries.agentId, myAgentId)
  }
  return eq(inquiries.userId, userId)
}

async function assertAccess(db, inquiry, userId, role) {
  if (role === "ADMIN") return
  if (role === "AGENT") {
    const myAgentId = await resolveMyAgentId(db, userId)
    if (myAgentId != null && inquiry.agentId === myAgentId) return
  }
  if (inquiry.userId === userId) return
  throw new HttpError(
    "You are not authorized to access this inquiry",
    403,
    ErrorCodes.FORBIDDEN,
  )
}

// ── Creation (public, optional auth) ─────────────────────────────────

export async function createInquiry(input, { userId, role } = {}) {
  const db = requireDb()
  const property = await run(() =>
    db.query.properties.findFirst({
      where: eq(properties.id, input.propertyId),
      columns: {
        id: true,
        title: true,
        status: true,
        purpose: true,
        agentId: true,
      },
    }),
  )
  if (!property)
    throw new HttpError(
      "This property does not exist",
      404,
      ErrorCodes.PROPERTY_NOT_FOUND,
    )
  if (!INQUIRABLE_STATUSES.has(property.status)) {
    throw new HttpError(
      "This property is no longer available for inquiries",
      403,
      ErrorCodes.FORBIDDEN,
    )
  }

  let createdId
  await db.transaction(async (tx) => {
    const [inserted] = await run(() =>
      tx.insert(inquiries)
        .values({
          propertyId: property.id,
          agentId: property.agentId,
          userId: userId ?? null,
          customerName: input.name,
          customerEmail: input.email,
          customerPhone: input.phone ?? null,
          message: input.message,
          preferredContactMethod: input.preferredContactMethod ?? "EMAIL",
          viewingDate: input.viewingDate ?? null,
          viewingTime: input.viewingTime ?? null,
        })
        .returning({ id: inquiries.id }),
    )
    createdId = inserted.id

    await run(() => tx.insert(conversations).values({ inquiryId: createdId }))
    await run(() =>
      tx.insert(inquiryStatusHistory).values({
        inquiryId: createdId,
        fromStatus: null,
        toStatus: "PENDING",
        changedByUserId: userId ?? null,
      }),
    )

    // Notify the assigned agent's account (when one exists).
    const recipientId = await agentUserId(tx, property.agentId)
    if (recipientId) {
      await run(() =>
        tx.insert(notifications).values({
          userId: recipientId,
          inquiryId: createdId,
          type: "INQUIRY",
          title: "New inquiry received",
          message: `${input.name} is interested in ${property.title}`,
        }),
      )
    }
  })

  return findInquiryById(db, createdId)
}

// ── Listing ─────────────────────────────────────────────────────────

export async function listMyInquiries(userId, role, query = {}) {
  const db = requireDb()
  const page = query.page ?? 1
  const limit = query.limit ?? 20
  const where = query.status
    ? and(
        await scopeWhere(db, userId, role),
        eq(inquiries.status, query.status),
      )
    : await scopeWhere(db, userId, role)

  const [rows, totals] = await Promise.all([
    run(() =>
      db.query.inquiries.findMany({
        where,
        orderBy: desc(inquiries.createdAt),
        limit,
        offset: (page - 1) * limit,
        with: {
          property: propertyColumns(),
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
        },
      }),
    ),
    run(() => db.select({ n: count() }).from(inquiries).where(where)),
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

export async function getInquiry(id, userId, role) {
  const db = requireDb()
  const row = await findInquiryById(db, id)
  if (!row)
    throw new HttpError(
      "This inquiry does not exist",
      404,
      ErrorCodes.INQUIRY_NOT_FOUND,
    )
  await assertAccess(db, row, userId, role)
  return row
}

// ── Conversation / messages ─────────────────────────────────────────

async function conversationFor(db, inquiryId, userId, role) {
  const inquiry = await run(() =>
    db.query.inquiries.findFirst({
      where: eq(inquiries.id, inquiryId),
      columns: { id: true, userId: true, agentId: true },
      with: { conversation: { columns: { id: true } } },
    }),
  )
  if (!inquiry)
    throw new HttpError(
      "This inquiry does not exist",
      404,
      ErrorCodes.INQUIRY_NOT_FOUND,
    )
  await assertAccess(db, inquiry, userId, role)
  if (!inquiry.conversation)
    throw new HttpError(
      "This inquiry has no conversation",
      404,
      ErrorCodes.CONVERSATION_NOT_FOUND,
    )
  return inquiry
}

export async function listMessages(inquiryId, userId, role) {
  const db = requireDb()
  const inquiry = await conversationFor(db, inquiryId, userId, role)
  return run(() =>
    db.query.messages.findMany({
      where: eq(messages.conversationId, inquiry.conversation.id),
      orderBy: ascMessageOrder,
      columns: {
        id: true,
        senderId: true,
        senderRole: true,
        content: true,
        readAt: true,
        createdAt: true,
      },
      with: { sender: { columns: { id: true, name: true, role: true } } },
    }),
  )
}

const ascMessageOrder = (msg) => [msg.createdAt]

export async function sendMessage(inquiryId, userId, role, input) {
  const db = requireDb()
  const inquiry = await conversationFor(db, inquiryId, userId, role)
  const senderRole =
    role === "ADMIN" ? "ADMIN" : role === "AGENT" ? "AGENT" : "CUSTOMER"

  const message = await run(() =>
    db.insert(messages)
      .values({
        conversationId: inquiry.conversation.id,
        senderId: userId,
        senderRole,
        content: input.content,
      })
      .returning({ id: messages.id }),
  )

  // A customer's message pings the agent; staff replies are visible to the
  // customer on their dashboard without needing a notification.
  if (senderRole === "CUSTOMER") {
    const recipientId = await agentUserId(db, inquiry.agentId)
    if (recipientId) {
      await run(() =>
        db.insert(notifications).values({
          userId: recipientId,
          inquiryId: inquiryId,
          type: "MESSAGE",
          title: "New message on an inquiry",
          message: input.content.slice(0, 120),
        }),
      )
    }
  }

  return run(() =>
    db.query.messages.findFirst({
      where: eq(messages.id, message[0].id),
      with: { sender: { columns: { id: true, name: true, role: true } } },
    }),
  )
}

// ── Status workflow ─────────────────────────────────────────────────

export async function updateInquiryStatus(
  id,
  userId,
  role,
  { toStatus, note, confirmTransaction },
) {
  const db = requireDb()
  const row = await run(() =>
    db.query.inquiries.findFirst({
      where: eq(inquiries.id, id),
      columns: {
        id: true,
        userId: true,
        agentId: true,
        propertyId: true,
        status: true,
        customerName: true,
      },
    }),
  )
  if (!row)
    throw new HttpError(
      "This inquiry does not exist",
      404,
      ErrorCodes.INQUIRY_NOT_FOUND,
    )

  // A signed-in customer may only cancel their own PENDING inquiry.
  if (role !== "ADMIN" && role !== "AGENT") {
    if (row.userId !== userId) {
      throw new HttpError(
        "You are not authorized to update this inquiry",
        403,
        ErrorCodes.FORBIDDEN,
      )
    }
    if (toStatus !== "CANCELLED") {
      throw new HttpError(
        "A customer can only cancel their own inquiry",
        403,
        ErrorCodes.FORBIDDEN,
      )
    }
    if (row.status !== "PENDING") {
      throw new HttpError(
        "Only a PENDING inquiry can be cancelled",
        403,
        ErrorCodes.FORBIDDEN,
      )
    }
  } else {
    await assertAccess(db, row, userId, role)
  }

  if (toStatus === "PENDING") {
    throw new HttpError(
      "PENDING is the initial state and cannot be set via update",
      409,
      ErrorCodes.INVALID_STATUS_TRANSITION,
    )
  }
  if (!STATUS_TRANSITIONS[row.status]?.includes(toStatus)) {
    throw new HttpError(
      `Invalid status transition from ${row.status} to ${toStatus}`,
      409,
      ErrorCodes.INVALID_STATUS_TRANSITION,
    )
  }

  const staffRole = role === "AGENT" || role === "ADMIN"
  const nextPropertyStatus =
    staffRole && toStatus === "COMPLETED" && confirmTransaction
      ? await resolveFinalPropertyStatus(db, row.propertyId)
      : null

  await db.transaction(async (tx) => {
    await run(() =>
      tx.update(inquiries)
        .set({
          status: toStatus,
          completedAt: toStatus === "COMPLETED" ? new Date() : null,
          completedByUserId: toStatus === "COMPLETED" ? userId : null,
          // COMPLETED is terminal, so clearing this on CANCELLED is safe.
          updatedAt: new Date(),
        })
        .where(eq(inquiries.id, row.id)),
    )
    await run(() =>
      tx.insert(inquiryStatusHistory).values({
        inquiryId: row.id,
        fromStatus: row.status,
        toStatus,
        changedByUserId: userId,
        note: note ?? null,
      }),
    )
    if (nextPropertyStatus) {
      await run(() =>
        tx.update(properties)
          .set({ status: nextPropertyStatus, updatedAt: new Date() })
          .where(eq(properties.id, row.propertyId)),
      )
    }
    if (toStatus === "COMPLETED") {
      const recipientId = await agentUserId(tx, row.agentId)
      await run(() =>
        tx.insert(notifications).values({
          userId: recipientId ?? userId,
          inquiryId: row.id,
          type: "DEAL",
          title: "Deal completed",
          message: `The inquiry from ${row.customerName} was completed${
            nextPropertyStatus ? ` — property marked ${nextPropertyStatus}` : ""
          }`,
        }),
      )
    }
  })

  return findInquiryById(db, row.id)
}

/** The property's post-deal status (SALE → SOLD, RENT → RENTED). */
async function resolveFinalPropertyStatus(db, propertyId) {
  const property = await run(() =>
    db.query.properties.findFirst({
      where: eq(properties.id, propertyId),
      columns: { id: true, purpose: true, status: true },
    }),
  )
  if (!property || property.status !== "AVAILABLE") return null
  return property.purpose === "RENT" ? "RENTED" : "SOLD"
}

// ── Notifications ───────────────────────────────────────────────────

export async function listNotifications(userId, query = {}) {
  const db = requireDb()
  const page = query.page ?? 1
  const limit = query.limit ?? 20

  const [rows, totals] = await Promise.all([
    run(() =>
      db.query.notifications.findMany({
        where: eq(notifications.userId, userId),
        orderBy: desc(notifications.createdAt),
        limit,
        offset: (page - 1) * limit,
        columns: {
          id: true,
          type: true,
          title: true,
          message: true,
          read: true,
          createdAt: true,
        },
      }),
    ),
    run(() =>
      db.select({ n: count() })
        .from(notifications)
        .where(eq(notifications.userId, userId)),
    ),
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

export async function markNotificationsRead(userId, { ids, all } = {}) {
  const db = requireDb()
  if (ids?.length) {
    await run(() =>
      db.update(notifications)
        .set({ read: true })
        .where(
          and(
            eq(notifications.userId, userId),
            ids.length
              ? inArray(notifications.id, ids)
              : eq(notifications.read, false),
          ),
        ),
    )
  } else if (all || (!ids && !all)) {
    await run(() =>
      db.update(notifications)
        .set({ read: true })
        .where(
          and(eq(notifications.userId, userId), eq(notifications.read, false)),
        ),
    )
  }
  return listNotifications(userId, { page: 1, limit: 50 })
}

// ── Agent portal ────────────────────────────────────────────────────

export async function agentDashboard(userId) {
  const db = requireDb()
  const myAgentId = await resolveMyAgentId(db, userId)
  if (!myAgentId)
    throw new HttpError(
      "Your account has no agent profile",
      403,
      ErrorCodes.FORBIDDEN,
    )

  const countInquiries = (status) => () =>
    run(() =>
      db.select({ n: count() })
        .from(inquiries)
        .where(
          status
            ? and(
                eq(inquiries.agentId, myAgentId),
                eq(inquiries.status, status),
              )
            : eq(inquiries.agentId, myAgentId),
        ),
    )
  const countProperties = () =>
    run(() =>
      db.select({ n: count() })
        .from(properties)
        .where(eq(properties.agentId, myAgentId)),
    )
  const unreadNotifications = () =>
    run(() =>
      db.select({ n: count() })
        .from(notifications)
        .where(
          and(eq(notifications.userId, userId), eq(notifications.read, false)),
        ),
    )

  const [
    pending,
    inProgress,
    completed,
    cancelled,
    totalInquiries,
    totalProperties,
    unread,
    recent,
  ] = await Promise.all([
    countInquiries("PENDING")(),
    countInquiries("IN_PROGRESS")(),
    countInquiries("COMPLETED")(),
    countInquiries("CANCELLED")(),
    countInquiries()(),
    countProperties(),
    unreadNotifications(),
    run(() =>
      db.query.inquiries.findMany({
        where: eq(inquiries.agentId, myAgentId),
        orderBy: desc(inquiries.createdAt),
        limit: 5,
        with: {
          property: propertyColumns(),
        },
      }),
    ),
  ])

  // countInquiries()() — no status filter, total row count.
  const total = totalInquiries[0]?.n ?? 0
  return {
    agentId: myAgentId,
    inquiries: {
      total,
      byStatus: {
        PENDING: pending[0]?.n ?? 0,
        IN_PROGRESS: inProgress[0]?.n ?? 0,
        COMPLETED: completed[0]?.n ?? 0,
        CANCELLED: cancelled[0]?.n ?? 0,
      },
    },
    deals: { completed: completed[0]?.n ?? 0 },
    properties: { total: totalProperties[0]?.n ?? 0 },
    notifications: { unread: unread[0]?.n ?? 0 },
    recentInquiries: recent,
  }
}

export async function listAgentProperties(userId, query = {}) {
  const db = requireDb()
  const myAgentId = await resolveMyAgentId(db, userId)
  if (!myAgentId)
    throw new HttpError(
      "Your account has no agent profile",
      403,
      ErrorCodes.FORBIDDEN,
    )

  const page = query.page ?? 1
  const limit = query.limit ?? 20
  const where = eq(properties.agentId, myAgentId)

  const [rows, totals] = await Promise.all([
    run(() =>
      db.query.properties.findMany({
        where,
        orderBy: desc(properties.createdAt),
        limit,
        offset: (page - 1) * limit,
        with: {
          images: { columns: { id: true, url: true, isCover: true } },
          neighborhood: { columns: { id: true, name: true } },
        },
      }),
    ),
    run(() => db.select({ n: count() }).from(properties).where(where)),
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

// ── Admin reads (inquiries / deals) ─────────────────────────────────

export async function listAdminInquiries(query = {}) {
  const db = requireDb()
  const page = query.page ?? 1
  const limit = query.limit ?? 20
  const where = query.status ? eq(inquiries.status, query.status) : undefined

  const [rows, totals] = await Promise.all([
    run(() =>
      db.query.inquiries.findMany({
        where,
        orderBy: desc(inquiries.createdAt),
        limit,
        offset: (page - 1) * limit,
        with: {
          property: propertyColumns(),
          agent: {
            columns: { id: true, name: true, email: true, phone: true },
          },
          user: { columns: { id: true, name: true, email: true } },
        },
      }),
    ),
    run(() => db.select({ n: count() }).from(inquiries).where(where)),
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

export async function listDeals(query = {}) {
  const db = requireDb()
  const page = query.page ?? 1
  const limit = query.limit ?? 20
  const where = eq(inquiries.status, "COMPLETED")

  const [rows, totals] = await Promise.all([
    run(() =>
      db.query.inquiries.findMany({
        where,
        orderBy: desc(inquiries.completedAt),
        limit,
        offset: (page - 1) * limit,
        columns: {
          id: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          status: true,
          completedAt: true,
          createdAt: true,
        },
        with: {
          property: propertyColumns(),
          agent: {
            columns: { id: true, name: true, email: true, phone: true },
          },
          completedBy: { columns: { id: true, name: true, role: true } },
        },
      }),
    ),
    run(() => db.select({ n: count() }).from(inquiries).where(where)),
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
