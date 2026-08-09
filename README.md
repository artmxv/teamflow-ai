# TeamFlow AI

TeamFlow AI is a full-stack SaaS portfolio app for projects, tasks, team chat, notifications, and workspace briefings.

It is built for product and engineering portfolio review: real auth, multi-workspace collaboration, durable file storage, Socket.IO chat, and honest limits around billing and AI. It is not an enterprise compliance product and does not claim SOC 2, SSO/SAML, native mobile apps, or unlimited AI.

Workspace briefings are built from projects, tasks, deadlines, and priorities the signed-in user can access. They are deterministic today and do **not** call an external LLM provider.

## Production deployment

| Surface  | URL                                  |
| -------- | ------------------------------------ |
| Frontend | https://teamflow-ai-murex.vercel.app |
| API      | https://teamflow-ai-api.onrender.com |

The app requires authentication. These URLs are the current production deployment, not a public unauthenticated demo. The API root may not serve a browser UI; use `/api/health` to check the API.

**Current infrastructure:** frontend SSR on Vercel, Express API and Socket.IO on Render, PostgreSQL on Neon, private Supabase Storage, reminder scheduler via GitHub Actions.

During the transitional period, the previous Render frontend remains available as a temporary fallback only: https://teamflow-ai-web.onrender.com. It is not the primary production URL.

## Screenshots

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

### AI Assistant (deterministic briefing)

![AI Assistant](docs/screenshots/ai.png)

### Settings

![Settings](docs/screenshots/settings.png)

### Billing

![Billing](docs/screenshots/billing.png)

### Team

![Team](docs/screenshots/team.png)

Landing-page product previews may use illustrative mockups. In-app screens above reflect the authenticated product UI.

## Key features

### Projects and tasks

- Projects and tasks with statuses, priorities, assignees, and due dates (date + time)
- Kanban board with drag-and-drop (`@dnd-kit`)
- Project documents and task attachments
- Filters plus loading and error states

### Team and workspaces

- Multi-workspace accounts
- Roles, invitations, member management, and project membership
- Enforced plan limits (active members + pending invitations count toward the seat limit):

| Plan       | Max members | Max owned workspaces |
| ---------- | ----------- | -------------------- |
| FREE       | 5           | 1                    |
| TEAM       | 10          | 2                    |
| BUSINESS   | 20          | 5                    |
| ENTERPRISE | Unlimited   | Unlimited            |

Owners can activate paid plans through YooKassa. Billing V1 uses a one-time activation payment without subscriptions, expiration, or automatic renewal. Test mode is the default; live payments require an explicit backend environment setting. The backend verifies every successful payment against YooKassa before changing the owner-scoped plan.

### Team chat

- Workspace chat and direct messages
- Realtime via Socket.IO
- Unread counts, attachments, reactions, pinned messages, and online presence

**Presence limit:** presence is stored in memory on the backend process. It is intended for a single backend instance (`WEB_CONCURRENCY=1`). Realtime cursors are not implemented.

### Notifications

- Task assignment, comments, and attachments
- Project membership and project documents
- Workspace invitations
- Deadline reminders (`TASK_DUE_SOON`, `TASK_OVERDUE`) via a scheduled job that hits the API

### Authentication

- Email/password registration and login
- Google OAuth (requires correct env vars and backend callback URL)
- JWT-based auth; the access token is stored in `localStorage`

### Files

- Private Supabase Storage in production
- The frontend does not talk to Supabase directly
- Upload and download go through the authenticated backend (signed/private access)
- Production storage does not depend on the Render local filesystem

### Localization

- Russian and English for the app shell and landing page
- Dark/light theme toggle

## Architecture

```text
Browser
  → TanStack Start frontend on Vercel (SSR)
  → Express REST API + Socket.IO on Render
      → Neon PostgreSQL
      → private Supabase Storage (backend proxy / signed URLs)
      → Google OAuth provider (optional)
      → GitHub Actions hourly cron → POST /api/internal/task-reminders/run
```

