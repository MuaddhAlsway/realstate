# Estate — Database Architecture (Phase 02)

## Versioned API (Phase 03)

Production API lives under `/api/v1` (legacy `/api` stays until the frontend
migrates). Request pipeline:

```
Route → Validation (Zod) → Controller → Service → Drizzle → PostgreSQL
                                     └────── Serializer ──── HTTP response
```

- `server/src/schemas/property.js` — Zod schemas (id / create / patch)
- `server/src/middleware/validate.js` — schema & empty-patch enforcement
- `server/src/controllers/v1/` — thin HTTP translation
- `server/src/services/propertyService.js` — all DB access + business rules
- `server/src/serializers/properties.js` — DB rows → API resources (+ the
  mapping to the React `Property` model lives in the file header)
- `server/src/errors/pg.js` — predictable PG errors → canonical HTTP errors
  (23505 slug → 409 PROPERTY_SLUG_CONFLICT; 23503 → 422 INVALID_REFERENCE;
  never leaked raw)

Tests: `pnpm test` (Vitest + Supertest) run against the isolated `estate_test`
database — never the production one. Prepare it with `pnpm db:test:prepare`.

## Querying (Phase 04)

`GET /api/v1/properties` accepts validated query parameters. Validation
(`schemas/property.js`, strict object) rejects unknown keys and malformed
values with **422 `INVALID_QUERY`** — typos are visible, not silently ignored.

| Param | Meaning |
| --- | --- |
| `purpose` | `SALE` \| `RENT` (indexed: `properties_purpose_status_idx`) |
| `propertyType` | `VILLA` \| `APARTMENT` \| `PENTHOUSE` \| `DUPLEX` (indexed) |
| `city`, `district` | exact match (both indexed) |
| `minPrice`, `maxPrice` | range on `price` (indexed); cross-validated `min ≤ max` |
| `minBedrooms`, `minBathrooms` | range on scalar column (no index — see below) |
| `search` | word-boundary substring match over title/city/district |
| `sort` | `featured` (default) · `newest` · `price-asc` · `price-desc` |
| `page`, `limit` | offset pagination; `limit` capped at 50 |

Search runs a case-insensitive whole-word regex match (`~*`) per whitespace
token — every token must match, any of the three columns may supply it.
`ham` does not match `Al Hamra`; `shati` matches `Al Shati District`.

Response adds a `meta` block: `{ page, limit, total, totalPages }`.

### EXPLAIN ANALYZE gating

Measured against `estate_test` (same schema/indexes as production). At seed
scale (6 rows, 1 buffer page) the planner correctly chooses **Seq Scan** —
~0.02 ms, faster than any index traversal. Forced-index runs (temporarily
`SET enable_seqscan = off`) confirm every filtered path has a live index:

| Path | Plan the optimizer takes today | Index that becomes relevant at scale |
| --- | --- | --- |
| `purpose` | Seq Scan (1 page) | `properties_purpose_status_idx` Index Scan |
| `city` | Seq Scan (1 page) | `properties_created_idx` backward + filter |
| `min/maxPrice` | Seq Scan (1 page) | `properties_price_idx` Index Scan |
| `search` BI regex | Seq Scan | none today → add `pg_trgm` GIN when in prod |
| `minBedrooms` | Seq Scan (1 page) | no index → add `bedrooms` index if hot |
| default `featured` sort | Seq Scan (1 page) | no index → partial index on `featured` if hot |

No filtered path is N+1 — relations load in constant query count via
relational `with`, and the page query shares the exact `WHERE` the `count`
uses. Search and `bedrooms`-style scans are acceptable at dev scale; the
indexes to add before high traffic are noted in the table.

### Offset vs cursor

Offset pagination (page+total) was chosen for this catalog: stable, simple,
and cheap to total. It re-scans on deep offsets and shifts if rows churn
between pages; a keyset cursor (`created_at, id`) is the documented upgrade
path if catalog ratchets past tens of thousands of rows.

Stack: **PostgreSQL (Neon)** via the **postgres.js** driver, modeled with
**Drizzle ORM + Drizzle Kit**. The schema lives in
`server/src/db/schema/index.js` and is shared by the running API and the
migration tool — one source of truth.

## Authentication (Phase 05)

