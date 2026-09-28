import { http, API_BASE } from "./http"

/**
 * Phase 10 — newsletter / email services.
 *
 * The public surface (subscribe + unsubscribe) mirrors `api.ts`: the mock
 * layer serves `/api/*` paths, so ROOT collapses to `/api` inside the Figma
 * Make preview and to `/api/v1` once a REMOTE backend is wired. The admin
 * surface rides the /api/v1/admin RBAC router and is remote-only, like the
 * other admin services.
 */

// ── Wire types (mirror server/src/serializers/newsletter.js) ────────────

export type SubscriberStatus = "ACTIVE" | "UNSUBSCRIBED"
export type CampaignStatus = "DRAFT" | "SENDING" | "SENT" | "FAILED"
export type DeliveryKind = "WELCOME" | "CAMPAIGN" | "AGENT"
export type DeliveryStatus = "QUEUED" | "SENT" | "FAILED"

export interface NewsletterSubscriber {
  id: string
  email: string
  status: SubscriberStatus
  subscribedAt: string | null
  unsubscribedAt: string | null
  createdAt: string | null
}

export interface NewsletterCampaign {
  id: string
  name: string
  subject: string
  htmlContent: string
  textContent: string
  status: CampaignStatus
  createdBy: { id: string, name: string } | null
  sentAt: string | null
  failedReason: string | null
  createdAt: string | null
  updatedAt: string | null
  stats: { total: number, sent: number, failed: number }
}

export interface NewsletterDelivery {
  id: string
  campaignId: string | null
  kind: DeliveryKind
  recipientEmail: string
  subject: string | null
  status: DeliveryStatus
  providerMessageId: string | null
  errorMessage: string | null
  sentAt: string | null
  createdAt: string | null
}

export interface NewsletterStats {
  subscribers: { total: number, active: number, unsubscribed: number }
  emails: { sent: number, failed: number }
  recentSubscribers: NewsletterSubscriber[]
}

export interface SendCampaignResult {
  sent: number
  failed: number
  total: number
  status: CampaignStatus
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  totalPages: number
}

// ── Public API (mock-able) ──────────────────────────────────────────────

const PUBLIC_ROOT = API_BASE ? "/api/v1" : "/api"

export const publicNewsletterApi = {
  subscribe: (email: string): Promise<NewsletterSubscriber> =>
    http.post<NewsletterSubscriber>(`${PUBLIC_ROOT}/newsletter/subscribe`, { email }),

  unsubscribe: (token: string): Promise<NewsletterSubscriber> =>
    http.get<NewsletterSubscriber>(
      `${PUBLIC_ROOT}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`,
    ),
}

// ── Admin API (remote-only) ─────────────────────────────────────────────

const ROOT = "/api/v1"

function pageQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") qs.set(key, String(value))
  }
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

export const newsletterAdminApi = {
  subscribers: async (params: {
    q?: string, status?: SubscriberStatus, page?: number,
  } = {}): Promise<Paginated<NewsletterSubscriber>> =>
    envelope(
      `${ROOT}/admin/newsletter/subscribers${pageQuery({
        q: params.q,
        status: params.status,
        page: params.page ?? 1,
        limit: 50,
      })}`,
    ),

  stats: (): Promise<NewsletterStats> =>
    http.get<NewsletterStats>(`${ROOT}/admin/newsletter/stats`),

  campaigns: async (params: { page?: number } = {}): Promise<Paginated<NewsletterCampaign>> =>
    envelope(
      `${ROOT}/admin/newsletter/campaigns${pageQuery({
        page: params.page ?? 1,
        limit: 50,
      })}`,
    ),

  createCampaign: (input: {
    name: string, subject: string, htmlContent: string, textContent?: string,
  }): Promise<NewsletterCampaign> =>
    http.post<NewsletterCampaign>(`${ROOT}/admin/newsletter/campaigns`, input),

  sendTest: (id: string, testEmails: string[]): Promise<NewsletterDelivery[]> =>
    http.post<NewsletterDelivery[]>(
      `${ROOT}/admin/newsletter/campaigns/${encodeURIComponent(id)}/send-test`,
      { testEmails },
    ),

  sendCampaign: (id: string): Promise<SendCampaignResult> =>
    http.post<SendCampaignResult>(
      `${ROOT}/admin/newsletter/campaigns/${encodeURIComponent(id)}/send`,
      {},
    ),

  deliveries: async (params: {
    kind?: DeliveryKind, status?: DeliveryStatus, page?: number,
  } = {}): Promise<Paginated<NewsletterDelivery>> =>
    envelope(
      `${ROOT}/admin/newsletter/history${pageQuery({
        kind: params.kind,
        status: params.status,
        page: params.page ?? 1,
        limit: 50,
      })}`,
    ),
}