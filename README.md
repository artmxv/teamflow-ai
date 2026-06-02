# TeamFlow AI

Fullstack project workspace demo for product teams. TeamFlow AI pairs a polished SaaS-style frontend (TanStack Start + React) with a real Express API, PostgreSQL, JWT auth, and seeded demo data. Explore projects, tasks, a Kanban board, dashboard metrics, workspace settings, and a deterministic AI assistant summary, all scoped to the signed-in user's workspace.

## Demo credentials

After seeding the database (see [Local setup](#local-setup)), sign in with:

| Field | Value |
|-------|-------|
| Email | `alex@teamflow.ai` |
| Password | `Password123!` |

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

| Layer | Technologies |
|-------|----------------|
| Frontend | TanStack Start, React 19, TypeScript, TanStack Router, TanStack Query |
| UI | Tailwind CSS v4, shadcn/ui-style components (Radix UI), Recharts, Sonner |
| Forms | React Hook Form, Zod |
| Backend | Express, TypeScript, Zod validation |
| Data | Prisma ORM, PostgreSQL (Docker Compose locally) |
| Auth | JWT (`jsonwebtoken`), `bcryptjs` password hashing |

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

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/register` | Register (email/password) |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/auth/me` | Current user and workspace |
| PATCH | `/api/auth/profile` | Update profile |
| POST | `/api/auth/logout` | Sign out |
| GET | `/api/projects` | List workspace projects |
| POST | `/api/projects` | Create project |
| PATCH | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |
| GET | `/api/tasks` | List workspace tasks |
| POST | `/api/tasks` | Create task |
| PATCH | `/api/tasks/:id` | Update task (e.g. status) |
| DELETE | `/api/tasks/:id` | Delete task |
| GET | `/api/dashboard/summary` | Dashboard summary metrics |
| PATCH | `/api/workspace` | Update workspace settings |
| POST | `/api/ai/workspace-summary` | Deterministic workspace AI summary |

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

```bash
cd server
cp .env.example .env
```

Edit `server/.env` if needed (defaults work with Docker Compose below). Set `JWT_SECRET` to a non-default value before any shared or production-like environment.

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

### Backend (`server/.env`)

Copy from `server/.env.example`:

| Variable | Description |
|----------|-------------|
| `PORT` | API port (default `4000`) |
| `NODE_ENV` | e.g. `development` |
| `CORS_ORIGIN` | Frontend origin (default `http://localhost:8080`) |
| `DATABASE_URL` | PostgreSQL connection string for Prisma |
| `JWT_SECRET` | Secret for signing JWTs (change from example in production) |

Example `DATABASE_URL` (matches Docker Compose defaults):

```text
postgresql://teamflow:teamflow@localhost:5433/teamflow_ai?schema=public
```

### Frontend (optional)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | API base URL if not `http://localhost:4000` |

## Database commands

From `server/`:

```bash
docker compose up -d      # Start Postgres
npm run prisma:migrate    # Apply migrations
npm run db:seed           # Load demo workspace
npm run prisma:generate   # Regenerate Prisma Client
npm run prisma:studio     # Open Prisma Studio
```

## Available scripts

### Root (frontend)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start frontend dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |

### `server/` (backend)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start API with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run start` | Run compiled server |
| `npm run typecheck` | Typecheck without emit |
| `npm run prisma:migrate` | Run Prisma migrations (dev) |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:studio` | Prisma Studio |
| `npm run db:seed` | Seed demo workspace data |

## Current limitations and roadmap

**Not implemented yet:**

- Google OAuth
- httpOnly cookies and refresh tokens (auth uses JWT in `localStorage`)
- External LLM providers (OpenAI, GigaChat, and similar)
- Real Stripe or other payment processing
- Real team invites, email delivery, or member lifecycle APIs
- Hosted production deployment and live demo URL
- Drag-and-drop Kanban
- File uploads

**Possible next steps:**

- OAuth and hardened sessions (httpOnly cookies, refresh tokens)
- Optional LLM-backed summaries behind the same API shape
- Billing and team flows backed by real APIs and providers
- CI, production Docker images, and deployment documentation

## Portfolio note

This repository demonstrates fullstack TypeScript product work suitable for a portfolio or technical interview:

- Modern React app structure (TanStack Start, Router, Query)
- SaaS dashboard UX (layout, forms, charts, toasts, theming)
- REST API design with Express, validation, and clear route layering
- PostgreSQL modeling with Prisma (migrations, seed, relations)
- End-to-end integration for auth, workspace scoping, CRUD, board, dashboard, settings, and deterministic AI summaries
- Honest scoping: demo Billing/Team UI, no Stripe, no external AI keys, and deployment called out as future work

---

**Live demo:** coming soon
