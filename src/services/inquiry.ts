import { http } from "./http"

/**
 * Phase 11 — inquiry / client-management services.
 *
 * Mirrors server/src/serializers/inquiries.js. The customer surface lives
 * under /api/v1/me + the public property route; the agent portal under
 * /api/v1/agent. Both are remote-first (there is no mock layer): the pages
 * only render when the app is wired to the running backend (REMOTE).
 */

// ── Wire types (mirror server/src/serializers/*.js) ────────────────────

export type InquiryStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
export type NotificationType = "INQUIRY" | "MESSAGE" | "DEAL" | "SYSTEM"
export type MessageSenderRole = "CUSTOMER" | "AGENT" | "ADMIN" | "SYSTEM"

export interface InquiryProperty {
  id: string
  title: string
  slug: string
  city: string
  district: string | null
  price: number
  currency: string
  purpose: "SALE" | "RENT"
  propertyType: string
  status: string
  coverImage: string | null
}

export interface InquiryAgent {
  id: string
  name: string
  email: string | null
  phone: string | null
  imageUrl: string | null
}

export interface InquiryCustomer {
  id: string
  name: string
  email: string
}

export interface InquiryListItem {
  id: string
  status: InquiryStatus
  customerName: string
  customerEmail: string
  customerPhone: string | null
  preferredContactMethod: string
  viewingDate: string | null
  viewingTime: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  property?: InquiryProperty | null
  agent?: InquiryAgent | null
  customer?: InquiryCustomer | null
}

export interface InquiryMessage {
  id: string
  senderId: string | null
  senderRole: MessageSenderRole
  content: string
  readAt: string | null
  createdAt: string
  sender?: { id: string, name: string, role: string } | null
}

export interface HistoryEntry {
  fromStatus: string | null
  toStatus: string
  note: string | null
  createdAt: string
  changedBy: { id: string, name: string, role: string } | null
}

export interface InquiryDetail extends InquiryListItem {
  message: string
  thread: InquiryMessage[]
  history: HistoryEntry[]
}

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  message: string | null
  read: boolean
  createdAt: string
}

export interface AgentDashboard {
  agentId: string
  inquiries: { total: number, byStatus: Record<string, number> }
  deals: number
  properties: number
  notifications: { total: number, unread: number }
  recentInquiries: InquiryListItem[]
}

export interface DealItem {
  id: string
  customerName: string
  customerEmail: string
  customerPhone: string | null
  completedAt: string
  createdAt: string
  property?: InquiryProperty | null
  agent?: InquiryAgent | null
  completedBy?: { id: string, name: string, role: string } | null
}

export interface AgentEmail {
  id: string
  leadId: string | null
  agentId: string | null
  recipientEmail: string
  subject: string
  body: string
  status: "SENT" | "FAILED"
  errorMessage: string | null
  providerMessageId: string | null
  sentAt: string | null
  createdAt: string | null
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  totalPages: number
}

export interface CreateInquiryBody {
  name: string
  email: string
  phone?: string
  message: string
  preferredContactMethod?: "EMAIL" | "PHONE" | "WHATSAPP"
  viewingDate?: string
  viewingTime?: string
}

function pageQuery(params: { status?: InquiryStatus, page?: number } = {}): string {
  const qs = new URLSearchParams()
  if (params.status) qs.set("status", params.status)
  qs.set("page", String(params.page ?? 1))
  qs.set("limit", "50")
  const s = qs.toString()
  return s ? `?${s}` : ""
}

async function envelope<T>(path: string): Promise<Paginated<T>> {
  const { data, meta } = await http.getEnvelope<T[]>(path)
  return {
    items: data,
    total: Number(meta?.total ?? 0),
    page: Number(meta?.page ?? 1),
    totalPages: Number(meta?.totalPages ?? 0),
  }
}

const ROOT = "/api/v1"

