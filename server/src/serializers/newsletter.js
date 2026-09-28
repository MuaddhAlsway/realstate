/**
 * Newsletter / email serializers (Phase 10) — database rows → API resources.
 *
 * Subscribers expose the plain email + status (never the token or its hash —
 * the raw token only ever travels inside the emailed unsubscribe link).
 * Deliveries expose the honest SENT/FAILED outcome for the admin history.
 */

function toIso(value) {
  return value instanceof Date ? value.toISOString() : (value ?? null)
}

export function serializeSubscriber(row) {
  return {
    id: row.id,
    email: row.email,
    status: row.status,
    subscribedAt: toIso(row.subscribedAt),
    unsubscribedAt: toIso(row.unsubscribedAt),
    createdAt: toIso(row.createdAt),
  }
}

export function serializeSubscriberList(rows) {
  return rows.map(serializeSubscriber)
}

export function serializeCampaign(row) {
  const deliveries = row.deliveries ?? []
  const sent = deliveries.filter((d) => d.status === "SENT").length
  const failed = deliveries.filter((d) => d.status === "FAILED").length
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    status: row.status,
    createdBy: row.createdBy
      ? { id: row.createdBy.id, name: row.createdBy.name }
      : null,
    sentAt: toIso(row.sentAt),
    failedReason: row.failedReason ?? null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    stats: {
      total: deliveries.length,
      sent,
      failed,
    },
  }
}

export function serializeCampaignList(rows) {
  return rows.map(serializeCampaign)
}

export function serializeDelivery(row) {
  return {
    id: row.id,
    campaignId: row.campaignId ?? null,
    kind: row.kind,
    recipientEmail: row.recipientEmail,
    subject: row.subject ?? null,
    status: row.status,
    providerMessageId: row.providerMessageId ?? null,
    errorMessage: row.errorMessage ?? null,
    sentAt: toIso(row.sentAt),
    createdAt: toIso(row.createdAt),
  }
}

export function serializeDeliveryList(rows) {
  return rows.map(serializeDelivery)
}

export function serializeNewsletterStats(stats) {
  return {
    subscribers: {
      total: stats.subscribers.total,
      active: stats.subscribers.active,
      unsubscribed: stats.subscribers.unsubscribed,
    },
    emails: {
      sent: stats.emails.sent,
      failed: stats.emails.failed,
    },
    recentSubscribers: stats.recentSubscribers.map(serializeSubscriber),
  }
}

export function serializeAgentEmail(row) {
  return {
    id: row.id,
    leadId: row.inquiryId ?? null,
    agentId: row.agentId ?? null,
    recipientEmail: row.recipientEmail,
    subject: row.subject,
    body: row.body,
    status: row.status,
    errorMessage: row.errorMessage ?? null,
    providerMessageId: row.providerMessageId ?? null,
    sentAt: toIso(row.sentAt),
    createdAt: toIso(row.createdAt),
  }
}

export function serializeAgentEmailList(rows) {
  return rows.map(serializeAgentEmail)
}