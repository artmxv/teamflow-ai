# TeamFlow AI

Full-stack collaborative workspace for projects, tasks, realtime team communication, and AI-assisted project context.

TeamFlow AI combines project delivery, team collaboration, files, notifications, billing, and a read-only AI Copilot in one responsive web application. It is built as a production-style full-stack SaaS project with authenticated multi-workspace data, role-aware access control, durable storage, realtime communication, and separate frontend/backend deployments.

[Live App](https://teamflow-ai-murex.vercel.app) · [API Health](https://teamflow-ai-api.onrender.com/api/health) · [License](./LICENSE)

## Product overview

- Projects, task lists, project detail views, and drag-and-drop Kanban
- Multi-workspace teams, roles, invitations, member profiles, and notifications
- Workspace channels and direct messages with realtime updates and presence
- Read-only AI Copilot grounded in server-built workspace context
- Private project, task, chat, and avatar file handling through the backend
- YooKassa-backed one-time paid plan activation
- Russian and English localization, light/dark themes, and responsive layouts
- Public landing, authentication, Privacy Policy, Personal Data Consent, and Terms pages

Public product and legal pages are available without authentication. The collaborative workspace is protected under `/app/*`.

## Screenshots

### Dashboard

![Dashboard overview](docs/screenshots/dashboard.png)

### Project detail

![Project detail](docs/screenshots/project-detail.png)

### Kanban board

![Kanban board](docs/screenshots/board.png)

### Tasks

![Task management](docs/screenshots/tasks.png)

### AI Copilot

![AI Copilot](docs/screenshots/ai.png)

### Billing

![Billing and plans](docs/screenshots/billing.png)

### Settings

![Workspace settings](docs/screenshots/settings.png)

### Team

![Team management](docs/screenshots/team.png)

## Key features

### Project management

- Project and task CRUD with status, priority, assignee, deadline, and membership data
- Project detail pages with progress, participants, tasks, and documents
- Drag-and-drop Kanban powered by `@dnd-kit`
- Task drawer workflows, filters, comments, project documents, and task attachments
- Loading, empty, error, and stale-data recovery states across core flows

### Collaboration

- Multiple workspaces with owner, admin, and member roles
- Workspace invitations, member management, and project-level membership
- Workspace channels and direct messages over Socket.IO
- Unread counts, reactions, pinned messages, attachments, and online presence
- Activity notifications and scheduled deadline reminders

### AI Copilot

- Replaceable provider boundary with Groq support when `AI_PROVIDER=groq` is configured
- Server-built workspace context restricted by the requesting user's workspace and project access
- Bounded conversation history scoped to the current user and workspace in browser storage
- Prompt and context boundaries that keep Copilot read-only
- Deterministic workspace-summary fallback when the provider is disabled or unavailable
- Separate deterministic workspace briefing endpoint remains available for metrics, risks, and next actions
- No RAG, embeddings, autonomous tools, or workspace mutations

### Billing

- `FREE`, `TEAM`, `BUSINESS`, and `ENTERPRISE` plan limits
- YooKassa redirect checkout for paid plan changes
- Authoritative server-side payment status verification before plan activation
- Idempotent payment creation and webhook/confirmation handling
- Free downgrade without payment
- One-time plan activation only; no subscriptions or automatic renewal

### Authentication and security

- Email/password registration and sign-in plus Google OAuth
- JWT authentication with workspace and project ACL checks on the backend
- Auth and AI request rate limiting
- Production environment validation, CORS allowlists, and Helmet security headers
- Private Supabase Storage access through authenticated backend routes; service credentials are never sent to the browser

### Product polish

- Russian and English localization across public and authenticated surfaces
- Light and dark application themes
- Responsive landing, authentication, and authenticated workspace layouts
- Mobile navigation, dialogs, task drawer, chat composer, and settings flows
- Keyboard-accessible search results, data rows, controls, dialogs, and form labels
- Separate signup acknowledgements for Terms of Use and personal data processing consent

## Engineering highlights

- TypeScript frontend/backend separation with shared, explicitly mapped API data contracts
- Workspace and project ACL boundaries applied to REST, files, realtime conversations, and AI context
- Same-origin Vercel rewrites for production API, uploads, and Socket.IO traffic to Render
- Socket.IO chat that degrades independently from HTTP chat and uses a production-safe polling transport through Vercel
- Durable private Supabase Storage mediated by the backend rather than exposed directly to clients
- Server-authoritative, idempotent YooKassa payment flow with webhook and return confirmation paths
- Configurable AI provider architecture with bounded context, read-only prompts, operational fallback, and provider-specific failure handling
- CI coverage for frontend quality gates and backend builds, tests, Prisma migrations, and schema drift checks

## Architecture

```text
Browser
  → Vercel / TanStack Start SSR
      → /api/*       same-origin rewrite ─┐
      → /uploads/*   same-origin rewrite ├→ Render / Express + Socket.IO
      → /socket.io/* polling rewrite ────┘     ├→ Neon PostgreSQL
                                                ├→ private Supabase Storage
                                                ├→ Groq AI provider (optional)
                                                ├→ Google OAuth (optional)
                                                └→ YooKassa (when billing is configured)

GitHub Actions scheduler
  → authenticated reminder endpoint on Render
```

Production API, upload, and realtime requests stay on the Vercel origin. `vercel.json` forwards those paths to the Render service. Same-origin production realtime uses Engine.IO polling with upgrade disabled; local development and explicit direct-backend setups can use WebSocket plus polling.

The frontend contains public routes and the authenticated `/app/*` workspace. Express owns authentication, authorization, business rules, file access, AI orchestration, payment confirmation, and Socket.IO. Prisma connects the backend to PostgreSQL; browser code does not receive database, Supabase, Groq, Google, or YooKassa secrets.

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, TanStack Start, TanStack Router, TanStack Query, Vite |
| UI | Tailwind CSS v4, shadcn/ui and Radix UI, Recharts, Sonner, `@dnd-kit` |
| Forms and validation | React Hook Form, Zod |
| Backend | Node.js 22, Express, TypeScript, Zod |
| Data | Prisma, PostgreSQL; Neon in production and Docker locally |
| Realtime | Socket.IO server and client |
| Authentication | JWT, `bcryptjs`, Google OAuth |
| Storage | Supabase Storage, Multer, authenticated backend delivery |
| AI | Configurable provider interface, Groq, deterministic fallback |
| Payments | YooKassa |
| Infrastructure | Vercel, Render, Neon, Supabase, GitHub Actions |
| Testing | Node.js built-in test runner, TypeScript, ESLint, production builds, Prisma checks |

## Local development

### Prerequisites

- Node.js 22.x and npm
- Docker Desktop for local PostgreSQL

### Install

```bash
git clone <repository-url>
cd teamflow-ai
npm install

cd server
npm install
```

### Database and environment

```bash
cd server
docker compose up -d
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
```

Docker exposes PostgreSQL at `localhost:5433`. The example development connection string is:

```text
postgresql://teamflow:teamflow@localhost:5433/teamflow_ai?schema=public
```

The optional root `.env.example` documents frontend API/socket overrides. Local development defaults to `http://localhost:4000`; production defaults to same-origin requests and normally leaves `VITE_API_URL` unset on Vercel.

### Run

```bash
# Terminal 1
cd server
npm run dev

# Terminal 2, repository root
npm run dev
```

| Service | Local address |
| --- | --- |
| Frontend | `http://localhost:8080` |
| API | `http://localhost:4000` |
| PostgreSQL | `localhost:5433` |

Seeded local account:

| Field | Value |
| --- | --- |
| Email | `alex@teamflow.ai` |
| Password | `Password123!` |

## Environment and deployment

Safe templates:

- [Frontend environment example](./.env.example)
- [Backend environment example](./server/.env.example)

Backend configuration groups include database/JWT, allowed origins and public app URL, Google OAuth, Supabase Storage, email delivery, AI provider, YooKassa, and the internal reminder secret. Production validation rejects incomplete or unsafe critical configuration. Do not commit populated `.env` files or credentials.

Deployment targets:

| Surface | Provider | URL |
| --- | --- | --- |
| Frontend and same-origin proxy | Vercel | https://teamflow-ai-murex.vercel.app |
| Express API and Socket.IO | Render | https://teamflow-ai-api.onrender.com |
| Database | Neon | Managed PostgreSQL |
| Files | Supabase | Private Storage bucket |

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for environment setup, migrations, Google OAuth, storage, billing, scheduler, and post-deploy checks.

## Testing and quality

Frontend commands:

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

Backend commands from `server/`:

```bash
npm run prisma:generate
npm run typecheck
npm run build
npm test
```

GitHub Actions runs frontend typecheck, lint, and a Vercel production build. The backend job generates Prisma Client, typechecks and builds the API, applies migrations to a fresh PostgreSQL service, verifies migration status and schema drift, and runs the backend test suite. A separate scheduled workflow calls the authenticated deadline-reminder endpoint.

## Current limitations

- Billing uses one-time plan activation rather than subscriptions, expiration, or automatic renewal
- AI Copilot is read-only and cannot perform autonomous actions or mutate workspace data
- Copilot history is bounded and stored per user/workspace in the current browser, not persisted as a cross-device conversation
- AI context uses a structured workspace snapshot; RAG, embeddings, and vector search are not implemented
- Presence and in-memory rate limiters assume a single backend process; multi-instance coordination is not implemented
- The Render backend can cold-start after idle periods
- There are no native mobile or desktop applications
- Enterprise SSO/SAML and a dedicated audit-log product are not implemented
- JWT access tokens use browser storage; there is no refresh-token/httpOnly-cookie session flow

## Legal

- [Privacy Policy](https://teamflow-ai-murex.vercel.app/privacy)
- [Personal Data Consent](https://teamflow-ai-murex.vercel.app/personal-data-consent)
- [Terms of Use](https://teamflow-ai-murex.vercel.app/terms)
- Contact: [teamflowai.privacy@gmail.com](mailto:teamflowai.privacy@gmail.com)

## License

TeamFlow AI is distributed under the [TeamFlow AI Source Available License](./LICENSE) for portfolio review and evaluation. Commercial use, redistribution, publication as another person's project, and substantial source reuse require prior written permission as described in the license.
