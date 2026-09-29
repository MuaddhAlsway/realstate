# 🏛️ Estate — Luxury Real Estate Platform

> **A production-oriented full-stack real-estate marketplace built for Jeddah, Saudi Arabia 🇸🇦**
>
> Estate combines a modern React experience, secure Express REST API, PostgreSQL on Neon, role-based Admin and Agent portals, Cloudinary media management, and a complete newsletter/email delivery system.

Built and prototyped with **Figma Make**, deployed on **Render**, and powered by **Neon PostgreSQL**.

---

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C5F74F)
![Render](https://img.shields.io/badge/Deploy-Render-46E3B7?logo=render&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-233_Passing-3A7D44)

---

## 🌐 Live Application

| Service | URL |
| --- | --- |
| 🖥️ **Frontend** | `https://realstate-1-ypty.onrender.com` |
| ⚙️ **REST API** | `https://realstate-rfu5.onrender.com` |
| ❤️ **API Health** | `https://realstate-rfu5.onrender.com/api/health` |

---

# 🧰 Tech Stack

<img
  src="assets/techstack.png"
  alt="Estate technology stack"
  width="100%"
/>

| Layer | Technologies |
| --- | --- |
| 🖥️ **Frontend** | ⚛️ React 19 · ⚡ Vite 8 · 🟦 TypeScript 5.7 · 🎨 Tailwind CSS v4 · 🧭 React Router 7 · 🎬 GSAP |
| ⚙️ **Backend** | 🟢 Node.js 22 · 🚂 Express 5 · 🛡️ Zod 4 · 🔐 JWT · 🔑 Argon2id |
| 🗄️ **Database** | 🐘 PostgreSQL · ⚡ Neon · 🧬 Drizzle ORM · `postgres.js` |
| ✉️ **Email** | 📧 Nodemailer · 🚀 Resend HTTP API · SMTP/STARTTLS |
| ☁️ **Media** | Cloudinary · Signed Uploads |
| 🧪 **Testing** | Vitest · Supertest |
| 🚀 **DevOps** | GitHub Actions · Render · pnpm |
| 🎨 **Design** | Figma Make |

---

# 🎯 What Estate Does

Estate is more than a property listing frontend.

It implements the workflow of a modern real-estate platform:

```text
Visitor
   │
   ├── Browse Properties
   ├── Search & Filter
   ├── View Property
   │
   ▼
User Account
   │
   ├── Save Favorites
   ├── Submit Inquiry
   ├── Request Viewing
   │
   ▼
Agent
   │
   ├── Receive Assigned Leads
   ├── Manage Client Progress
   ├── Communicate With Clients
   │
   ▼
Admin
   │
   ├── Manage Properties
   ├── Manage Agents
   ├── Manage Users
   ├── Manage CMS
   ├── Manage Newsletter
   └── Monitor Platform
```

---

# ✨ Core Features

## 🏠 Property Marketplace

Estate provides a complete property discovery experience.

### 🔎 Search & discovery

Users can:

- Browse property listings
- Search properties using word-boundary matching
- Filter by purpose
- Filter by property type
- Filter by city
- Filter by price
- Filter by bedrooms
- Apply multiple filters together
- Sort results using four sorting modes
- Navigate offset-based pagination
- Open full property detail pages

### 🏘️ Property experience

Property pages support:

- Property information
- Pricing
- Location
- Amenities
- Property images
- Assigned agent
- Viewing requests
- Property inquiries
- Favorites

Additional public sections include:

- 🏙️ Neighborhoods
- 🧑‍💼 Agents
- ℹ️ About
- 📞 Contact

---

# 👤 User Accounts

Registered users can:

- 📝 Create an account
- 🔑 Sign in
- ❤️ Save properties
- 💔 Remove favorites
- 📅 Request property viewings
- 💬 Send property inquiries
- 👀 Review their activity
- 🔄 Maintain authenticated sessions

---

# 🔐 Authentication & Security

Security is implemented on the **backend**, not trusted to the frontend.

### 🔑 Password security

Passwords use:

```text
Argon2id
```

Passwords are never stored as plaintext.

---

### 🎟️ Access tokens

Authentication uses:

```text
HS256 JWT
```

Access tokens have a short lifetime:

```text
15 minutes
```

---

### 🔄 Rotating Refresh Tokens

Estate implements refresh-token rotation.

```text
Login
   ↓
Access Token
+
Refresh Token
   ↓
Refresh
   ↓
Old Refresh Token Invalidated
   ↓
New Refresh Token Issued
```

Only:

```text
SHA-256(refresh_token)
```

is persisted.

The raw refresh token is not stored.

---

### 🚨 Refresh-token reuse detection

If an already-rotated refresh token is reused:

```text
Reuse Detected
      ↓
Token Family Identified
      ↓
Entire Family Revoked
```

This limits damage from stolen refresh tokens.

---

### 🛡️ Validation

Zod validates incoming data.

Invalid query parameters return structured errors such as:

```json
{
  "success": false,
  "code": "INVALID_QUERY"
}
```

Unknown or mistyped query parameters can fail with:

```text
422
```

rather than silently changing application behavior.

---

# 👮 Role-Based Access Control

Estate uses multiple authorization levels:

```text
USER
AGENT
ADMIN
```

Authorization is enforced by the API.

```text
Request
   ↓
Authentication
   ↓
JWT Verification
   ↓
Role Guard
   ↓
Ownership / Relationship Check
   ↓
Controller
   ↓
Service
```

Frontend visibility is **not** considered a security boundary.

---

# 🛠️ Admin Console

The platform contains a dedicated administration system.

```text
/admin
```

## 📊 Dashboard

The admin dashboard provides live platform statistics including:

- 👥 Users
- 🏠 Properties
- 🧑‍💼 Agents
- 📅 Viewings
- 💬 Inquiries
- ✉️ Newsletter subscribers
- 📤 Emails sent
- ❌ Failed email deliveries
- 📢 Recent campaigns
- 📧 Email provider status

---

## 🏠 Property Management

Admins can:

- Create properties
- Update properties
- Manage images
- Manage amenities
- Assign agents
- Configure property status
- Manage buy/rent inventory

Property changes are reflected throughout the public website.

---

## 🧑‍💼 Agent Management

Admins can:

- View agents
- Update agent profiles
- Manage agent information
- Control agent access
- Associate agents with properties and leads

---

## 👥 User Directory

Admins can inspect and search platform users while maintaining backend authorization boundaries.

---

# 📝 CMS

Estate includes database-backed content management.

CMS sections include:

```text
home
about
contact
footer
seo
```

Content is stored using PostgreSQL `jsonb`.

```text
Admin CMS
    ↓
PUT /api/v1/admin/content/:section
    ↓
Validation
    ↓
PostgreSQL
    ↓
Public Content API
    ↓
React
```

This allows website content to change without rebuilding the frontend.

---

# ☁️ Media Management

Cloudinary powers property media.

Features include:

- ☁️ Cloud media storage
- 🔐 Signed uploads
- 🖼️ Property image management
- 🧹 Orphan media cleanup
- 🔒 Server-side credentials

Cloudinary secrets are never exposed through `VITE_*` variables.

---

# 🧑‍💼 Agent Portal

Agents receive their own protected workspace:

```text
/agent
```

Agents can access:

- 📊 Dashboard
- 🏠 Assigned properties
- 👥 Assigned clients/leads
- 💬 Inquiry conversations
- ✉️ Email communication
- 🔄 Lead status management
- 👤 Agent profile

---

# 🎯 Agent Lead Isolation

Agents do **not** have unrestricted access to every customer.

The relationship follows:

```text
User
   ↓
Property Inquiry / Viewing
   ↓
Property
   ↓
Assigned Agent
   ↓
Agent Lead
```

Backend authorization verifies this relationship.

For example:

```text
Agent A → Agent A's Lead      ✅
Agent A → Agent B's Lead      ❌
Agent A → Arbitrary Email     ❌
```

This protection exists server-side.

---

# 💬 Lead Workflow

Agents can manage leads through statuses such as:

```text
PENDING
   ↓
IN_PROGRESS
   ↓
COMPLETED
```

A lead may also be:

```text
CANCELLED
```

This creates a lightweight CRM workflow directly inside the real-estate platform.

---

# ✉️ Agent → Client Email

Authorized agents can email assigned clients directly.

```text
Agent
   ↓
Open Assigned Lead
   ↓
Compose Message
   ↓
Backend Authorization
   ↓
Resolve Client Email
   ↓
Email Service
   ↓
Client Inbox
```

The frontend does not provide an unrestricted arbitrary-recipient mail endpoint.

Every send is recorded for auditing and delivery tracking.

---

# 📬 Newsletter System

Estate includes a complete newsletter system.

Visitors can:

```text
Enter Email
    ↓
Subscribe
    ↓
Subscriber Stored
    ↓
Welcome Email
```

Subscriber states include:

```text
ACTIVE
UNSUBSCRIBED
```

Duplicate subscriptions are safely handled.

---

# 👋 Automatic Welcome Email

After successful subscription:

```text
POST /api/v1/newsletter/subscribe
            ↓
Validate
            ↓
Store Subscriber
            ↓
Email Service
            ↓
Welcome Email
```

Email delivery failure does not destroy the subscription record.

---

# 📢 Admin Email Campaigns

Admins can compose newsletter campaigns from the dashboard.

Features include:

- ✏️ Campaign name
- 📝 Subject
- 📧 HTML email
- 📄 Plain-text fallback
- 🧪 Test send
- 📢 Broadcast
- 👥 Active subscriber targeting
- 📊 Delivery statistics

Campaign status can move through:

```text
DRAFT
   ↓
SENDING
   ↓
SENT
```

Failures are tracked independently.

---

# 🔗 Email Personalization

Campaign emails support recipient-specific values such as:

```text
{{EMAIL}}
{{UNSUBSCRIBE_URL}}
```

Each recipient receives their own generated email content.

---

# 🚪 Secure Unsubscribe

Newsletter emails include unsubscribe support using cryptographically verified tokens.

The unsubscribe architecture uses:

```text
HMAC verification
+
SHA-256 token storage
```

rather than exposing database IDs as authorization.

Unsubscribed users are excluded from future marketing broadcasts.

---

# 📧 Pluggable Email Architecture

Estate supports multiple email transports.

```text
                 Email Service
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
     Nodemailer                 Resend
        SMTP                  HTTPS API
          │                       │
          └───────────┬───────────┘
                      ▼
                  Recipient
```

Select the provider using:

```env
EMAIL_PROVIDER=smtp
```

or:

```env
EMAIL_PROVIDER=resend
```

This allows HTTPS-based email delivery when a hosting provider restricts outbound SMTP.

---

# 📊 Email Delivery Ledger

Every outbound message can be tracked through the delivery system.

Delivery records include information such as:

```text
recipient
subject
status
provider
provider message ID
error
createdAt
sentAt
```

Possible outcomes:

```text
SENT
FAILED
```

This means a campaign does not simply claim success—the system records actual provider results.

---

# 🏗️ Architecture

```text
                    ┌────────────────────────────┐
                    │        React 19 SPA        │
                    │ Vite · TS · Tailwind · GSAP│
                    └─────────────┬──────────────┘
                                  │
                               HTTPS
                                  │
                                  ▼
                    ┌────────────────────────────┐
                    │      Express 5 REST API    │
                    │          /api/v1           │
                    └─────────────┬──────────────┘
                                  │
               ┌──────────────────┼──────────────────┐
               │                  │                  │
               ▼                  ▼                  ▼
          Zod Validation       JWT/RBAC          Services
                                                     │
                     ┌───────────────────────────────┼──────────────┐
                     │                               │              │
                     ▼                               ▼              ▼
                Drizzle ORM                    Cloudinary       Email
                     │                               │              │
                     ▼                               ▼         ┌────┴────┐
             PostgreSQL / Neon                    Media       SMTP    Resend
```

---

# 🔄 Request Lifecycle

A typical authenticated API request follows:

```text
React
  ↓
HTTP Client
  ↓
Express Router
  ↓
Authentication Middleware
  ↓
Authorization / Ownership
  ↓
Zod Validation
  ↓
Controller
  ↓
Service
  ↓
Drizzle ORM
  ↓
PostgreSQL
  ↓
Serializer
  ↓
JSON Response
```

This separation keeps HTTP handling, business logic, security, and persistence independent.

---

# 🗄️ Data Layer

Estate uses:

```text
PostgreSQL
    +
Neon
    +
Drizzle ORM
    +
postgres.js
```

The database handles data including:

- Users
- Refresh tokens
- Properties
- Property images
- Amenities
- Agents
- Favorites
- Viewings
- Inquiries
- CMS content
- Newsletter subscribers
- Campaigns
- Email deliveries
- Agent communication

For deeper database documentation, see:

[`server/README.md`](server/README.md)

---

# 🗃️ Project Structure

```text
.
├── assets/
│   └── techstack.png
│
├── src/
│   ├── admin/
│   ├── agent/
│   ├── components/
│   ├── context/
│   ├── pages/
│   └── services/
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── db/
│   │   │   ├── migrations/
│   │   │   └── schema/
│   │   ├── errors/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── services/
│   │       └── email/
│   └── tests/
│
├── shared/
├── .github/
│   └── workflows/
├── .env.example
├── render.yaml
├── vitest.config.js
├── vite.config.ts
├── CLAUDE.md
└── AGENTS.md
```

---

# 🚀 Quick Start

## 1️⃣ Install dependencies

```bash
pnpm install
```

## 2️⃣ Create environment file

```bash
cp .env.example .env
```

Configure at minimum:

```env
DATABASE_URL=
JWT_SECRET=
UNSUBSCRIBE_SECRET=
```

## 3️⃣ Run migrations

```bash
pnpm db:migrate
```

## 4️⃣ Seed development data

```bash
pnpm db:seed
```

## 5️⃣ Start frontend

```bash
pnpm dev
```

## 6️⃣ Start backend

```bash
pnpm dev:server
```

Frontend development:

```text
http://localhost:8443
```

Backend:

```text
http://localhost:4000
```

---

# 🎭 Mock-First Development

When:

```env
VITE_API_URL
```

is not configured, the frontend can operate against its browser-based mock layer.

To connect the real backend:

```env
VITE_API_URL=http://localhost:4000
```

The application appends:

```text
/api/v1
```

where required.

---

# 🔐 Environment Variables

## 🗄️ Database

```env
DATABASE_URL=
```

Use the Neon pooled PostgreSQL connection URL.

Production should use SSL according to the Neon configuration.

---

## 🔐 Authentication

```env
JWT_SECRET=
UNSUBSCRIBE_SECRET=
```

Use long, randomly generated secrets.

Production fails closed when required security configuration is missing.

---

## 📧 Email Provider

```env
EMAIL_PROVIDER=log
```

Supported modes:

```text
log
smtp
resend
```

`log` is useful for development.

---

## 📮 SMTP

```env
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASS=

SMTP_FROM_EMAIL=
SMTP_FROM_NAME=
```

For STARTTLS:

```env
SMTP_PORT=587
SMTP_SECURE=false
```

For implicit TLS:

```env
SMTP_PORT=465
SMTP_SECURE=true
```

> ⚠️ Some cloud hosting platforms restrict outbound SMTP. Estate can switch to the Resend HTTPS transport without changing newsletter or agent business logic.

---

## 🚀 Resend

```env
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_FROM_NAME=
```

Production senders should follow the provider's domain verification requirements.

---

## ☁️ Cloudinary

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

All secrets remain server-side.

---

## 🌐 Application

```env
VITE_API_URL=
CORS_ORIGINS=
APP_NAME=
API_VERSION=
EMAIL_BASE_URL=
```

`CORS_ORIGINS` accepts approved browser origins.

---

# 🔒 Environment Security

Never expose backend credentials through:

```text
VITE_*
```

Sensitive values include:

```text
DATABASE_URL
JWT_SECRET
UNSUBSCRIBE_SECRET
SMTP_PASS
RESEND_API_KEY
CLOUDINARY_API_SECRET
```

Environment files are ignored by Git.

```text
.env
.env.local
.env.production
```

should never be committed with real credentials.

---

# 🎯 Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | ⚡ Start Vite frontend |
| `pnpm dev:server` | ⚙️ Start backend with hot reload |
| `pnpm test` | 🧪 Run backend test suite |
| `pnpm typecheck` | 🟦 Run TypeScript checks |
| `pnpm format` | 🧹 Format server code |
| `pnpm build` | 📦 Build production frontend |
| `pnpm db:migrate` | 🗄️ Apply Drizzle migrations |
| `pnpm db:seed` | 🌱 Seed development data |
| `pnpm db:studio` | 🔬 Open Drizzle Studio |
| `pnpm db:test:prepare` | 🧪 Prepare isolated test database |

---

# 🧪 Testing

Estate uses:

```text
Vitest
+
Supertest
+
Isolated PostgreSQL Test Database
```

Current suite:

```text
16 test files
233 tests passing
```

Run:

```bash
pnpm db:test:prepare
pnpm test
```

---

## 🔬 What Is Tested?

The suite covers areas including:

### 🔐 Authentication

- Registration
- Login
- JWT authentication
- Refresh rotation
- Revocation
- Token-family reuse detection

### 🛡️ Authorization

- Admin boundaries
- Agent boundaries
- User ownership
- Cross-agent access denial
- Cross-user access denial

### 🏠 Real Estate

- Property APIs
- Filters
- Viewings
- Inquiries
- Favorites

### 📬 Newsletter

- Subscription
- Duplicate handling
- Unsubscribe
- Campaign privacy
- Recipient deduplication

### 📧 Email

- Provider selection
- SMTP configuration
- `SMTP_SECURE` boolean parsing
- Provider outages
- Resend HTTP transport
- `SENT` persistence
- `FAILED` persistence

No real production emails are required during automated testing.

---

# 🤖 CI/CD

GitHub Actions validates the project before deployment.

```text
Developer
    ↓
git push
    ↓
GitHub
    ↓
GitHub Actions
    ├── Typecheck
    ├── Tests
    └── Build
    ↓
Render
    ↓
Production
```

This helps prevent broken builds from reaching production.

---

# 🚢 Deployment

Estate uses:

```text
Frontend → Render Static Site
Backend  → Render Web Service
Database → Neon PostgreSQL
Media    → Cloudinary
Email    → SMTP / Resend
```

Deployment configuration is defined in:

```text
render.yaml
```

---

## 1️⃣ Backend

Build:

```bash
pnpm install --frozen-lockfile
```

Start:

```bash
node server/index.js
```

Health endpoint:

```text
/api/health
```

Required production configuration includes:

```env
DATABASE_URL=
JWT_SECRET=
UNSUBSCRIBE_SECRET=
CORS_ORIGINS=
```

plus the selected email/media configuration.

---

## 2️⃣ Verify Backend

Test:

```text
GET https://<backend>.onrender.com/api/health
```

Expected:

```text
200 OK
```

Database health should report a successful connection.

---

## 3️⃣ Frontend

Build:

```bash
pnpm install --frozen-lockfile && pnpm run build
```

Publish:

```text
dist/
```

Configure:

```env
VITE_API_URL=https://<backend>.onrender.com
```

SPA rewrite:

```text
/* → /index.html
```

---

## 4️⃣ CORS

Backend:

```env
CORS_ORIGINS=https://<frontend>.onrender.com
```

The frontend origin—not the API path—should be used.

---

# 🔥 Production Smoke Test

After deployment verify:

```text
API Health                         ✅
Database                           ✅

Property Catalog                   ✅
Property Detail                    ✅
Search / Filters                   ✅

Register                           ✅
Login                              ✅
Refresh                            ✅
Logout                             ✅
/me                                ✅

Favorites                          ✅
Viewing Requests                   ✅
Inquiries                          ✅

Admin Dashboard                    ✅
CMS                                ✅
Property Management                ✅

Agent Login                        ✅
Assigned Leads                     ✅
Agent → Client Authorization       ✅

Newsletter Subscribe               ✅
Welcome Email                      ✅
Admin Campaign                     ✅
Email Delivery Ledger              ✅
Agent → Client Email               ✅

Cloudinary Upload                  ✅
```

---

# 📈 Engineering Highlights

Estate demonstrates more than CRUD.

It includes:

- 🏗️ Layered full-stack architecture
- 🔐 JWT + rotating refresh-token authentication
- 🔑 Argon2id password hashing
- 🛡️ Backend RBAC
- 🔒 Ownership-based authorization
- 🧑‍💼 Agent-specific data isolation
- 🏠 Real-estate marketplace workflows
- 📅 Viewing management
- 💬 Inquiry/lead workflows
- 📝 Database-backed CMS
- ☁️ Signed Cloudinary media
- 📬 Newsletter subscriptions
- 📢 Admin email campaigns
- ✉️ Agent/client communication
- 🔌 Pluggable email providers
- 📊 Delivery auditing
- 🧬 Type-safe Drizzle persistence
- 🛡️ Strict Zod validation
- 🧪 233 automated tests
- 🤖 CI/CD
- 🚀 Production deployment

---

# 📚 Documentation

| Resource | Description |
| --- | --- |
| [`server/README.md`](server/README.md) | 🗄️ Backend, database, migrations, indexes and API architecture |
| [`.env.example`](.env.example) | 🔐 Environment configuration reference |
| [`render.yaml`](render.yaml) | 🚀 Render infrastructure configuration |
| [`CLAUDE.md`](CLAUDE.md) | 🤖 AI development context |
| [`AGENTS.md`](AGENTS.md) | 🧠 Agent development instructions |

---

# 🧠 Engineering Philosophy

Estate was designed around a simple principle:

> **The frontend presents the experience. The backend owns the rules. The database protects the data.**

Security-critical decisions such as authorization, ownership, lead isolation, email recipients, token validation, and role access are enforced server-side.

---

# 🏁 Project Status

```text
Frontend                 ✅
REST API                 ✅
PostgreSQL               ✅
Authentication           ✅
Refresh Rotation         ✅
RBAC                     ✅
Properties               ✅
Favorites                ✅
Viewings                 ✅
Inquiries                ✅
Admin Console            ✅
CMS                      ✅
Agent Portal             ✅
Lead Management          ✅
Cloudinary               ✅
Newsletter               ✅
Email Campaigns          ✅
Agent Email              ✅
Email Provider Fallback  ✅
Automated Tests          ✅
CI/CD                    ✅
Production Deployment    ✅
```

---

## 🏛️ Estate

**Modern real estate. Production-minded engineering.**

Built with ⚛️ React · 🟢 Node.js · 🚂 Express · 🐘 PostgreSQL · 🧬 Drizzle · ⚡ Neon · ☁️ Cloudinary · 📧 Nodemailer / Resend.