export const inquiryApi = {
  // ── Public property inquiry ──────────────────────────────────────────
  create: (propertyId: string, body: CreateInquiryBody): Promise<InquiryDetail> =>
    http.post<InquiryDetail>(
      `${ROOT}/properties/${encodeURIComponent(propertyId)}/inquiries`,
      body,
    ),

  // ── Customer /me surface ─────────────────────────────────────────────
  myInquiries: async (params?: { status?: InquiryStatus, page?: number }): Promise<Paginated<InquiryListItem>> =>
    envelope(`${ROOT}/me/inquiries${pageQuery(params)}`),

  myInquiry: (id: string): Promise<InquiryDetail> =>
    http.get<InquiryDetail>(`${ROOT}/me/inquiries/${encodeURIComponent(id)}`),

  myMessages: (id: string): Promise<InquiryMessage[]> =>
    http.get<InquiryMessage[]>(
      `${ROOT}/me/inquiries/${encodeURIComponent(id)}/messages`,
    ),

  sendMyMessage: (id: string, content: string): Promise<InquiryMessage> =>
    http.post<InquiryMessage>(
      `${ROOT}/me/inquiries/${encodeURIComponent(id)}/messages`,
      { content },
    ),

  updateMyStatus: (id: string, body: { toStatus: InquiryStatus, note?: string }): Promise<InquiryDetail> =>
    http.patch<InquiryDetail>(
      `${ROOT}/me/inquiries/${encodeURIComponent(id)}/status`,
      body,
    ),

  myNotifications: async (params?: { page?: number }): Promise<Paginated<NotificationItem>> =>
    envelope(`${ROOT}/me/notifications${pageQuery(params)}`),

  markMyNotificationsRead: (body: { ids?: string[], all?: boolean }): Promise<NotificationItem[]> =>
    http.patch<NotificationItem[]>(
      `${ROOT}/me/notifications/read`,
      body,
    ),
}

export const agentApi = {
  dashboard: (): Promise<AgentDashboard> =>
    http.get<AgentDashboard>(`${ROOT}/agent/dashboard`),

  properties: (): Promise<unknown[]> =>
    http.get<unknown[]>(`${ROOT}/agent/properties`),

  inquiries: async (params?: { status?: InquiryStatus, page?: number }): Promise<Paginated<InquiryListItem>> =>
    envelope(`${ROOT}/agent/inquiries${pageQuery(params)}`),

  inquiry: (id: string): Promise<InquiryDetail> =>
    http.get<InquiryDetail>(`${ROOT}/agent/inquiries/${encodeURIComponent(id)}`),

  messages: (id: string): Promise<InquiryMessage[]> =>
    http.get<InquiryMessage[]>(
      `${ROOT}/agent/inquiries/${encodeURIComponent(id)}/messages`,
    ),

  sendMessage: (id: string, content: string): Promise<InquiryMessage> =>
    http.post<InquiryMessage>(
      `${ROOT}/agent/inquiries/${encodeURIComponent(id)}/messages`,
      { content },
    ),

  updateStatus: (
    id: string,
    body: { toStatus: InquiryStatus, note?: string, confirmTransaction?: boolean },
  ): Promise<InquiryDetail> =>
    http.patch<InquiryDetail>(
      `${ROOT}/agent/inquiries/${encodeURIComponent(id)}/status`,
      body,
    ),

  sendLeadEmail: (id: string, body: { subject: string, body: string }): Promise<AgentEmail> =>
    http.post<AgentEmail>(
      `${ROOT}/agent/inquiries/${encodeURIComponent(id)}/email`,
      body,
    ),

  leadEmails: (id: string): Promise<AgentEmail[]> =>
    http.get<AgentEmail[]>(
      `${ROOT}/agent/inquiries/${encodeURIComponent(id)}/emails`,
    ),

  notifications: async (params?: { page?: number }): Promise<Paginated<NotificationItem>> =>
    envelope(`${ROOT}/agent/notifications${pageQuery(params)}`),

  markNotificationsRead: (body: { ids?: string[], all?: boolean }): Promise<NotificationItem[]> =>
    http.patch<NotificationItem[]>(
      `${ROOT}/agent/notifications/read`,
      body,
    ),
}

export const INQUIRY_STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
]

export function inquiryStatusLabel(status: string): string {
  switch (status) {
    case "PENDING": return "Pending"
    case "IN_PROGRESS": return "In Progress"
    case "COMPLETED": return "Completed"
    case "CANCELLED": return "Cancelled"
    default: return status
  }
}

export function inquiryStatusTone(
  status: string,
): "gold" | "green" | "red" | "neutral" {
  if (status === "PENDING") return "gold"
  if (status === "IN_PROGRESS") return "neutral"
  if (status === "COMPLETED") return "green"
  if (status === "CANCELLED") return "red"
  return "neutral"
}