Vercel hosts only the frontend SSR app. Express and Socket.IO stay on Render. The frontend deployment does not include Prisma, backend env, or backend secrets.

### Frontend (`src/`)

- File-based routes (marketing + `/app/*`)
- API client in `src/lib/api/` (`VITE_API_URL`, default `http://localhost:4000`)
- Socket.IO client for chat and presence
- Auth token in `localStorage`; route guards on `/app/*`

### Backend (`server/`)

- Express routers under `/api`
- Prisma + PostgreSQL
- Socket.IO on the same HTTP server
- Multer for uploads; storage drivers `local` (dev) or `supabase` (production)
- Deterministic workspace briefings in `ai.service` (no outbound LLM call)

## Tech stack

| Layer    | Technologies                                                                |
| -------- | --------------------------------------------------------------------------- |
| Frontend | TanStack Start, React 19, TypeScript, Vite, TanStack Router, TanStack Query |
| UI       | Tailwind CSS v4, shadcn/ui (Radix), Recharts, Sonner, `@dnd-kit`            |
| Forms    | React Hook Form, Zod                                                        |
| Backend  | Node.js, Express, TypeScript, Zod                                           |
| Data     | Prisma, PostgreSQL (Neon in production; Docker locally)                     |
| Auth     | JWT (`jsonwebtoken`), `bcryptjs`, Google OAuth (`google-auth-library`)      |
| Realtime | Socket.IO (server + client)                                                 |
| Storage  | Supabase Storage (`@supabase/supabase-js`), Multer                          |
| Email    | Resend (optional; console provider for local invites)                       |
| Tests    | Node.js built-in test runner (`npm test` in `server/`)                      |
| CI       | GitHub Actions deadline-reminder scheduler                                  |

## Local development

**Prerequisites:** Node.js 20+, npm, Docker Desktop.

### 1. Clone and install

```bash
git clone <repository-url>
cd teamflow-ai
npm install
```

```bash
cd server
npm install
```

### 2. Start PostgreSQL

```bash
cd server
docker compose up -d
```

Compose maps host port **5433** → container **5432** (`server/docker-compose.yml`).

### 3. Configure environment

Copy example files only (do not copy production secrets):

```bash
# From the repository root
cp server/.env.example server/.env
```

Optional frontend override (repo root), if the API is not at `http://localhost:4000`:

```bash
# From the repository root
cp .env.example .env
```

