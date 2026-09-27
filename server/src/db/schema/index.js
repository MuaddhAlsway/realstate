import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  time,
  doublePrecision,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core"
import { relations, sql } from "drizzle-orm"

/**
 * Estate — relational schema.
 *
 * Deliberately plain ESM JavaScript: the server runtime is plain JS (`node
 * server/index.js`), so the schema stays importable by both the running app
 * and Drizzle Kit without introducing a TS loader. Column names are
 * snake_case in PostgreSQL; JS identifiers are camelCase.
 *
 * Money note: prices are stored as INTEGER in major units (SAR riyals),
 * matching the existing frontend `priceNum` contract. Integers avoid the
 * floating-point hazards of REAL/NUMERIC-vs-float math; if fractional
 * currencies ever appear this column migrates to NUMERIC cents.
 */

// ── Enums ────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", ["USER", "AGENT", "ADMIN"])
export const propertyPurposeEnum = pgEnum("property_purpose", ["SALE", "RENT"])
export const propertyTypeEnum = pgEnum("property_type", [
  "VILLA",
  "APARTMENT",
  "PENTHOUSE",
  "DUPLEX",
])
export const propertyStatusEnum = pgEnum("property_status", [
  "AVAILABLE",
  "RESERVED",
  "PENDING",
  "SOLD",
  "RENTED",
  "ARCHIVED",
  "DRAFT",
])
export const viewingStatusEnum = pgEnum("viewing_status", [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
])
// Phase 11 — client management workflow
export const inquiryStatusEnum = pgEnum("inquiry_status", [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
])
export const notificationTypeEnum = pgEnum("notification_type", [
  "INQUIRY",
  "MESSAGE",
  "DEAL",
  "SYSTEM",
])
export const messageSenderEnum = pgEnum("message_sender", [
  "CUSTOMER",
  "AGENT",
  "ADMIN",
  "SYSTEM",
])

// ── users ────────────────────────────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("USER"),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email)],
)

// ── agents ───────────────────────────────────────────────────────────────
export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Optional 1:1 link to an authenticated user (an agent that registers).
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  role: text("role"),
  languages: text("languages"),
  experienceYears: integer("experience_years").notNull().default(0),
  phone: text("phone"),
  email: text("email"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// ── neighborhoods ────────────────────────────────────────────────────────
export const neighborhoods = pgTable(
  "neighborhoods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    tagline: text("tagline"),
    description: text("description"),
    imageUrl: text("image_url"),
    avgPrice: integer("avg_price"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("neighborhoods_name_key").on(t.name),
    uniqueIndex("neighborhoods_slug_key").on(t.slug),
  ],
)

// ── properties ───────────────────────────────────────────────────────────
export const properties = pgTable(
  "properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    purpose: propertyPurposeEnum("purpose").notNull().default("SALE"),
    propertyType: propertyTypeEnum("property_type").notNull(),
    status: propertyStatusEnum("status").notNull().default("AVAILABLE"),
    price: integer("price").notNull(),
    currency: text("currency").notNull().default("SAR"),
    bedrooms: integer("bedrooms").notNull().default(0),
    bathrooms: integer("bathrooms").notNull().default(0),
    area: integer("area"),
    city: text("city").notNull(),
    district: text("district"),
    address: text("address"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    featured: boolean("featured").notNull().default(false),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    neighborhoodId: uuid("neighborhood_id").references(() => neighborhoods.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("properties_slug_key").on(t.slug),
    check("properties_price_non_negative", sql`${t.price} >= 0`),
    // Composite first for the dominant list query (catalog by purpose+status).
    index("properties_purpose_status_idx").on(t.purpose, t.status),
    index("properties_city_idx").on(t.city),
    index("properties_district_idx").on(t.district),
    index("properties_type_idx").on(t.propertyType),
    index("properties_price_idx").on(t.price),
    index("properties_neighborhood_idx").on(t.neighborhoodId),
    index("properties_agent_idx").on(t.agentId),
    index("properties_created_idx").on(t.createdAt),
  ],
)

// ── property_images ──────────────────────────────────────────────────────
export const propertyImages = pgTable(
  "property_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    publicId: text("public_id"),
    altText: text("alt_text"),
    displayOrder: integer("display_order").notNull().default(0),
    isCover: boolean("is_cover").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("property_images_property_idx").on(t.propertyId),
    // At most one cover image per property.
    uniqueIndex("property_images_one_cover_idx")
      .on(t.propertyId)
      .where(sql`${t.isCover} = true`),
  ],
)

// ── amenities + property_amenities (N:M) ─────────────────────────────────
export const amenities = pgTable(
  "amenities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    category: text("category"),
  },
  (t) => [uniqueIndex("amenities_name_key").on(t.name)],
)

