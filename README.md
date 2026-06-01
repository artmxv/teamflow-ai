# TeamFlow AI

Fullstack AI-native project workspace demo for product teams. TeamFlow AI combines a polished SaaS-style frontend with a real Express API, PostgreSQL, and seeded demo data so you can explore projects, tasks, a Kanban board, and dashboard metrics end to end.

## Preview

### Dashboard

![Dashboard](docs/screenshots/dashboard.png)

### Projects

![Projects](docs/screenshots/projects.png)

### Kanban Board

![Kanban Board](docs/screenshots/board.png)

### Tasks

![Tasks](docs/screenshots/tasks.png)

## Feature overview

### Product and marketing

- Landing page with product overview sections
- Auth screens (sign in, sign up, forgot password) as UI only
- Dark/light theme toggle without a light flash on reload
- EN/RU language toggle (UI)

### Workspace app (API-backed)

- App shell with sidebar and topbar
- **Projects**: list from API; create via **New Project**
- **Tasks**: list from API; create via **New Task**
- **Board**: Kanban columns from API; status changes persist via PATCH
- **Task drawer**: view task details; delete task via API
- **Dashboard**: summary metrics from API (active projects, open/done tasks, team count)

### Demo data

- Seed script loads a professional workspace with users, projects, and tasks

### UI screens (not wired to the API yet)

- AI Assistant, Team, Settings, and Billing pages use local/mock content for layout and UX exploration

## Tech stack

### Frontend

- TanStack Start, React 19, TypeScript
- TanStack Router, TanStack Query
- Tailwind CSS v4, shadcn/ui-style components (Radix UI)
- Recharts, Sonner toasts
- React Hook Form, Zod

### Backend

- Express, TypeScript
- Prisma ORM, PostgreSQL
- Docker Compose for local PostgreSQL
- Zod request validation

### Tooling

- Vite, ESLint, Prettier, npm

## Architecture overview

```text
Browser (TanStack Start + React)
        |
        |  HTTP (TanStack Query)
        v
Express REST API  (/api/*)
        |
        |  Prisma
        v
PostgreSQL (Docker, port 5433)
```

- **Frontend** (`src/`): file-based routes, shared app components, API client in `src/lib/api/`. Default API base URL: `http://localhost:4000` (override with `VITE_API_URL`).
- **Backend** (`server/`): Express app mounts routers under `/api`, services talk to Prisma, middleware handles errors and CORS.
- **Database**: Prisma schema and migrations in `server/prisma/`; seed in `server/prisma/seed.ts`.

Typical local ports: frontend **8080**, API **4000**, Postgres **5433**.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create project |
| GET | `/api/tasks` | List tasks |
| POST | `/api/tasks` | Create task |
| PATCH | `/api/tasks/:id` | Update task (e.g. status) |
| DELETE | `/api/tasks/:id` | Delete task |
| GET | `/api/dashboard/summary` | Dashboard summary metrics |

## Local setup

**Prerequisites:** Node.js 20+, npm, Docker (for PostgreSQL).

From the repository root:

```bash
npm install
```

Backend and database:

```bash
cd server
cp .env.example .env
npm install
docker compose up -d
npm run prisma:migrate
npm run db:seed
```

Run the API (keep this terminal open):

```bash
npm run dev
```

In a **second terminal**, from the repository root, start the frontend:

```bash
npm run dev
```

Open the app at `http://localhost:8080`. The API runs at `http://localhost:4000`.

## Environment variables

### Backend (`server/.env`)

Copy from `server/.env.example`:

| Variable | Description |
|----------|-------------|
| `PORT` | API port (default `4000`) |
| `NODE_ENV` | e.g. `development` |
| `CORS_ORIGIN` | Frontend origin (default `http://localhost:8080`) |
| `DATABASE_URL` | PostgreSQL connection string for Prisma |

Example `DATABASE_URL` (matches Docker Compose defaults):

```text
postgresql://teamflow:teamflow@localhost:5433/teamflow_ai?schema=public
```

### Frontend (optional)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | API base URL if not `http://localhost:4000` |

## Database setup and seed

Start Postgres:

```bash
cd server
docker compose up -d
```

Apply migrations and load demo data:

```bash
cd server
npm run prisma:migrate
npm run db:seed
```

Other useful commands (from `server/`):

```bash
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

- Real authentication and sessions
- Production authorization and workspace scoping per user
- Real AI assistant integration (LLM/API)
- Deployment configuration
- Drag-and-drop Kanban
- File uploads

**Possible next steps:**

- JWT auth and protected routes
- Wire remaining screens (Team, Settings, AI) to the API
- Workspace-aware queries and multi-tenant safety
- AI summaries backed by stored `AiSummary` records
- CI, Docker for the API, and a hosted demo

## Portfolio note

This repository demonstrates fullstack TypeScript product work suitable for a portfolio or technical interview:

- Modern React app structure (TanStack Start, Router, Query)
- SaaS dashboard UX (layout, forms, charts, toasts, theming)
- REST API design with Express, validation, and clear route layering
- PostgreSQL modeling with Prisma (migrations, seed, relations)
- Frontend-to-backend integration for core CRUD flows (projects, tasks, board, dashboard)
- Honest scoping: auth, AI, and deployment called out as future work rather than implied

---

**Live demo:** coming soon