`/api/v1/auth` — register, login, refresh, logout, me. Property *mutations*
now require an authenticated **AGENT**/**ADMIN**; the catalog (GET) stays
public.

| Endpoint | Guard | Result |
| --- | --- | --- |
| `POST /auth/register` | public | `201` → `{ user, accessToken, refreshToken }` |
| `POST /auth/login` | public | `200` → same session shape |
| `POST /auth/refresh` | public | rotates the refresh token |
| `POST /auth/logout` | public | `204`, revokes the whole family |
| `GET /auth/me` | `requireAuth` | `200` `{ id, name, email, role, createdAt, agent? }` |
| `POST/PATCH/DELETE /properties` | `requireAuth` + `requireRole("AGENT","ADMIN")` | 401/403 on denial |

Security model:

- **Passwords**: Argon2id (`server/src/auth/password.js`).
- **Access tokens**: dependency-free HS256 JWT, 15 min TTL (`auth/tokens.js`).
  Payload carries only `sub`, `role`, `typ: "access"`. Verified with
  `timingSafeEqual`; `JWT_SECRET` from `.env` (dev fallback only outside
  `NODE_ENV=production`).
- **Refresh tokens**: opaque 256-bit random values. Only the **SHA-256 hash**
  is stored (`refresh_tokens.token_hash`). Every refresh rotates — the old row
  records `replaced_by_token_hash` and a new row joins the same `family_id`.
  Presenting a rotated token = reuse/theft → the whole family is revoked and
  the request gets `401`. Logout revokes the family too.
- **Roles**: `role` is never accepted from the request body (auth schemas use
  `.strict()`); registration always creates `USER`. The seed provisions the
  demo accounts: `admin@estate.sa` (ADMIN) and `demo@estate.sa` (USER) with
  real Argon2 hashes, refreshed idempotently on re-seed.
- Errors: `401 UNAUTHORIZED` (bad credentials / missing or invalid token),
  `403 FORBIDDEN` (authenticated but wrong role), `409 EMAIL_CONFLICT`
  (duplicate email, race-guarded via `users_email_key`).

Demo credentials (dev only): `admin@estate.sa` / `Estate-Admin-2026!` and
`demo@estate.sa` / `Estate-Demo-2026!`.

## Favorites (Phase 06)

`/api/v1/favorites` — the signed-in user's saved properties. Every route
requires authentication (`requireAuth` via `Authorization: Bearer <access>`)
and is scoped to the caller: you can only see, add or remove your own rows.

| Endpoint | Guard | Result |
| --- | --- | --- |
| `GET /favorites` | `requireAuth` | `200` `{ data: [property summaries + savedAt], meta: {page, limit, total, totalPages} }` |
| `PUT /favorites/:propertyId` | `requireAuth` | idempotent save → `200` `{ propertyId, isFavorite, savedAt }` |
| `DELETE /favorites/:propertyId` | `requireAuth` | `204`; `404 FAVORITE_NOT_FOUND` if not saved |

Details:

- List is newest-save-first (`favorites.created_at DESC`), paginated like the
  catalog; each item is the property summary serializer plus `savedAt`.
- `PUT` is an idempotent UPSERT — the composite PK
  `(user_id, property_id)` makes duplicates structurally impossible
  (`onConflictDoNothing`).
- Unknown property → `404 PROPERTY_NOT_FOUND`; malformed UUID → `422`.
- Query params are strict (`page`/`limit` only; anything else → `422
  INVALID_QUERY`).

Runs in `server/src/services/favoriteService.js` (all DB access),
`server/src/controllers/v1/favorites.js` (thin HTTP), and the schema in
`server/src/schemas/favorites.js`. Tests in `server/tests/favorites.v1.test.mjs`.

## Viewing Requests (Phase 07)

`/api/v1/viewings` — the booking workflow between a signed-in user and the
agent who owns a listing. Every route requires authentication.

| Endpoint | Guard | Result |
| --- | --- | --- |
| `POST /viewings` | `requireAuth` | request a viewing → `201` detail; `agentId` inherited from the property |
| `GET /viewings` | `requireAuth` | `200` "my" requests: my own + the assigned-agent inbox (+ everything for ADMIN), paginated, optional `?status=` |
| `PATCH /viewings/:id` | `requireAuth` | role-gated status transition → `200` detail |
| `DELETE /viewings/:id` | `requireAuth` | `204`; `404 VIEWING_NOT_FOUND`; requester/agent/admin only |

Ownership & rules:

- **Create** — `userId` always comes from the session (never the body);
  `agentId` is inherited from the property (`agentId` nullable → unassigned).
  Body is strict: `{ propertyId, date: YYYY-MM-DD, time?: HH:MM, message? ≤2000 }`.
  Unknown property → `404 PROPERTY_NOT_FOUND`.
- **List** — a USER sees only their own requests; an AGENT additionally sees
  the inbox for their linked agent profile; an ADMIN sees everything. The
  `status` filter ANDs with that scope (newest first).
- **Status transitions** — the requester may only CANCEL their own PENDING
  request; the assigned agent or an ADMIN may CONFIRM / COMPLETE / CANCEL.
  `PENDING` is creation-only and never set via `PATCH` (`403`). Unrelated
  actors get `403 FORBIDDEN`; unknown id → `404 VIEWING_NOT_FOUND`.
- **Delete** — requester, assigned agent, or admin; idempotent-ish: a second
  delete → `404`.
- `time` is normalized to `HH:MM` on the wire (Postgres `TIME` reads back as
  `HH:MM:SS`).

Runs in `server/src/services/viewingService.js` (all DB access + the
ownership rules), `server/src/controllers/v1/viewings.js` (thin HTTP), with
schemas in `server/src/schemas/viewing.js`. Tests in
`server/tests/viewings.v1.test.mjs`.

## Frontend integration (Phase 08)

The React app is mock-first: without configuration it renders against an
in-browser mock (`src/services/mock.ts`, legacy `/api` paths). Setting
`VITE_API_URL` to the running server (e.g. `http://localhost:4000`) switches
it to this real API — properties, auth, favorites and viewings then hit the
`/api/v1` routes documented above.

- **Session** — `src/services/session.ts` persists `{user, accessToken,
  refreshToken}` under `estate.session`; on boot `AuthContext` rehydrates via
  `GET /auth/me` and treats refresh failures as logged out.
- **Tokens** — `src/services/http.ts` attaches `Authorization: Bearer`, and on
  a `401` retries once through `POST /auth/refresh` (rotating the family)
  before clearing the session.
- **Shapes** — `src/services/mapping.ts` adapts serializer output to the
  frontend property model: purpose → listingType, propertyType → type,
  AVAILABLE/PENDING|DRAFT/SOLD|RENTED → available/new/under-contract, plus
  price/agent/neighborhood/status normalization.
- **Queries** — `src/services/api.ts` translates the frontend property filter
  (buy|rent, q, propType, beds, maxPrice, sort) to the backend query contract
  (purpose SALE|RENT, search, propertyType, minBedrooms, maxPrice, sort).
- **Favorites** — server-backed only when remote and signed in; optimistic
  toggle with revert through `PUT/DELETE /favorites/:id`, list through
  `GET /favorites` (property summaries serialized by `serializeFavoriteList`).
- **Viewings** — `Dashboard` lists `GET /viewings` (status badge + property
  name), `PropertyDetail` submits `POST /viewings`; remote submissions are
  gated behind sign-in and only send `date`/`time`/`message` (identity comes
  from the session). Legacy neighborhoods/agents/contact keep the `/api` path
  in both modes (mock locally, legacy express routes when remote).

## Connection model

- `server/src/db/index.js` is the **only** place that creates a connection.
- Connection is **lazy**: the server boots without `DATABASE_URL` and serves
  `GET /api/health` with `checks.db = "skipped"`. The first real query opens
  a pooled Postgres connection and throws a configuration hint if the URL is
  missing.
- `pnpm db:generate` — write migration SQL from the schema (no DB needed).
- `pnpm db:migrate` — apply pending migrations (requires a live `DATABASE_URL`).
- `pnpm db:seed` — idempotently seed the design dataset (6 properties from
  `shared/estate-data.json` + 3 agents + 5 neighborhoods + amenities).
- `pnpm db:studio` — Drizzle Studio browser UI.

## Configuring Neon

1. Create a Neon project → copy the pooled connection string.
2. Add to `.env` (copy `.env.example`):
   ```
   DATABASE_URL=postgresql://user:password@ep-xxxx.region.aws.neon.tech/estate?sslmode=require
   ```
   Use `?sslmode=require` (Neon requires TLS). If your URL lacks the
   `sslmode` parameter set `DB_SSL=true` in `.env` instead.
3. `pnpm db:migrate && pnpm db:seed`

Never commit `DATABASE_URL` — `.env` is git-ignored.

## Relationship map

```
User ─1:1─ Agent?              (optional account link, agents.user_id)
User 1──N Favorites N──1 Property
User 1──N ViewingRequests N──1 Property
Agent 1──N Properties N──1 Neighborhood
Property 1──N PropertyImages
Property N──M Amenities  (via property_amenities composite PK)
Agent 1──N ViewingRequests
Property 1──N ViewingRequests
User 1──N RefreshTokens    (phase 5 sessions)
```

## Tables

| Table | Purpose | Key columns |
| --- | --- | --- |
| `users` | Auth + RBAC identities (Phase 05) | `email` UNIQUE, `password_hash`, `role` enum |
| `agents` | Agent profiles (may link to a `users` row) | `user_id` FK → users (1:1, nullable) |
| `neighborhoods` | Areas (Jeddah districts) | `name`/`slug` UNIQUE, `lat`,`lng` |
| `properties` | Property listings | `slug` UNIQUE, enums, `price` CHECK ≥ 0 |
| `property_images` | Ordered image gallery, one cover | `property_id` FK cascade, partial-unique cover |
| `amenities` | Amenity catalogue | `name` UNIQUE |
| `property_amenities` | N:M join | composite PK `(property_id, amenity_id)` |
| `favorites` | User↔Property N:M (Phase 06) | composite PK `(user_id, property_id)` |
| `viewing_requests` | Viewing schedule workflow (Phase 07) | FKs to user/agent/property, `status` enum |
| `refresh_tokens` | Rotation/revocation sessions (Phase 05) | `token_hash` UNIQUE, `family_id`, no raw tokens |

## Enums (DB-native CHECK-style types)

`user_role` (USER, AGENT, ADMIN) · `property_purpose` (SALE, RENT) ·
`property_type` (VILLA, APARTMENT, PENTHOUSE, DUPLEX) ·
`property_status` (AVAILABLE, PENDING, SOLD, RENTED, DRAFT) ·
`viewing_status` (PENDING, CONFIRMED, COMPLETED, CANCELLED)

Drizzle maps these to PostgreSQL `ENUM` types so invalid values are rejected
at the database level.

## Key constraints

- `users.email` UNIQUE, `neighborhoods.name/slug` UNIQUE, `properties.slug` UNIQUE
- `favorites (user_id, property_id)` and `property_amenities (property_id, amenity_id)`
  composite PRIMARY KEYS — prevent duplicates structurally
- `properties.price >= 0` CHECK (money stored as **integer SAR**, matching the
  frontend `priceNum`; no floats for financial data)
- partial UNIQUE on `property_images(property_id) WHERE is_cover` — at most
  one cover image per property
- FK `ON DELETE` rules: catalog rows that own children use `cascade`
  (property → images/amenities/favorites/viewings); optional references use
  `set null` (property → agent/neighborhood; viewing → user/agent)

## Indexes (and why)

Deliberately not one index per column — these follow the real query patterns
of the catalog API:

| Index | Reason |
| --- | --- |
| `properties (purpose, status)` | dominant list query filters by purpose+status together |
| `properties (city)`, `(district)`, `(property_type)` | single-key filter predicates |
| `properties (price)` | price range filters + price sorting |
| `properties (neighborhood_id)`, `(agent_id)` | FK join lookups (detail/related, agent listings) |
| `properties (created_at)` | "newest/fresh listings" sort |
| `favorites (property_id)` | reverse lookups ("who favorited this") — the user side is served by the composite PK |
| `property_images (property_id)` | gallery fetch by property |
| `viewing_requests (property_id/agent_id/user_id)` | workflow queries by each participant |
| `refresh_tokens (user_id)`, `(expires_at)`, UNIQUE `(token_hash)` | session lookup / revocation sweeps / lookups by hash |

The `(purpose, status)` composite is the justification for a multi-column
index; the rest are single-column to keep the write path cheap until
`EXPLAIN ANALYZE` says otherwise.

## Migrations

```
schema ↓ pnpm db:generate → review SQL ↓ pnpm db:migrate (needs DATABASE_URL)
```

Migrations live in `server/src/db/migrations/`. Never mutate the database
outside the migration system. `drizzle-kit` tracks applied migrations in a
`__drizzle_migrations` table.