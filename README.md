# 🏛️ Estate — Luxury Real Estate Platform

> A full-stack real-estate marketplace for Jeddah 🇸🇦 — fast React frontend, a
> hardened Express API, and a hosted PostgreSQL database. Built and previewed
> inside **Figma Make**, deployed on **Render**, powered by **Neon**.

![badges](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![badges](https://img.shields.io/badge/Express-5-000000?logo=express)
![badges](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![badges](https://img.shields.io/badge/Tailwind%20CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![badges](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![badges](https://img.shields.io/badge/Drizzle-0.45-C5F74F?logo=drizzle)
![badges](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)
![badges](https://img.shields.io/badge/Tests-233%20passing-3A7D44)

---

## 🧰 Tech Stack

<img
  src="assets/techstack.png"
  alt="Estate technology stack diagram"
  width="900"
/>

| Layer | Tools |
| --- | --- |
| 🖥️ **Frontend** | ⚛️ React 19 · ⚡ Vite 8 · 🟦 TypeScript 5.7 · 🎨 Tailwind CSS v4 · 🧭 React Router 7 · 🎬 GSAP |
| ⚙️ **Backend** | 🟢 Node.js 22 · 🚂 Express 5 · 🛡️ Zod 4 · 🔐 JWT + Argon2id · 📧 Nodemailer / Resend |
| 🗄️ **Data** | 🐘 PostgreSQL on Neon · 🧬 Drizzle ORM · postgres.js driver |
| 🚀 **Platform** | ☁️ Cloudinary media · 🤖 GitHub Actions CI · 📦 pnpm · 🎨 Figma Make |

---

## ✨ Features

**🏠 Public site**
- Property catalog with filters (purpose, type, city, price, beds) · word-boundary search · 4 sort modes · offset pagination
- Property detail pages, neighborhoods, agents directory, about & contact
- Sign-up / login / saved favorites ⭐ / viewing requests 📅 / property inquiries 💬

**🔐 Auth & security**
- Argon2id password hashing, dependency-free HS256 JWTs (15-min TTL)
- **Rotating refresh tokens** — only SHA-256 hashes stored; reuse detection revokes the whole family
- Strict Zod validation (`422 INVALID_QUERY` on typos), role-gated mutations, fail-closed production boot

**🛠️ Admin console**
- Dashboard with live aggregates (users, properties, agents, **newsletter & email delivery stats**)
- Content CMS, agent manager, user directory, media (Cloudinary signed uploads + orphan sweeps)
- Newsletter subscribers, campaign composer (**test send / broadcast**), delivery history

**🧑‍💼 Agent portal**
- Per-agent inbox with assigned leads, inquiry conversation, status workflow
- Email leads directly — strict RBAC scoping (Agent A ↛ Agent B's leads), every send double-logged

**✉️ Newsletter & email**
- Subscribe/unsubscribe with HMAC-verified single-use tokens (SHA-256 only)
- Welcome email, per-recipient campaign personalization ({{EMAIL}}, {{UNSUBSCRIBE_URL}})
- **Pluggable transport**: `smtp` (Nodemailer) or `resend` (HTTP API fallback) — one `EMAIL_PROVIDER` switch
- Honest `email_deliveries` ledger: `SENT` / `FAILED` + provider message ID, never blocks on a dead relay

---

## 🗺️ Architecture

```text
 React SPA (Vite)  ──HTTPS──▶  Express REST API (/api/v1)
        │                            │            │
        │                       Zod validate   Role + JWT guards
        ▼                            ▼            ▼
  Tailwind · Router            Service layer → Drizzle ORM
        │                            │
        ▼                            ▼
   Figma Make preview         PostgreSQL · Neon (DATABASE_URL)
                                     │
                    Cloudinary ☁ (images) · Email 📧 (SMTP/Resend)
```

For the full backend story (tables, indexes, auth model, migrations, EXPLAIN plans) see
[`server/README.md`](server/README.md).

## 🗃️ Project layout

```text
.
├── assets/tech-stack.svg   ← this README's stack diagram
├── src/                    ← React frontend (mock-first; remote when VITE_API_URL set)
│   ├── pages/              · admin/ · agent/ · components/ · services/ · context/
├── server/                 ← Express API + tests
│   ├── src/db/             (schema, migrations) · routes/ · controllers/ · services/
│   └── tests/              Vitest + Supertest suites
├── shared/                 demo/design data
├── .github/workflows/      CI (typecheck → test → build)
├── render.yaml             Render Blueprint (backend + static frontend)
├── vitest.config.js
└── vite.config.ts
```

---

## 🚀 Quick start

```bash
pnpm install                    # install everything
cp .env.example .env            # set DATABASE_URL (Neon), JWT_SECRET
pnpm db:migrate                 # apply migrations         (pg)
pnpm db:seed                    # idempotent demo dataset
pnpm dev                        # frontend dev server (port 8443 · Figma preview)
pnpm dev:server                 # API on port 4000 (or $PORT)
```

The frontend runs against an in-browser **mock** when `VITE_API_URL` is unset.
Point `VITE_API_URL` at the API root to go live — the app appends `/api/v1` itself.

## 🔐 Environment variables

| Group | Variable | Notes |
| --- | --- | --- |
| 🗄️ DB | `DATABASE_URL` | Neon pooled URL (prefer `?sslmode=require`) |
| 🔐 Auth | `JWT_SECRET` · `UNSUBSCRIBE_SECRET` | long random values; production refuses to boot without them |
| 📧 Email | `EMAIL_PROVIDER` | `log` (dev) · `smtp` · `resend` |
| 📧 SMTP | `SMTP_HOST` `SMTP_PORT` `SMTP_SECURE` `SMTP_USER` `SMTP_PASS` `SMTP_FROM_EMAIL` `SMTP_FROM_NAME` | `587 + SMTP_SECURE=false` = STARTTLS; `465 + true` = implicit TLS |
| 📧 Resend | `RESEND_API_KEY` `RESEND_FROM_EMAIL` `RESEND_FROM_NAME` | HTTPS fallback when SMTP egress is blocked; From must be a verified domain |
| ☁️ Media | `CLOUDINARY_CLOUD_NAME` `CLOUDINARY_API_KEY` `CLOUDINARY_API_SECRET` | secrets stay server-side (never `VITE_`-prefixed) |
| 🌐 App | `VITE_API_URL` · `CORS_ORIGINS` · `APP_NAME` · `API_VERSION` | `CORS_ORIGINS` = comma-separated browser origins |

🔒 Credentials are **never** committed (`*.env` git-ignored) and never exposed to the browser.

## 🎯 Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server (port 8443) |
| `pnpm dev:server` | API with hot reload |
| `pnpm test` | full backend suite (233 tests) |
| `pnpm typecheck` | `tsc --noEmit` across the app |
| `pnpm format` | oxfmt on `server/` |
| `pnpm build` | production frontend build |
| `pnpm db:migrate` / `db:seed` / `db:studio` | Drizzle migrations, seed, Studio UI |

## 🧪 Testing

Vitest + Supertest against an **isolated `estate_test` DB** (never production):

```bash
pnpm db:test:prepare     # migrate + seed the isolated test database
pnpm test                # 16 files · 233 tests
```

Highlights: auth rotation/revocation · RBAC boundaries (cross-agent + cross-user
denied) · viewing + inquiry workflows · campaign privacy & dedupe · email transport
outage resilience · `SMTP_SECURE` boolean parsing · provider selection · mocked
Resend HTTP transport · `SENT`/`FAILED` ledger persistence.

## 🚢 Deployment (Render + Neon)

[`render.yaml`](render.yaml) declares both services. Create the **backend first**:

1. **Backend Web Service** — build `pnpm install --frozen-lockfile`, start `node server/index.js`,
   health `/api/health`; set `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`.
2. Confirm `GET https://<backend>.onrender.com/api/health` → `200`
   (`checks.db: connected`).
3. **Frontend Static Site** — build `pnpm install --frozen-lockfile && pnpm run build`,
   publish `dist/`, SPA rewrite `/* → /index.html`; set `VITE_API_URL=https://<backend>.onrender.com`.
4. Set backend `CORS_ORIGINS` to the frontend origin.

Production smoke checks: health · catalog → detail · register/login/refresh/logout/me ·
favorites save/unsave · viewing create/list · newsletter subscribe → welcome ·
admin campaign broadcast → `SENT` ledger rows · agent → lead email.

## 📚 Reference

- [`server/README.md`](server/README.md) — database architecture, API phases, tables, indexes, migrations
- [`.env.example`](.env.example) — every variable documented
- [`render.yaml`](render.yaml) — Render Blueprint (backend + frontend, `sync: false` secrets)
- [`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md) — working notes for AI assistants