See [Environment variables](#environment-variables). For local UI on port 8080, set `APP_URL=http://localhost:8080` (and keep that origin in `CORS_ORIGIN`).

### 4. Prisma

From `server/`:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
```

- `prisma:migrate` runs interactive `prisma migrate dev` (local development).
- Use `prisma:migrate:deploy` for production / CI.
- `db:seed` loads demo workspace data for local sign-in.

### 5. Start backend and frontend

Terminal 1 (API):

```bash
cd server
npm run dev
```

Terminal 2 (frontend, repo root):

```bash
npm run dev
```

| Service    | Local URL             |
| ---------- | --------------------- |
| Frontend   | http://localhost:8080 |
| API        | http://localhost:4000 |
| PostgreSQL | localhost:5433        |

### Demo credentials (after seed)

| Field    | Value              |
| -------- | ------------------ |
| Email    | `alex@teamflow.ai` |
| Password | `Password123!`     |

## Environment variables

Safe templates: `server/.env.example` and root `.env.example`. Never commit filled `.env` files or real secrets.

### Frontend (repo root)

| Variable       | Required   | Description                                                                                   |
| -------------- | ---------- | --------------------------------------------------------------------------------------------- |
| `VITE_API_URL` | No locally | API base URL. Defaults to `http://localhost:4000`. Required at **build time** for production. |

### Backend (`server/.env`)

| Variable                    | Required      | Description                                                   |
| --------------------------- | ------------- | ------------------------------------------------------------- |
| `DATABASE_URL`              | Yes           | PostgreSQL connection string for Prisma                       |
| `JWT_SECRET`                | Yes           | Secret for signing JWTs (not the dev default in production)   |
| `PORT`                      | No            | API port (default `4000`)                                     |
| `NODE_ENV`                  | No            | `development`, `test`, or `production`                        |
| `CORS_ORIGIN`               | Yes in prod   | Frontend origin(s), comma-separated, no trailing slash        |
| `APP_URL`                   | Yes in prod   | Public frontend URL for invite links and post-OAuth redirects |
| `GOOGLE_CLIENT_ID`          | Optional\*    | Google OAuth client id                                        |
| `GOOGLE_CLIENT_SECRET`      | Optional\*    | Google OAuth client secret                                    |
| `GOOGLE_REDIRECT_URI`       | Optional\*    | Backend callback, e.g. `https://…/api/auth/google/callback`   |
| `FILE_STORAGE_DRIVER`       | No            | `local` (default) or `supabase`                               |
| `SUPABASE_URL`              | If supabase   | Supabase project URL                                          |
| `SUPABASE_SERVICE_ROLE_KEY` | If supabase   | Service role key (server only)                                |
| `SUPABASE_STORAGE_BUCKET`   | If supabase   | Bucket name (example: `teamflow-uploads`)                     |
| `EMAIL_PROVIDER`            | No            | `console` (default) or `resend`                               |
| `EMAIL_FROM`                | If resend     | Verified sender                                               |
| `RESEND_API_KEY`            | If resend     | Resend API key                                                |
| `TASK_REMINDER_CRON_SECRET` | For scheduler | Bearer secret for `POST /api/internal/task-reminders/run`     |
| `YOOKASSA_SHOP_ID`          | For billing   | YooKassa shop identifier; backend only                        |
| `YOOKASSA_SECRET_KEY`       | For billing   | YooKassa secret key; backend only                             |
| `YOOKASSA_RETURN_URL`       | Optional      | Billing return URL; defaults to `APP_URL/app/billing`         |
| `YOOKASSA_MODE`             | No            | `test` (default) or explicit `live`                           |

\* All three Google variables together, or leave all empty.

Google OAuth callback must hit the **backend**. After success, the backend redirects the user to the **frontend** (`APP_URL`).

Validated at startup in `server/src/config/env.ts`.

Example local `DATABASE_URL` (matches Docker Compose):

```text
postgresql://teamflow:teamflow@localhost:5433/teamflow_ai?schema=public
```

## Deployment

Full guide: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

### Current

- Frontend: Vercel (TanStack Start SSR)
- Backend: Render Web Service (Express + Socket.IO)
- Database: Neon PostgreSQL
- Files: private Supabase Storage
- Reminders: GitHub Actions → production API

Temporary fallback during the transitional period: Render frontend at https://teamflow-ai-web.onrender.com (not the primary production URL).

### Dual-target frontend build

The frontend supports two Nitro presets so the same repo can deploy to Vercel and keep the Render frontend as a temporary fallback without a separate config branch.

**Render / local compatibility** (default):

```bash
npm run build
```

| Detail       | Value                   |
| ------------ | ----------------------- |
| Nitro preset | `node-server`           |
| Output       | `dist/`                 |
| Server entry | `dist/server/index.mjs` |

**Vercel:**

```bash
NITRO_PRESET=vercel npm run build
```

| Detail       | Value                                          |
| ------------ | ---------------------------------------------- |
| Nitro preset | `vercel`                                       |
| Output       | Vercel Build Output API under `.vercel/output` |

Vercel is used only for the frontend SSR app. Express API and Socket.IO are not deployed on Vercel.

### Render backend commands

Backend (Root Directory = `server`):

```bash
# Build
npm install --include=dev && npx prisma generate && npm run build && npm run prisma:migrate:deploy

# Start
npm run start
```

`npm run start` runs `node dist/server.js`. Keep **`WEB_CONCURRENCY=1`** while presence is in-memory.

**Render free tier:** the API may cold-start after idle time. The UI shows loaders and retry affordances while the backend wakes up.

## API surface (high level)

| Area               | Role                                                        |
| ------------------ | ----------------------------------------------------------- |
| Auth               | Register, login, logout, profile, Google OAuth, avatar      |
| Workspaces         | List/switch workspaces, settings, members                   |
| Projects / tasks   | CRUD, board updates, attachments                            |
| Team / invitations | Invites, accept flow, member management                     |
| Chat               | Conversations, messages, reactions, pins, unread, Socket.IO |
| Notifications      | List, mark read, deadline reminders (internal)              |
| Files              | Authenticated upload/download via backend storage drivers   |
| AI summary         | Deterministic `POST /api/ai/workspace-summary`              |
| Billing            | Owner-scoped plans; one-time YooKassa activation             |

## Testing

From `server/`:

```bash
npm run typecheck
npm test
```

From repository root:

```bash
npm run build
```

The repository still has legacy full-lint baseline issues. During focused changes, run ESLint against the touched frontend files:

```bash
npx eslint <changed-file-1> <changed-file-2>
```

Manual post-deploy checks: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) and [docs/QA_CHECKLIST.md](docs/QA_CHECKLIST.md).

