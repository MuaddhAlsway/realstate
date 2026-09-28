import { http } from "./http"

/**
 * Admin + CMS services (Phase 09). Remote-only by nature: these endpoints
 * live behind the /api/v1/admin RBAC router, so there is no mock layer.
 * The caller must hold an ADMIN session; the server enforces the role gate
 * regardless of what the UI renders.
 */

// ── Wire types (mirror server/src/serializers/*.js) ─────────────────────

export type PropertyStatus = "AVAILABLE" | "PENDING" | "SOLD" | "RENTED" | "DRAFT"
export type PropertyPurpose = "SALE" | "RENT"
export type PropertyType = "VILLA" | "APARTMENT" | "PENTHOUSE" | "DUPLEX"
export type ViewingStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED"
export type UserRole = "USER" | "AGENT" | "ADMIN"
export type InquiryStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
export type EmailCampaignStatus = "DRAFT" | "SENDING" | "SENT" | "FAILED"

export interface DashboardNewsletterSection {
  subscribers: {
    total: number
    active: number
    unsubscribed: number
  }
  deliveries: {
    total: number
    sent: number
    failed: number
  }
  recentCampaigns: Array<{
    id: string
    subject: string
    status: EmailCampaignStatus
    sentAt: string | null
    createdAt: string
  }>
}

export interface DashboardData {
  properties: {
    total: number
    byStatus: Record<PropertyStatus, number>
    byPurpose: Record<PropertyPurpose, number>
    featured: number
  }
  users: number
  agents: number
  neighborhoods: number
  amenities: number
  favorites: number
  viewingRequests: {
    total: number
    byStatus: Record<ViewingStatus, number>
  }
  inquiries: {
    total: number
    byStatus: Record<InquiryStatus, number>
  }
  deals: number
  emailProvider: string
  newsletter: DashboardNewsletterSection
}

export interface AdminPropertySummary {
  id: string
  title: string
  slug: string
  purpose: PropertyPurpose
  propertyType: PropertyType
  status: PropertyStatus
  price: number
  currency: string
  bedrooms: number
  bathrooms: number
  area: number | null
  city: string
  district: string | null
  featured: boolean
  coverImage: string | null
  imageCount: number
  neighborhood: { id: string, name: string, slug: string } | null
  agent: { id: string, name: string } | null
  createdAt: string
}

export interface AdminImageMeta {
  id: string
  url: string
  publicId: string | null
  altText: string | null
  displayOrder: number
  isCover: boolean
}

export interface AdminPropertyDetail {
  id: string
  title: string
  slug: string
  description: string | null
  purpose: PropertyPurpose
  propertyType: PropertyType
  status: PropertyStatus
  price: number
  currency: string
  bedrooms: number
  bathrooms: number
  area: number | null
  city: string
  district: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  featured: boolean
  images: AdminImageMeta[]
  amenities: string[]
  neighborhood: {
    id: string, name: string, slug: string,
    tagline: string | null, description: string | null, imageUrl: string | null
  } | null
  agent: {
    id: string, name: string, role: string | null, email: string | null,
    phone: string | null, imageUrl: string | null, experienceYears: number
  } | null
}

/** Editor payload for create/update (matches the extended property schema). */
export interface AdminPropertyInput {
  title: string
  slug: string
  propertyType: PropertyType
  price: number
  city: string
  description?: string | null
  purpose?: PropertyPurpose
  status?: PropertyStatus
  currency?: string
  bedrooms?: number
  bathrooms?: number
  area?: number | null
  district?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  featured?: boolean
  agentId?: string | null
  neighborhoodId?: string | null
  images?: AdminImageInput[]
  amenities?: string[]
}

export interface AdminImageInput {
  // Existing row id — round-tripped so the server preserves unchanged rows
  // (Phase 10 diff-based sync) instead of replacing them.
  id?: string
  url: string
  // Provider asset id for media-uploaded images (null for legacy URLs).
  publicId?: string | null
  altText?: string | null
  displayOrder?: number
  isCover?: boolean
}

export interface AdminAgent {
  id: string
  name: string
  role: string | null
  languages: string | null
  experienceYears: number
  phone: string | null
  email: string | null
  imageUrl: string | null
  user: { id: string, name: string, email: string, role: UserRole } | null
  createdAt: string
}

export interface AdminUser {
  id: string
  name: string
  email: string
  role: UserRole
  phone: string | null
  avatarUrl: string | null
  agent: { id: string, name: string } | null
  createdAt: string
}

export interface AgentOption {
  id: string
  name: string
  role: string | null
}

export interface AmenityOption {
  id: string
  name: string
  category: string | null
}

export interface NeighborhoodOption {
  id: string
  name: string
  slug: string
  tagline: string | null
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  totalPages: number
}

export interface AdminViewing {
  id: string
  property: {
    id: string, title: string, city: string, district: string | null,
    price: number, currency: string, imageCount: number, coverImage: string | null
  } | null
  agent: {
    id: string, name: string, email: string | null, phone: string | null, imageUrl: string | null
  } | null
  requester: { id: string, name: string, email: string } | null
  date: string
  time: string | null
  message: string | null
  status: ViewingStatus
  createdAt: string
}

export interface AdminInquiry {
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
  property: {
    id: string, title: string, price: number, currency: string,
    city: string, district: string | null, purpose: PropertyPurpose, status: PropertyStatus
  } | null
  agent: { id: string, name: string, email: string | null } | null
  customer: { id: string, name: string, email: string } | null
}

export interface AdminDeal {
  id: string
  customerName: string
  customerEmail: string
  customerPhone: string | null
  completedAt: string
  createdAt: string
  property: {
    id: string, title: string, price: number, currency: string,
    city: string, district: string | null, purpose: PropertyPurpose, status: PropertyStatus
  } | null
  agent: { id: string, name: string, email: string | null } | null
  completedBy: { id: string, name: string, role: UserRole } | null
}

