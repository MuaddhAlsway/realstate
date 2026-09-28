/**
 * Inquiry / deal serializers (Phase 11) — database rows → API resources.
 *
 * The business object is the inquiry plus its property + agent context, the
 * 1:1 conversation thread, the immutable status history, and (list views)
 * exactly what a grid/inbox needs. Nothing sensitive (password hashes,
 * tokens) is ever reachable here because the service never selects it.
 */

function toIso(value) {
  return value instanceof Date ? value.toISOString() : (value ?? null)
}

function serializePropertyContext(row) {
  if (!row) return null
  const urls = row.images?.map((img) => img.url) ?? []
  const cover = row.images?.find((img) => img.isCover)?.url ?? urls[0] ?? null
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    city: row.city,
    district: row.district ?? null,
    price: row.price,
    currency: row.currency,
    purpose: row.purpose,
    propertyType: row.propertyType,
    status: row.status,
    coverImage: cover,
  }
}

function serializeAgentContext(row) {
  return row
    ? {
        id: row.id,
        name: row.name,
        email: row.email ?? null,
        phone: row.phone ?? null,
        imageUrl: row.imageUrl ?? null,
      }
    : null
}

export function serializeMessage(message) {
  return {
    id: message.id,
    senderId: message.senderId ?? null,
    senderRole: message.senderRole,
    content: message.content,
    readAt: toIso(message.readAt),
    createdAt: toIso(message.createdAt),
    sender: message.sender
      ? {
          id: message.sender.id,
          name: message.sender.name,
          role: message.sender.role,
        }
      : null,
  }
}

const inquiryBase = (row) => ({
  id: row.id,
  status: row.status,
  customerName: row.customerName,
  customerEmail: row.customerEmail,
  customerPhone: row.customerPhone ?? null,
  preferredContactMethod: row.preferredContactMethod,
  viewingDate: row.viewingDate ?? null,
  viewingTime: row.viewingTime ?? null,
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
  completedAt: toIso(row.completedAt),
})

/** Listing-row shape (no thread/history) for inboxes and grids. */
export function serializeInquiryList(row) {
  return {
    ...inquiryBase(row),
    property: serializePropertyContext(row.property),
    agent: serializeAgentContext(row.agent),
    customer: row.user
      ? { id: row.user.id, name: row.user.name, email: row.user.email }
      : null,
  }
}

/** Full resource — detail response after reads and writes. */
export function serializeInquiryDetail(row) {
  return {
    ...inquiryBase(row),
    message: row.message,
    property: serializePropertyContext(row.property),
    agent: serializeAgentContext(row.agent),
    customer: row.user
      ? { id: row.user.id, name: row.user.name, email: row.user.email }
      : null,
    thread: row.conversation?.messages?.map((m) => serializeMessage(m)) ?? [],
    history:
      row.history?.map((h) => ({
        fromStatus: h.fromStatus ?? null,
        toStatus: h.toStatus,
        note: h.note ?? null,
        createdAt: toIso(h.createdAt),
        changedBy: h.changedBy
          ? {
              id: h.changedBy.id,
              name: h.changedBy.name,
              role: h.changedBy.role,
            }
          : null,
      })) ?? [],
  }
}

export function serializeInquiryListMany(rows) {
  return rows.map(serializeInquiryList)
}

export function serializeNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message ?? null,
    read: row.read,
    createdAt: toIso(row.createdAt),
  }
}

export function serializeNotificationList(rows) {
  return rows.map(serializeNotification)
}

/** Closed deals (ADMIN view) — the property it transferred + completion. */
export function serializeDeal(row) {
  return {
    id: row.id,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    customerPhone: row.customerPhone ?? null,
    completedAt: toIso(row.completedAt),
    createdAt: toIso(row.createdAt),
    property: serializePropertyContext(row.property),
    agent: serializeAgentContext(row.agent),
    completedBy: row.completedBy
      ? {
          id: row.completedBy.id,
          name: row.completedBy.name,
          role: row.completedBy.role,
        }
      : null,
  }
}

export function serializeDealList(rows) {
  return rows.map(serializeDeal)
}

export function serializeAgentDashboard(dashboard) {
  return {
    agentId: dashboard.agentId,
    inquiries: dashboard.inquiries,
    deals: dashboard.deals,
    properties: dashboard.properties,
    notifications: dashboard.notifications,
    recentInquiries: (dashboard.recentInquiries ?? []).map(
      serializeInquiryList,
    ),
  }
}
