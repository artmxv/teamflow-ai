# TeamFlow AI

Fullstack project workspace demo for product teams. TeamFlow AI pairs a polished SaaS-style frontend (TanStack Start + React) with a real Express API, PostgreSQL, JWT auth, and seeded demo data. Explore projects, tasks, a Kanban board, dashboard metrics, workspace settings, and a deterministic AI assistant summary, all scoped to the signed-in user's workspace.

## Demo credentials

After seeding the database (see [Local setup](#local-setup)), sign in with:

| Field    | Value              |
| -------- | ------------------ |
| Email    | `alex@teamflow.ai` |
| Password | `Password123!`     |

The seed script also loads a starter workspace with sample projects and tasks for this user.

## Preview

### Dashboard

![Dashboard](docs/screenshots/dashboard.png)

### Projects

![Projects](docs/screenshots/projects.png)

### Project detail

![Project detail](docs/screenshots/project-detail.png)

### Kanban board

![Kanban board](docs/screenshots/board.png)

### Tasks

![Tasks](docs/screenshots/tasks.png)

### AI Assistant

![AI Assistant](docs/screenshots/ai.png)

### Settings

![Settings](docs/screenshots/settings.png)

### Billing (demo preview)

![Billing](docs/screenshots/billing.png)

### Team (demo preview)

![Team](docs/screenshots/team.png)

## Feature overview

### Product shell

- Landing page with product overview sections
- Dark/light theme toggle (hydration-safe, no flash on reload)
- EN/RU language toggle (UI copy)

### Authentication (API-backed)

- Register, login, logout
- Password hashing and strong password rules on sign-up
- JWT stored in `localStorage`; `GET /api/auth/me` returns the current user and workspace
- Protected `/app/*` routes; signed-in users are redirected away from sign-in and sign-up
- Profile updates via `PATCH /api/auth/profile`

### Workspace scoping

- Projects, tasks, board, dashboard, settings, and AI summaries are scoped to the authenticated user's workspace
- New users receive starter workspace data (sample project and onboarding tasks)

### Projects (API-backed)

- List, create, edit, and delete projects
- Project detail page with workspace-scoped project and task data
- Workspace-scoped project API (`GET`, `POST`, `PATCH`, `DELETE /api/projects`)

### Tasks (API-backed)

- List, create, update status, and delete tasks
- Task drawer for details and delete
- Improved empty and no-results states

### Board (API-backed)

- Kanban-style task board by status
- Status changes persist through `PATCH /api/tasks/:id`

### Dashboard (API-backed)

- Summary metrics from `GET /api/dashboard/summary` (active projects, open/done tasks, team count)

### AI Assistant (API-backed, deterministic)

- Workspace summary built from **real** projects and tasks in PostgreSQL (no external LLM call)
- Sections: overview, highlights, risks, recommended next actions, standup summary, metrics
- Regenerate action and copy standup summary to clipboard
- **Not connected** to OpenAI, GigaChat, or any third-party AI API today. The codebase is structured so a provider can be plugged in later; summaries are rule-based and deterministic for demo reliability.

### Settings (API-backed)

- Displays real user and workspace data from auth/workspace APIs
- Saves profile settings (`PATCH /api/auth/profile`)
- Saves workspace settings (`PATCH /api/workspace`)

### Billing (demo preview only)

- UI preview of plans and usage for portfolio storytelling
- **No real payments**, no Stripe integration, and no payment processor webhooks

### Team (demo preview only)

- UI preview of members and roles
- **No real invites or removals** are sent; member actions are illustrative only

## Tech stack

| Layer    | Technologies                                                             |
| -------- | ------------------------------------------------------------------------ |
| Frontend | TanStack Start, React 19, TypeScript, TanStack Router, TanStack Query    |
| UI       | Tailwind CSS v4, shadcn/ui-style components (Radix UI), Recharts, Sonner |
| Forms    | React Hook Form, Zod                                                     |
| Backend  | Express, TypeScript, Zod validation                                      |
| Data     | Prisma ORM, PostgreSQL (Docker Compose locally)                          |
| Auth     | JWT (`jsonwebtoken`), `bcryptjs` password hashing                        |

## Architecture

```text
Browser (TanStack Start + React)
        |
        |  HTTP + JWT (TanStack Query, src/lib/api/)
        v
Express REST API  (/api/*)
        |
        +-- requireAuth middleware -> workspace context (user's workspaceId)
        |
        |  Prisma
        v
PostgreSQL (Docker, port 5433)
```

### Frontend (`src/`)

- File-based routes under `src/routes/`; marketing pages and `/app/*` workspace shell
- API client in `src/lib/api/`; default base URL `http://localhost:4000` (override with `VITE_API_URL`)
- Auth token in `localStorage`; route guards on `/app/*`

### Backend (`server/`)

- Express app mounts routers under `/api`
- Services use Prisma; controllers validate with Zod
- `requireAuth` attaches `userId`; workspace-scoped handlers resolve the user's workspace before reads/writes
- Task attachments and project documents are stored under `server/uploads/` (local disk, gitignored). Files are uploaded with Multer and downloaded only through authenticated routes (`GET .../file`), not via a public static directory

### Database (`server/prisma/`)

- Schema, migrations, and seed (`server/prisma/seed.ts`)
- Relations tie users, workspaces, projects, and tasks

### Auth and workspace scoping

1. User registers or logs in; API returns a JWT.
2. Frontend sends `Authorization: Bearer <token>` on protected requests.
3. Middleware validates the token and loads `userId`.
4. Workspace context service maps the user to a single workspace; list/create/update/delete operations filter by `workspaceId`.

### AI summary flow

1. User opens AI Assistant or clicks regenerate.
2. Frontend calls `POST /api/ai/workspace-summary` (authenticated).
3. `ai.service` loads the workspace's projects and tasks from PostgreSQL, computes metrics (open tasks, overdue, priorities, and so on).
4. Service builds deterministic text blocks (overview, highlights, risks, actions, standup).
5. JSON response is rendered in the UI; no outbound call to OpenAI, GigaChat, or other LLM providers.

Typical local ports: frontend **8080**, API **4000**, Postgres **5433**.

## API endpoints

| Method | Path                        | Description                        |
| ------ | --------------------------- | ---------------------------------- |
| GET    | `/api/health`               | Health check                       |
| POST   | `/api/auth/register`        | Register (email/password)          |
| POST   | `/api/auth/login`           | Sign in                            |
| GET    | `/api/auth/me`              | Current user and workspace         |
| PATCH  | `/api/auth/profile`         | Update profile                     |
| POST   | `/api/auth/logout`          | Sign out                           |
| GET    | `/api/projects`             | List workspace projects            |
| POST   | `/api/projects`             | Create project                     |
| PATCH  | `/api/projects/:id`         | Update project                     |
| DELETE | `/api/projects/:id`         | Delete project                     |
| GET    | `/api/tasks`                | List workspace tasks               |
| POST   | `/api/tasks`                | Create task                        |
| PATCH  | `/api/tasks/:id`            | Update task (e.g. status)          |
| DELETE | `/api/tasks/:id`            | Delete task                        |
| GET    | `/api/dashboard/summary`    | Dashboard summary metrics          |
| PATCH  | `/api/workspace`            | Update workspace settings          |
| POST   | `/api/ai/workspace-summary` | Deterministic workspace AI summary |

## Local setup

**Prerequisites:** Node.js 20+, npm, Docker (for PostgreSQL).

### 1. Install dependencies

From the repository root:

```bash
npm install
```

Backend dependencies:

```bash
cd server
npm install
```

### 2. Configure environment

**Backend (required)**

```bash
cd server
cp .env.example .env
```

Edit `server/.env` as needed:

| Variable       | Local default                 | Notes                                             |
| -------------- | ----------------------------- | ------------------------------------------------- |
| `DATABASE_URL` | Matches Docker Compose below  | Required for Prisma migrations, seed, and the API |
| `JWT_SECRET`   | Placeholder in `.env.example` | Change before shared or production-like use       |
| `CORS_ORIGIN`  | `http://localhost:8080`       | Must match the URL where you open the frontend    |
| `PORT`         | `4000`                        | API listen port                                   |
| `NODE_ENV`     | `development`                 | Use `production` when deploying the API           |

**Frontend (optional)**

Only if the API is not at `http://localhost:4000`, from the repository root:

```bash
cp .env.example .env
```

Set `VITE_API_URL` to your API base URL (for example `https://api.example.com`). If you skip this step, the app uses `http://localhost:4000`.

### 3. Start database, migrate, and seed

```bash
cd server
docker compose up -d
npm run prisma:migrate
npm run db:seed
```

### 4. Run backend and frontend

API (keep this terminal open):

```bash
cd server
npm run dev
```

Frontend (second terminal, from repository root):

```bash
npm run dev
```

Open the app at [http://localhost:8080](http://localhost:8080). The API runs at [http://localhost:4000](http://localhost:4000).

Sign in with [demo credentials](#demo-credentials): `alex@teamflow.ai` / `Password123!`

## Environment variables

Example files (safe to commit; no real secrets):

| File                  | Purpose                                                 |
| --------------------- | ------------------------------------------------------- |
| `server/.env.example` | Required backend variables for local dev and deployment |
| `.env.example`        | Optional frontend `VITE_API_URL`                        |

Copy each to `.env` in the same directory and edit. Never commit `server/.env` or a filled-in root `.env` with deployment-specific values.

### Backend (`server/.env`)

Validated at API startup in `server/src/config/env.ts`. Prisma reads `DATABASE_URL` from the environment separately.

| Variable                    | Required | Description                                                    |
| --------------------------- | -------- | -------------------------------------------------------------- |
| `DATABASE_URL`              | Yes      | PostgreSQL connection string for Prisma                        |
| `JWT_SECRET`                | Yes      | Secret for signing JWTs                                        |
| `PORT`                      | No       | API port (default `4000`)                                      |
| `NODE_ENV`                  | No       | `development`, `test`, or `production` (default `development`) |
| `CORS_ORIGIN`               | No       | Frontend origin for CORS (default `http://localhost:8080`)     |
| `FILE_STORAGE_DRIVER`       | No       | `local` (default) or `supabase` for durable uploads            |
| `SUPABASE_URL`              | If supabase | Example: `https://your-project-ref.supabase.co`             |
| `SUPABASE_SERVICE_ROLE_KEY` | If supabase | Example: `your-supabase-service-role-key` (never commit)    |
| `SUPABASE_STORAGE_BUCKET`   | If supabase | Example: `teamflow-uploads`                                 |

Example `DATABASE_URL` for local Docker Compose:

```text
postgresql://teamflow:teamflow@localhost:5433/teamflow_ai?schema=public
```

### Frontend (optional, repo root `.env`)

| Variable       | Required | Description                                                               |
| -------------- | -------- | ------------------------------------------------------------------------- |
| `VITE_API_URL` | No       | API base URL if not `http://localhost:4000` (see `src/lib/api/client.ts`) |

No Stripe, OpenAI, or other third-party API keys are required for the current feature set.

### File uploads (local disk)

- Upload root: `server/uploads/tasks/` and `server/uploads/projects/` (see `server/src/lib/task-upload.ts` and `project-upload.ts`).
- **Max file size:** 10 MB per file for project documents and task attachments (enforced on the frontend and via Multer on the API).
- The folder is in `.gitignore`; do not commit uploaded files.
- **Production:** many PaaS containers use an **ephemeral filesystem**. Uploads disappear on redeploy unless you mount persistent volume storage at `server/uploads` (or run on a VM with a persistent disk). Cloud object storage (S3, R2, and similar) is **not** implemented in this repo.
- There is no `UPLOAD_DIR` env variable today; paths are relative to the API process working directory (`server/` when you run `npm run start` from `server/`).

## Deployment

Portfolio-ready deploy: Vercel (frontend), Render (API), Neon (PostgreSQL), Resend (email). Full step-by-step setup: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

**Render free tier:** the API may **cold start** after idle time (often 30–60 seconds on first request). The UI shows skeleton loaders and friendly “Starting workspace…” copy while the backend wakes up, with retry buttons if a request fails temporarily.

**Also see:**

- [QA checklist](docs/QA_CHECKLIST.md)

### Deployment checklist

Use this before going live:

- [ ] Create a **PostgreSQL** database and copy the connection string into `DATABASE_URL` in `server/.env` (or your host’s secret store).
- [ ] Set **`JWT_SECRET`** to a long random value (not `change-me-in-production` from `.env.example`).
- [ ] Set **`CORS_ORIGIN`** to the exact frontend origin (scheme + host + port if non-default), e.g. `https://app.example.com`.
- [ ] From `server/`, run **`npm run prisma:migrate:deploy`** (non-interactive; applies committed migrations).
- [ ] Optionally run **`npm run db:seed`** for demo data only (not for a real production tenant).
- [ ] Build the API: `npm run build` in `server/`, then start with **`npm run start`** and **`NODE_ENV=production`**.
- [ ] Set **`PORT`** if your platform does not inject it (default `4000`).
- [ ] At the **repo root**, set **`VITE_API_URL`** to the public API URL, then **`npm run build`** for the frontend.
- [ ] Serve the frontend build output from your static host or SSR platform.
- [ ] **Upload storage:** ensure `server/uploads` persists across deploys, or accept that local attachments/documents will be lost on redeploy until object storage is added.

### Backend environment (`server/.env`)

| Variable                    | Required            | Production notes                                      |
| --------------------------- | ------------------- | ----------------------------------------------------- |
| `DATABASE_URL`              | Yes                 | PostgreSQL URL for Prisma                             |
| `JWT_SECRET`                | Yes                 | Strong secret; never commit                           |
| `CORS_ORIGIN`               | No (default local)  | Must match deployed frontend origin                   |
| `PORT`                      | No (default `4000`) | Often set by the host                                 |
| `NODE_ENV`                  | No                  | Use `production` when deployed                        |
| `FILE_STORAGE_DRIVER`       | No (default local)  | Use `supabase` on Render for uploads that survive redeploy |
| `SUPABASE_URL`              | If supabase         | `https://your-project-ref.supabase.co`                |
| `SUPABASE_SERVICE_ROLE_KEY` | If supabase         | `your-supabase-service-role-key`; never commit        |
| `SUPABASE_STORAGE_BUCKET`   | If supabase         | `teamflow-uploads`                                    |

Validated at startup in `server/src/config/env.ts`. Prisma also requires `DATABASE_URL` (documented in `server/.env.example`).

**Migrate (production):**

```bash
cd server
npm install
npm run prisma:generate
npm run prisma:migrate:deploy
```

Use `npm run prisma:migrate` only for **local development** (interactive `migrate dev`). Do not edit applied migration history on a live database.

**Start API:**

```bash
cd server
npm run build
NODE_ENV=production npm run start
```

### Frontend environment (repo root `.env`)

| Variable       | Required   | Production notes                                                        |
| -------------- | ---------- | ----------------------------------------------------------------------- |
| `VITE_API_URL` | No locally | **Required at build time** if the API is not at `http://localhost:4000` |

```bash
# from repository root — example
echo 'VITE_API_URL=https://api.example.com' >> .env
npm run build
```

Vite embeds `VITE_*` values into the client bundle. Rebuild after changing the API URL.

### Not required for current features

- **AI Assistant:** deterministic summaries from PostgreSQL; no OpenAI, GigaChat, or other LLM API keys.
- **Billing (demo):** UI only; no Stripe or payment webhooks.
- **Cloud file storage:** set `FILE_STORAGE_DRIVER=supabase` on the API for durable uploads (see `docs/DEPLOYMENT.md`). Default local dev uses disk under `server/uploads/`.

## Database commands

From `server/`:

```bash
docker compose up -d           # Start Postgres
npm run prisma:migrate         # Apply migrations (local dev)
npm run prisma:migrate:deploy  # Apply migrations (production / CI)
npm run db:seed                # Load demo workspace
npm run prisma:generate        # Regenerate Prisma Client
npm run prisma:studio          # Open Prisma Studio
```

## Available scripts

### Root (frontend)

| Script            | Description               |
| ----------------- | ------------------------- |
| `npm run dev`     | Start frontend dev server |
| `npm run build`   | Production build          |
| `npm run preview` | Preview production build  |
| `npm run lint`    | Run ESLint                |
| `npm run format`  | Format with Prettier      |

### `server/` (backend)

| Script                          | Description                                    |
| ------------------------------- | ---------------------------------------------- |
| `npm run dev`                   | Start API with hot reload                      |
| `npm run build`                 | Compile TypeScript                             |
| `npm run start`                 | Run compiled server                            |
| `npm run typecheck`             | Typecheck without emit                         |
| `npm run prisma:migrate`        | Run Prisma migrations (local dev, interactive) |
| `npm run prisma:migrate:deploy` | Apply migrations in production / CI            |
| `npm run prisma:generate`       | Generate Prisma Client                         |
| `npm run prisma:studio`         | Prisma Studio                                  |
| `npm run db:seed`               | Seed demo workspace data                       |

## Current limitations and roadmap

**Not implemented yet:**

- Google OAuth
- httpOnly cookies and refresh tokens (auth uses JWT in `localStorage`)
- External LLM providers (OpenAI, GigaChat, and similar)
- Real Stripe or other payment processing
- Real team invites, email delivery, or member lifecycle APIs
- Hosted production deployment and live demo URL (see [Deployment](#deployment) for env, migrations, and checklist)
- Drag-and-drop Kanban
- Supabase Storage is supported on the API (`FILE_STORAGE_DRIVER=supabase`); local dev still defaults to disk

**Possible next steps:**

- OAuth and hardened sessions (httpOnly cookies, refresh tokens)
- Optional LLM-backed summaries behind the same API shape
- Billing and team flows backed by real APIs and providers
- CI, production Docker images, and step-by-step hosting guides

## Portfolio note

This repository demonstrates fullstack TypeScript product work suitable for a portfolio or technical interview:

- Modern React app structure (TanStack Start, Router, Query)
- SaaS dashboard UX (layout, forms, charts, toasts, theming)
- REST API design with Express, validation, and clear route layering
- PostgreSQL modeling with Prisma (migrations, seed, relations)
- End-to-end integration for auth, workspace scoping, CRUD, board, dashboard, settings, and deterministic AI summaries
- Honest scoping: demo Billing/Team UI, no Stripe, no external AI keys; local uploads and deployment env documented in [Deployment](#deployment)

---

**Live demo:** coming soon
