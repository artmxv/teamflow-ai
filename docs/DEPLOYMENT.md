# Deployment guide

Step-by-step reference for the **current** TeamFlow AI production setup and for the planned frontend move to Vercel.

**Current production**

| Surface | URL / host |
| ------- | ---------- |
| Frontend | https://teamflow-ai-web.onrender.com (Render) |
| API + Socket.IO | https://teamflow-ai-api.onrender.com (Render) |
| Database | Neon PostgreSQL |
| Files | Private Supabase Storage |
| Reminders | GitHub Actions → API |

**Planned (stage 104):** migrate **only** the frontend to Vercel. Express + Socket.IO stay on Render. Do not treat Vercel as the current production frontend.

For a broader manual QA pass, see [QA_CHECKLIST.md](./QA_CHECKLIST.md).

## Critical warnings

**`APP_URL` must be your production frontend URL** (currently `https://teamflow-ai-web.onrender.com`), not `http://localhost:8080`.

If `APP_URL` points to localhost, workspace invitation links and Google OAuth redirects will send users to localhost and auth will fail in production.

**`CORS_ORIGIN`** must match the deployed frontend origin **exactly** (scheme + host + port if non-default). **No trailing slash.**

Example (current production):

```text
CORS_ORIGIN=https://teamflow-ai-web.onrender.com
```

After a future Vercel cutover, update `APP_URL` and `CORS_ORIGIN` to the Vercel origin. Multiple origins (production + preview) are comma-separated:

```text
CORS_ORIGIN=https://your-app.vercel.app,https://teamflow-ai-git-main-yourorg.vercel.app
```

**Google OAuth:** If the client secret was ever exposed during local development, **rotate or recreate** it before production. Never reuse a leaked secret.

**Realtime:** keep a **single** backend instance and `WEB_CONCURRENCY=1` while presence is in-memory.

Never commit `server/.env` or a filled root `.env` with secrets.

---

## 1. Required production env (summary)

| Area | Required |
| ---- | -------- |
| Database | `DATABASE_URL` (Neon) |
| Auth | `JWT_SECRET` (long random; not the dev default) |
| Frontend links | `APP_URL` (production frontend URL) |
| CORS | `CORS_ORIGIN` (production frontend URL) |
| Runtime | `NODE_ENV=production` |
| Frontend build | `VITE_API_URL` (production API URL) |
| Files | `FILE_STORAGE_DRIVER=supabase` + Supabase vars |

Optional but common:

| Feature | Variables |
| ------- | --------- |
| Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (all three or none) |
| Email invites | `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` |
| Deadline reminders | `TASK_REMINDER_CRON_SECRET` (+ GitHub Actions secret of the same name) |

---

## 2. Frontend env

Create `.env` in the **repository root** for local overrides:

```bash
# From the repository root
cp .env.example .env
```

Example contents (see also `.env.example`):

```bash
VITE_API_URL=https://teamflow-ai-api.onrender.com
```

- **Required in production builds** if the API is not at `http://localhost:4000`.
- Vite embeds `VITE_*` values at **build time**. Rebuild after changing the API URL.
- Do not put secrets in frontend env vars; they are exposed in the browser bundle.
- Do not hardcode a production API URL in source; always use `VITE_API_URL`.
- If `VITE_API_URL` is missing in a production build, the app logs a console warning and falls back to `http://localhost:4000` (which will not work in production).

Default for local dev: `http://localhost:4000` (see `src/lib/api/client.ts`). Local frontend listens on **http://localhost:8080**.

---

## 3. Backend env (Render)

For local dev, copy the backend example from the repository root:

```bash
# From the repository root
cp server/.env.example server/.env
```

On Render, set the same variables in the service dashboard.

