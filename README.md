# Estate

Full-stack real-estate application: React + Vite + Tailwind frontend with a
Node.js + Express REST API (`/api/v1`), Drizzle ORM, and PostgreSQL hosted on
Neon.

- Frontend: `src/` (React 19, Vite 8, Tailwind CSS v4, React Router 7)
- Backend: `server/` (Express 5, Drizzle ORM, postgres.js, Zod, JWT auth)
- Database: PostgreSQL on Neon (migrations, never `drizzle-kit push` in prod)
- Tests: `server/tests/**/*.test.mjs` via Vitest + Supertest against an
  isolated `estate_test` database

## Local development

```bash
pnpm install
cp .env.example .env        # set DATABASE_URL (Neon), JWT_SECRET
pnpm db:migrate             # apply migrations
pnpm db:seed                # idempotent demo dataset
pnpm db:test:prepare        # migrate + seed the isolated estate_test DB
pnpm dev                    # Vite dev server (port 8443, Figma preview)
pnpm dev:server             # backend on PORT (default 4000)
pnpm test                   # full backend suite (requires DATABASE_URL)
pnpm typecheck
```

The frontend runs against an in-browser mock when `VITE_API_URL` is unset
(the Figma Make preview default). Set `VITE_API_URL` to the backend root URL
to use the real API — the app appends `/api/v1` itself.

## Production Deployment — Render + Neon

Both the React frontend (Static Site) and the Express backend (Web Service)
deploy to Render. PostgreSQL stays on Neon — nothing else is introduced.

### Architecture

```text
GitHub
   │
   ├── GitHub Actions CI
   │
   ↓
Render
├── React frontend  (static site, SPA rewrite to index.html)
│         │
│         ↓ HTTPS (VITE_API_URL)
└── Express REST API  (web service, /api/v1)
          │
          ↓
     Drizzle ORM
          │
          ↓
PostgreSQL / Neon   (DATABASE_URL)
```

### GitHub connection

1. Initialize the repo (`git init`), commit, and push to a GitHub remote.
   Push to the branch referenced below (`main`).
2. Add the `DATABASE_URL` repository secret (Settings → Secrets and
   variables → Actions). CI uses it only to prepare the isolated
   `estate_test` database — the production database is never touched.
3. GitHub Actions (`.github/workflows/ci.yml`) runs on every push and PR:
   `pnpm install --frozen-lockfile` → typecheck → test-db prepare → tests →
   frontend build. All must pass before merge.

### Backend Web Service (create first)

| Setting | Value |
| --- | --- |
| Service Type | Web Service |
| Root Directory | `.` |
| Build Command | `pnpm install --frozen-lockfile` |
| Start Command | `node server/index.js` |
| Health Check Path | `/api/health` |
| Runtime | Node (`node` version 22) |

Environment variables (set in the Render Dashboard; `.env.example` lists
names):

```text
NODE_ENV=production
PORT                  (assigned automatically by Render — do not set)
DATABASE_URL          (Neon PostgreSQL connection string)
JWT_SECRET            (long random secret)
CORS_ORIGINS          (deployed frontend origin, comma-separated)
APP_NAME=estate-api   (optional)
API_VERSION=v1        (optional)
```

`PORT`, `NODE_ENV`, `JWT_SECRET` and `CORS_ORIGINS` behavior:

- The server binds the Render-supplied `PORT` (`server/index.js`); local dev
  still defaults to `4000`.
- `NODE_ENV=production` makes the server refuse to boot without `JWT_SECRET`
  and `CORS_ORIGINS` (no wildcard, no missing CORS) — fail-closed.

### Frontend Static Site (create second)

| Setting | Value |
| --- | --- |
| Service Type | Static Site |
| Root Directory | `.` |
| Build Command | `pnpm install --frozen-lockfile && pnpm run build` |
| Publish Directory | `dist` |
| SPA Routing | Rewrite `/*` → `/index.html` (see `render.yaml`) |

Environment variables:

```text
VITE_API_URL=https://<your-backend-name>.onrender.com
```

`VITE_API_URL` is public configuration (an API base URL): it takes the
backend **root** URL with no `/api/v1` suffix — `src/services/api.ts` appends
`/api/v1` automatically. Production never falls back to the mock layer;
mock mode only applies when `VITE_API_URL` is unset.

### Deployment order (URLs depend on each other)

1. GitHub repository ready; CI green.
2. Create the Render **backend** Web Service; set `DATABASE_URL`, `JWT_SECRET`,
   and a temporary `CORS_ORIGINS` (or leave it for after step 9).
3. Confirm `GET https://<backend>/api/health` returns `200` with
   `checks.db: "connected"` (proves Render → Neon).
4. Note the backend URL, e.g. `https://estate-api.onrender.com`.
5. Create the Render **frontend** Static Site; set
   `VITE_API_URL=https://estate-api.onrender.com`.
6. Note the frontend URL, e.g. `https://estate-frontend.onrender.com`.
7. Update the backend `CORS_ORIGINS` to the frontend URL
   (`https://estate-frontend.onrender.com`) — no wildcard; the backend
   redeploys automatically on env change.
8. Run the production smoke test plan below.

### Render Blueprint

`render.yaml` declares both services (backend + static frontend with the SPA
rewrite and cache headers). Secrets use `sync: false` so real values are set
in the Dashboard — never in the file. If you create services from the
Blueprint instead of the Dashboard, still set the `sync: false` secrets
manually and respect the backend-first order above.

### Production smoke test plan

Backend (from a terminal, after deployment):

```text
GET  /api/health                      → 200, checks.db: connected
GET  /api/v1/properties               → 200, paginated list
GET  /api/v1/properties/:id           → 200, detail
POST /api/v1/auth/register            → 201, {user, accessToken, refreshToken}
POST /api/v1/auth/login               → 200, tokens
GET  /api/v1/auth/me                  → 200 (Bearer)
POST /api/v1/auth/refresh             → 200, rotated tokens
POST /api/v1/auth/logout              → 204 (refreshToken)
GET  /api/v1/favorites                → 200 (Bearer)
PUT  /api/v1/favorites/:id            → 200 (Bearer, property saved)
DELETE /api/v1/favorites/:id          → 204 (Bearer, unsaved)
POST /api/v1/viewings                 → 201 (Bearer)
GET  /api/v1/viewings                 → 200 (Bearer, own requests)
```

Frontend (in the browser at the deployed URL):

```text
Home loads
Properties loads from the Render API (not mock)
Property detail loads; direct URL /properties/:id
Login works
Session survives a page reload (access token persists; /me rehydrates)
401 → refresh → retry works cross-origin (Bearer flow, unaffected by CORS)
Favorites save/unsave survive across reloads
Viewing request submission works; shows on Dashboard
Dashboard lists viewings; direct URL /dashboard
Direct React Router URLs (/saved, /auth, /dashboard) load via the
/* → /index.html rewrite without 404s
```

## CI requirements

`.github/workflows/ci.yml` needs one repository secret:

- `DATABASE_URL` — a Neon connection string against the same project as the
  production database. CI copies it and swaps the database name for the
  isolated `estate_test` database (`server/src/config/test-db.js`); no
  production row is ever touched. Typecheck + frontend build always run;
  the prepare-and-test steps run only when the secret is set.

## Reference

- Backend internals: `server/README.md` (API v1 phases, tables, indexes,
  auth/session model, connection + migration workflow).
- Environment variables: `.env.example`.