export interface CreateAgentInput {
  name: string
  email: string
  password: string
  role?: string | null
  phone?: string | null
  languages?: string | null
  experienceYears?: number
}

export type ContentSectionName = "home" | "about" | "contact" | "footer" | "seo"
export type SiteContent = Record<ContentSectionName, Record<string, unknown>>

const ROOT = "/api/v1"

// ── Admin API ──────────────────────────────────────────────────────────

export const adminApi = {
  dashboard: () => http.get<DashboardData>(`${ROOT}/admin/dashboard`),

  listProperties: async (params: {
    status?: PropertyStatus, purpose?: PropertyPurpose, search?: string, page?: number,
  } = {}): Promise<Paginated<AdminPropertySummary>> => {
    const qs = new URLSearchParams()
    if (params.status) qs.set("status", params.status)
    if (params.purpose) qs.set("purpose", params.purpose)
    if (params.search) qs.set("search", params.search)
    qs.set("page", String(params.page ?? 1))
    qs.set("limit", "100")
    const { data, meta } = await http.getEnvelope<AdminPropertySummary[]>(
      `${ROOT}/admin/properties?${qs.toString()}`,
    )
    return {
      items: data,
      total: Number(meta?.total ?? 0),
      page: Number(meta?.page ?? 1),
      totalPages: Number(meta?.totalPages ?? 0),
    }
  },

  fetchProperty: (id: string) =>
    http.get<AdminPropertyDetail>(`${ROOT}/properties/${encodeURIComponent(id)}`),

  createProperty: (input: AdminPropertyInput) =>
    http.post<AdminPropertyDetail>(`${ROOT}/properties`, input),

  updateProperty: (id: string, input: Partial<AdminPropertyInput>) =>
    http.patch<AdminPropertyDetail>(
      `${ROOT}/properties/${encodeURIComponent(id)}`,
      input,
    ),

  deleteProperty: (id: string) =>
    http.delete<unknown>(`${ROOT}/properties/${encodeURIComponent(id)}`),

  viewings: async (params: { status?: ViewingStatus, page?: number } = {}): Promise<Paginated<AdminViewing>> => {
    const qs = new URLSearchParams()
    if (params.status) qs.set("status", params.status)
    qs.set("page", String(params.page ?? 1))
    qs.set("limit", "50")
    const { data, meta } = await http.getEnvelope<AdminViewing[]>(
      `${ROOT}/admin/viewings?${qs.toString()}`,
    )
    return {
      items: data,
      total: Number(meta?.total ?? 0),
      page: Number(meta?.page ?? 1),
      totalPages: Number(meta?.totalPages ?? 0),
    }
  },

  updateViewingStatus: (id: string, status: ViewingStatus) =>
    http.patch<AdminViewing>(`${ROOT}/viewings/${encodeURIComponent(id)}`, { status }),

  agents: () => http.get<AdminAgent[]>(`${ROOT}/admin/agents`),
  updateAgent: (id: string, patch: Partial<{
    name: string, role: string | null, languages: string | null,
    experienceYears: number, phone: string | null, email: string | null, imageUrl: string | null,
  }>) =>
    http.patch<AdminAgent>(`${ROOT}/admin/agents/${encodeURIComponent(id)}`, patch),

  users: async (search?: string): Promise<Paginated<AdminUser>> => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : ""
    const { data, meta } = await http.getEnvelope<AdminUser[]>(
      `${ROOT}/admin/users${qs}`,
    )
    return { items: data, total: Number(meta?.total ?? 0), page: 1, totalPages: 1 }
  },

  amenities: () => http.get<AmenityOption[]>(`${ROOT}/admin/amenities`),
  neighborhoods: () => http.get<NeighborhoodOption[]>(`${ROOT}/admin/neighborhoods`),

  inquiries: async (params: { status?: InquiryStatus, page?: number } = {}): Promise<Paginated<AdminInquiry>> => {
    const qs = new URLSearchParams()
    if (params.status) qs.set("status", params.status)
    qs.set("page", String(params.page ?? 1))
    qs.set("limit", "50")
    const { data, meta } = await http.getEnvelope<AdminInquiry[]>(
      `${ROOT}/admin/inquiries?${qs.toString()}`,
    )
    return {
      items: data,
      total: Number(meta?.total ?? 0),
      page: Number(meta?.page ?? 1),
      totalPages: Number(meta?.totalPages ?? 0),
    }
  },

  deals: async (params: { page?: number } = {}): Promise<Paginated<AdminDeal>> => {
    const qs = new URLSearchParams()
    qs.set("page", String(params.page ?? 1))
    qs.set("limit", "50")
    const { data, meta } = await http.getEnvelope<AdminDeal[]>(
      `${ROOT}/admin/deals?${qs.toString()}`,
    )
    return {
      items: data,
      total: Number(meta?.total ?? 0),
      page: Number(meta?.page ?? 1),
      totalPages: Number(meta?.totalPages ?? 0),
    }
  },

  createAgent: (input: CreateAgentInput) =>
    http.post<AdminAgent>(`${ROOT}/admin/agents`, input),
}

// ── CMS API ────────────────────────────────────────────────────────────

export const contentApi = {
  all: () => http.get<SiteContent>("/api/v1/content"),
  section: (name: ContentSectionName) =>
    http.get<Record<string, unknown>>(`/api/v1/content/${name}`),
  updateSection: (name: ContentSectionName, values: Record<string, unknown>) =>
    http.put<Record<string, unknown>>(`/api/v1/admin/content/${name}`, values),
}