| Variable | Required | Notes |
| -------- | -------- | ----- |
| `PORT` | No | Default `4000`; Render injects `PORT` automatically |
| `NODE_ENV` | Yes (prod) | `production` |
| `CORS_ORIGIN` | Yes (prod) | Exact frontend origin(s); no trailing slash; no localhost in production |
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string for Prisma |
| `JWT_SECRET` | Yes | Long random string; must not be `dev-jwt-secret-change-in-production` |
| `APP_URL` | Yes (prod) | Public frontend URL for invites and OAuth redirects |
| `EMAIL_PROVIDER` | No | `console` (default) or `resend` |
| `EMAIL_FROM` | If resend | Verified sender/domain in Resend |
| `RESEND_API_KEY` | If resend | Resend API key |
| `GOOGLE_CLIENT_ID` | Optional | All three Google vars together, or leave all empty |
| `GOOGLE_CLIENT_SECRET` | Optional | Rotate if previously exposed during dev |
| `GOOGLE_REDIRECT_URI` | Optional | Backend callback, e.g. `https://teamflow-ai-api.onrender.com/api/auth/google/callback` |
| `FILE_STORAGE_DRIVER` | Prod: `supabase` | Durable uploads on Render |
| `SUPABASE_URL` | If supabase | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | If supabase | Service role; never expose to the frontend |
| `SUPABASE_STORAGE_BUCKET` | If supabase | Bucket name |
| `TASK_REMINDER_CRON_SECRET` | For reminders | Bearer token for the internal reminders endpoint |
| `WEB_CONCURRENCY` | Yes for presence | Keep `1` while presence is in-memory |

Startup validation lives in `server/src/config/env.ts`. Misconfigured production or Resend settings fail fast at boot.

---

## 4. Google OAuth setup

1. Create an OAuth 2.0 **Web application** client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. **Rotate or recreate the client secret** if it was ever committed, logged, or shared during development.
3. Set **Authorized JavaScript origins** to the frontend origin, for example:
   ```text
   https://teamflow-ai-web.onrender.com
   ```
4. Set **Authorized redirect URI** to the **backend** callback:
   ```text
   https://teamflow-ai-api.onrender.com/api/auth/google/callback
   ```
5. Set all three env vars on the API service:
   ```bash
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=https://teamflow-ai-api.onrender.com/api/auth/google/callback
   ```
6. Ensure `APP_URL` is the production frontend URL (used after OAuth completes).

Flow: browser → frontend “Continue with Google” → backend `/api/auth/google` → Google → backend `/api/auth/google/callback` → redirect to frontend (`APP_URL`) with session token handling.

If Google env vars are all empty, the API starts normally and the sign-in page shows Google as unavailable when clicked.

After a Vercel frontend migration, update Google **JavaScript origins** and Render `APP_URL` / `CORS_ORIGIN`. Keep the callback on the Render API URL.

---

## 5. Resend setup