## Available scripts

### Root (frontend)

| Script            | Description                                    |
| ----------------- | ---------------------------------------------- |
| `npm run dev`     | Vite / TanStack Start dev server (port 8080)   |
| `npm run build`   | Production build (default Nitro `node-server`) |
| `npm run preview` | Preview production build                       |
| `npm run lint`    | ESLint                                         |
| `npm run format`  | Prettier                                       |

For a Vercel-oriented build locally: `NITRO_PRESET=vercel npm run build`.

### `server/` (backend)

| Script                          | Description                  |
| ------------------------------- | ---------------------------- |
| `npm run dev`                   | API with hot reload          |
| `npm run build`                 | Compile TypeScript           |
| `npm run start`                 | Run compiled server          |
| `npm run typecheck`             | Typecheck without emit       |
| `npm test`                      | Node test runner             |
| `npm run prisma:migrate`        | Local `migrate dev`          |
| `npm run prisma:migrate:deploy` | Apply migrations (prod / CI) |
| `npm run prisma:generate`       | Generate Prisma Client       |
| `npm run prisma:studio`         | Prisma Studio                |
| `npm run db:seed`               | Seed demo workspace          |

## Current limitations

- Billing V1 is one-time plan activation; subscriptions, expiration, and automatic renewal are not implemented
- Workspace briefings do not use an external LLM
- Online presence is in-memory and single-instance (`WEB_CONCURRENCY=1`)
- Backend on Render may cold-start after idle time
- No native mobile or desktop apps
- No SSO/SAML or audit-log product features
- Auth JWT is stored in `localStorage` (not httpOnly cookies / refresh-token flow)
- Landing preview widgets may be visual mockups, not live product data

## Roadmap

Near-term (no fixed dates):

- Production monitoring and post-migration cleanup
- UI/UX and visual polish
- Attachment loading experience
- Responsive and localization polish
- Optional external LLM provider behind the same briefing API shape
- Subscription billing and automatic renewal later
- Multi-instance-safe presence (shared store + Socket.IO adapter) later

## Portfolio note

This repository shows fullstack TypeScript product work:

- Modern React app structure (TanStack Start, Router, Query)
- SaaS workspace UX (projects, board, chat, notifications, theming, i18n)
- Express REST API with validation and clear route layering
- PostgreSQL modeling with Prisma
- Durable private file storage via backend + Supabase
- Honest scoping: one-time YooKassa activation, no billing subscriptions, single-instance presence

## License

TeamFlow AI is source-available for portfolio review and evaluation purposes.

Commercial use, redistribution, publication as another person's own project,
and reuse of substantial portions of the source code are not permitted without
prior written permission.

See the [LICENSE](./LICENSE) file for the full terms.

---

Production: [frontend](https://teamflow-ai-murex.vercel.app) · [API](https://teamflow-ai-api.onrender.com)