export const propertyAmenities = pgTable(
  "property_amenities",
  {
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    amenityId: uuid("amenity_id")
      .notNull()
      .references(() => amenities.id, { onDelete: "cascade" }),
  },
  (t) => [
    // Composite PK prevents duplicate associations at the DB level.
    primaryKey({ columns: [t.propertyId, t.amenityId] }),
  ],
)

// ── favorites (users N:M properties) ─────────────────────────────────────
export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.propertyId] }),
    index("favorites_property_idx").on(t.propertyId),
  ],
)

// ── viewing_requests ─────────────────────────────────────────────────────
export const viewingRequests = pgTable(
  "viewing_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    time: time("time"),
    message: text("message"),
    status: viewingStatusEnum("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("viewings_property_idx").on(t.propertyId),
    index("viewings_agent_idx").on(t.agentId),
    index("viewings_user_idx").on(t.userId),
  ],
)

// ── refresh_tokens (foundation for Phase 05 auth) ────────────────────────
// Column set supports: rotation (replacedByTokenHash + familyId),
// revocation (revokedAt), expiry (expiresAt) and reuse detection
// (revoking a whole family when a rotated token resurfaces).
export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // SHA-256 of the raw token — never store the refresh token itself.
    tokenHash: text("token_hash").notNull(),
    familyId: uuid("family_id").notNull(),
    replacedByTokenHash: text("replaced_by_token_hash"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("refresh_tokens_hash_key").on(t.tokenHash),
    index("refresh_tokens_user_idx").on(t.userId),
    index("refresh_tokens_expires_idx").on(t.expiresAt),
  ],
)

// ── site_content (CMS: admin-editable website content) ───────────────────
// A section + key + JSONB value row. Any JSON value is allowed (string,
// number, array, object) but the write path validates whole sections through
// per-section Zod schemas so only known keys/fields can ever be stored —
// never arbitrary columns or executable content, and never secrets.
export const siteContent = pgTable(
  "site_content",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    section: text("section").notNull(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("site_content_section_key_key").on(t.section, t.key),
    index("site_content_section_idx").on(t.section),
  ],
)

// ── inquiries (Phase 11: client management/deal pipeline) ───────────────
// One inquiry per customer interest. The property's assigned agent owns the
// deal; the customer can be a guest (denormalized contact columns) or a
// signed-in user (linked via `userId`). Status history is immutable evidence
// for the PENDING → IN_PROGRESS → COMPLETED (+ CANCELLED) workflow.
export const inquiries = pgTable(
  "inquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone"),
    message: text("message").notNull(),
    preferredContactMethod: text("preferred_contact_method").notNull().default("EMAIL"),
    viewingDate: date("viewing_date"),
    viewingTime: time("viewing_time"),
    status: inquiryStatusEnum("status").notNull().default("PENDING"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedByUserId: uuid("completed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("inquiries_property_idx").on(t.propertyId),
    index("inquiries_agent_idx").on(t.agentId),
    index("inquiries_user_idx").on(t.userId),
    index("inquiries_status_created_idx").on(t.status, t.createdAt),
  ],
)

// 1:1 with every inquiry — the conversation/thread backing the deal.
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inquiryId: uuid("inquiry_id")
      .notNull()
      .unique()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("conversations_inquiry_idx").on(t.inquiryId)],
)

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").references(() => users.id, {
      onDelete: "set null",
    }),
    senderRole: messageSenderEnum("sender_role").notNull(),
    content: text("content").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("messages_conversation_created_idx").on(t.conversationId, t.createdAt),
  ],
)

// In-app notification feed — the agent (and customer) account's inbox. The
// content is never executable; just a typed, readable feed entry.
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inquiryId: uuid("inquiry_id").references(() => inquiries.id, {
      onDelete: "set null",
    }),
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    message: text("message"),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("notifications_user_read_idx").on(t.userId, t.read),
    index("notifications_created_idx").on(t.createdAt),
  ],
)