1. Create a [Resend](https://resend.com) account and **verify your sending domain**.
2. Create an API key and set on Render:
   ```bash
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=<your-resend-api-key>
   EMAIL_FROM="TeamFlow AI <noreply@yourdomain.com>"
   ```
3. **`EMAIL_FROM` must use a verified sender or domain in Resend.** Do not use `noreply@example.com` in production.
4. Restart the API. With `EMAIL_PROVIDER=resend`, missing `RESEND_API_KEY` or `EMAIL_FROM` prevents startup.

For local dev without Resend, use `EMAIL_PROVIDER=console` (invites are logged to the server console).

---

## 6. File uploads (local disk or Supabase Storage)

Uploads (avatars, task attachments, project documents, chat files) are handled in `server/src/lib/file-storage/`.

| `FILE_STORAGE_DRIVER` | Behavior |
| --------------------- | -------- |
| `local` (default) | Files on disk under `server/uploads/` (fine for local dev) |
| `supabase` | Durable object storage via Supabase Storage (**required for production on Render**) |

**Local disk (`FILE_STORAGE_DRIVER=local`):**

- On Render, the default filesystem is **ephemeral**. Uploads may be **lost on redeploy** unless you attach a persistent disk.

**Supabase Storage (`FILE_STORAGE_DRIVER=supabase`):**

1. Create a [Supabase](https://supabase.com) project.
2. In **Storage**, create a **private** bucket (for example `teamflow-uploads`).
3. Avatars may use a public-readable path policy if configured that way; task, project, and chat files stay private. Authenticated `GET .../file` routes redirect to short-lived signed URLs using the service role key.
4. Copy **Project URL**, **service role key**, and bucket name to Render:

```bash
FILE_STORAGE_DRIVER=supabase
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
SUPABASE_STORAGE_BUCKET=teamflow-uploads
```

**Never commit** `SUPABASE_SERVICE_ROLE_KEY` or expose it to the frontend. The Vite app does not talk to Supabase directly for uploads or downloads.

Object keys inside the bucket:

- `avatars/{filename}`
- `workspaces/{workspaceId}/projects/{projectId}/{uuid}-{safeFilename}`
- `workspaces/{workspaceId}/tasks/{taskId}/{uuid}-{safeFilename}`
- `workspaces/{workspaceId}/chat/{conversationId}/{messageId}/{uuid}-{safeFilename}`

Legacy keys (`projects/{projectId}/{filename}`, `tasks/{taskId}/{filename}`) are still resolved for older uploads.

---

## 7. Neon PostgreSQL

1. Create a project at [Neon](https://neon.tech).
2. Copy the **pooled** connection string if available (recommended for PaaS workloads).
3. Set `DATABASE_URL` on the Render API service.
4. Apply migrations as part of the API build (see section 9) or manually with `npm run prisma:migrate:deploy`.

Do not run `prisma migrate dev` against production. Use `npm run prisma:migrate:deploy` only.

Optional demo data (not for a real production tenant):

```bash
cd server
npm run db:seed
```

---

## 8. Render backend (Web Service)

| Setting | Value |
| ------- | ----- |
| Root directory | `server` |
| Build command | `npm install --include=dev && npx prisma generate && npm run build && npm run prisma:migrate:deploy` |
| Start command | `npm run start` |
| Instances / concurrency | One instance; `WEB_CONCURRENCY=1` |

**Environment variables** (placeholders only — set real values in Render, not in git):

```bash
NODE_ENV=production
PORT=4000
WEB_CONCURRENCY=1
DATABASE_URL=<neon-connection-string>
JWT_SECRET=<long-random-secret>
CORS_ORIGIN=https://teamflow-ai-web.onrender.com
APP_URL=https://teamflow-ai-web.onrender.com
EMAIL_PROVIDER=resend
EMAIL_FROM="TeamFlow AI <noreply@yourdomain.com>"
RESEND_API_KEY=<resend-api-key>
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
GOOGLE_REDIRECT_URI=https://teamflow-ai-api.onrender.com/api/auth/google/callback
FILE_STORAGE_DRIVER=supabase
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
SUPABASE_STORAGE_BUCKET=teamflow-uploads
TASK_REMINDER_CRON_SECRET=<cron-shared-secret>
```

Notes:

- Render usually sets `PORT` automatically; the app reads `PORT` from env (`server/src/config/env.ts`).
- `npm run build` runs `tsc` and outputs `dist/server.js` (`server/tsconfig.json`).
- `npm run start` runs `node dist/server.js`.
- `--include=dev` keeps Prisma CLI available during build even when production install would omit `devDependencies`.
- Older shorter build lines (`npm install && npm run build && …`) may fail if Prisma CLI is not installed. Prefer the command above.
- **Realtime chat (Socket.IO)** shares the same HTTP port as the REST API. Correct for a **single** backend instance. Do not scale to multiple instances until a shared Socket.IO adapter (for example Redis) is added.
- **Online presence** is **in memory**. It is cleared on restart and rebuilt when clients reconnect. Horizontal scaling needs a shared presence store plus the Socket.IO Redis adapter. Redis is **not** implemented at this stage.

---

## 9. Render frontend (current) and Vercel (planned)

### Current: Render Web Service (frontend)

| Setting | Value |
| ------- | ----- |
| Root directory | repository root |
| Build command | `npm install --include=dev && npm run build` |
| Start command | `node dist/server/index.mjs` |

**Environment variable** (build-time):

```bash
VITE_API_URL=https://teamflow-ai-api.onrender.com
```

TanStack Start builds a Nitro `node-server` bundle; production start is `node dist/server/index.mjs` (not a static-only export).

### Planned: Vercel frontend only

| Setting | Value |
| ------- | ----- |
| Build command | `npm run build` |
| Adapter / output | To be verified during stage 104; the current Nitro preset is node-server |
| Env | `VITE_API_URL=https://teamflow-ai-api.onrender.com` |

After cutover:

1. Point Render `APP_URL` and `CORS_ORIGIN` at the Vercel URL.
2. Update Google Authorized JavaScript origins.
3. Redeploy the backend if env vars changed.
4. Keep Socket.IO and Express on Render — do **not** move the API to Vercel.

---

## 10. Database migrations

Provision PostgreSQL (Neon), then from `server/` (or via the Render build command):

```bash
npm install --include=dev
npx prisma generate
npm run prisma:migrate:deploy
```

- Use `prisma:migrate:deploy` in production and CI (non-interactive).
- Use `npm run prisma:migrate` only for **local development** (`migrate dev`).
- Do not edit applied migration history on a live database.

---

## 11. Build and start commands (manual)

### Backend

```bash
cd server
npm install --include=dev
npx prisma generate
npm run prisma:migrate:deploy
npm run build
NODE_ENV=production npm run start
```

### Frontend

```bash
# from repository root
echo 'VITE_API_URL=https://teamflow-ai-api.onrender.com' > .env
npm install --include=dev
npm run build
node dist/server/index.mjs
```

---

## 12. Deadline reminders (GitHub Actions)

Workflow: `.github/workflows/task-reminders.yml`

- Runs on a schedule (and `workflow_dispatch`)
- `POST https://teamflow-ai-api.onrender.com/api/internal/task-reminders/run`
- Authorization: `Bearer ${TASK_REMINDER_CRON_SECRET}`

Set the same secret in Render env and in the GitHub repository secrets. Do not commit the secret value.

---

## 13. Production smoke tests

After deploy, verify:

1. **Health:** `GET https://teamflow-ai-api.onrender.com/api/health` returns OK.
2. **Frontend loads:** open https://teamflow-ai-web.onrender.com (auth required for `/app/*`).
3. **API URL:** browser network tab shows requests to `teamflow-ai-api.onrender.com`, not `localhost:4000`.
4. **Email login:** register or sign in with email/password.
5. **Google login:** sign in with Google completes and lands in the app (if OAuth configured).
6. **Workspace loading:** dashboard / workspace switcher loads without errors.
7. **Project / task CRUD:** create, edit, complete, and delete a task; confirm Kanban updates.
8. **Files:** upload avatar, task attachment, and project document; with Supabase, files survive an API redeploy.
9. **Chat / realtime:** send workspace and DM messages; confirm realtime delivery, unread counts, and presence on a second session.
10. **Notifications:** trigger assignment / comment / invite and confirm the notification list updates; confirm deadline reminder path if testing the cron secret locally.
11. **AI summary:** open AI Assistant / regenerate; summary reflects accessible projects and tasks (no external LLM).
12. **Billing preview:** open `/app/billing`. Confirm current plan, usage, and real limits render. Paid plans show **Coming soon**. Plan-change controls are disabled. The UI must not show checkout or a working payment flow. The blocked plan mutation is covered by backend tests and is not part of the production smoke test.
13. **Invite link:** invitation email/link host matches `APP_URL`.
14. **RU/EN switch:** language toggle updates UI strings.

Full manual QA: [QA_CHECKLIST.md](./QA_CHECKLIST.md).

---

## Validation commands

From `server/`:

```bash
npm run typecheck
npm run build
NODE_ENV=production JWT_SECRET=dev-jwt-secret-change-in-production APP_URL=http://localhost:8080 CORS_ORIGIN=http://localhost:8080 npm run start
# Expected: startup error (JWT / localhost guards)

NODE_ENV=production JWT_SECRET=$(openssl rand -hex 32) APP_URL=https://app.example.com CORS_ORIGIN=https://app.example.com DATABASE_URL="postgresql://..." npm run start
# Expected: starts when DATABASE_URL and other required vars are valid
```

From repository root:

```bash
npm run build
# Production build without VITE_API_URL: check browser console for VITE_API_URL warning
VITE_API_URL=https://api.example.com npm run build
# Expected: build succeeds; bundle uses configured API URL
```