// Audit trail of inquiry status transitions (creation included).
export const inquiryStatusHistory = pgTable(
  "inquiry_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inquiryId: uuid("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    fromStatus: inquiryStatusEnum("from_status"),
    toStatus: inquiryStatusEnum("to_status").notNull(),
    changedByUserId: uuid("changed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("inquiry_history_inquiry_idx").on(t.inquiryId)],
)

// ── Relations (for joins + drizzle query builders in later phases) ──────
export const usersRelations = relations(users, ({ many, one }) => ({
  favorites: many(favorites),
  viewingRequests: many(viewingRequests),
  refreshTokens: many(refreshTokens),
  inquiries: many(inquiries),
  sentMessages: many(messages, { relationName: "messages_sender" }),
  notifications: many(notifications),
  statusChanges: many(inquiryStatusHistory),
  completedInquiries: many(inquiries, { relationName: "inquiries_completed_by" }),
  agent: one(agents, { fields: [users.id], references: [agents.userId] }),
}))

export const agentsRelations = relations(agents, ({ many, one }) => ({
  user: one(users, {
    fields: [agents.userId],
    references: [users.id],
  }),
  properties: many(properties),
  viewingRequests: many(viewingRequests),
  inquiries: many(inquiries),
}))

export const neighborhoodsRelations = relations(neighborhoods, ({ many }) => ({
  properties: many(properties),
}))

export const propertiesRelations = relations(properties, ({ many, one }) => ({
  agent: one(agents, {
    fields: [properties.agentId],
    references: [agents.id],
  }),
  neighborhood: one(neighborhoods, {
    fields: [properties.neighborhoodId],
    references: [neighborhoods.id],
  }),
  images: many(propertyImages),
  propertyAmenities: many(propertyAmenities),
  favorites: many(favorites),
  viewingRequests: many(viewingRequests),
  inquiries: many(inquiries),
}))

export const propertyImagesRelations = relations(propertyImages, ({ one }) => ({
  property: one(properties, {
    fields: [propertyImages.propertyId],
    references: [properties.id],
  }),
}))

export const amenitiesRelations = relations(amenities, ({ many }) => ({
  propertyAmenities: many(propertyAmenities),
}))

export const propertyAmenitiesRelations = relations(
  propertyAmenities,
  ({ one }) => ({
    property: one(properties, {
      fields: [propertyAmenities.propertyId],
      references: [properties.id],
    }),
    amenity: one(amenities, {
      fields: [propertyAmenities.amenityId],
      references: [amenities.id],
    }),
  }),
)

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, { fields: [favorites.userId], references: [users.id] }),
  property: one(properties, {
    fields: [favorites.propertyId],
    references: [properties.id],
  }),
}))

export const viewingRequestsRelations = relations(
  viewingRequests,
  ({ one }) => ({
    user: one(users, {
      fields: [viewingRequests.userId],
      references: [users.id],
    }),
    agent: one(agents, {
      fields: [viewingRequests.agentId],
      references: [agents.id],
    }),
    property: one(properties, {
      fields: [viewingRequests.propertyId],
      references: [properties.id],
    }),
  }),
)

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}))

export const inquiriesRelations = relations(inquiries, ({ many, one }) => ({
  property: one(properties, {
    fields: [inquiries.propertyId],
    references: [properties.id],
  }),
  agent: one(agents, {
    fields: [inquiries.agentId],
    references: [agents.id],
  }),
  user: one(users, {
    fields: [inquiries.userId],
    references: [users.id],
  }),
  completedBy: one(users, {
    fields: [inquiries.completedByUserId],
    references: [users.id],
    relationName: "inquiries_completed_by",
  }),
  conversation: one(conversations, {
    fields: [inquiries.id],
    references: [conversations.inquiryId],
  }),
  history: many(inquiryStatusHistory),
}))

export const conversationsRelations = relations(
  conversations,
  ({ many, one }) => ({
    inquiry: one(inquiries, {
      fields: [conversations.inquiryId],
      references: [inquiries.id],
    }),
    messages: many(messages),
  }),
)

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: "messages_sender",
  }),
}))

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  inquiry: one(inquiries, {
    fields: [notifications.inquiryId],
    references: [inquiries.id],
  }),
}))

export const inquiryStatusHistoryRelations = relations(
  inquiryStatusHistory,
  ({ one }) => ({
    inquiry: one(inquiries, {
      fields: [inquiryStatusHistory.inquiryId],
      references: [inquiries.id],
    }),
    changedBy: one(users, {
      fields: [inquiryStatusHistory.changedByUserId],
      references: [users.id],
    }),
  }),
)
