# Deployment guide

Step-by-step reference for the **current** TeamFlow AI production setup after the frontend cutover to Vercel.

**Current production**

| Surface         | URL / host                                                        |
| --------------- | ----------------------------------------------------------------- |
| Frontend        | https://teamflow-ai-murex.vercel.app (Vercel, TanStack Start SSR) |
| API + Socket.IO | https://teamflow-ai-api.onrender.com (Render)                     |
| Database        | Neon PostgreSQL                                                   |
| Files           | Private Supabase Storage                                          |
| Reminders       | GitHub Actions → API                                              |

**Temporary fallback (transitional only):** the previous Render frontend at https://teamflow-ai-web.onrender.com is kept as a fallback during the cutover period. It is not the primary production frontend.

**Architecture notes:**

- Frontend runs on Vercel as TanStack Start SSR.
- Backend Express API and Socket.IO continue on Render.
- The frontend deployment does not contain Prisma, backend env, or backend secrets.
- Google OAuth callback stays on the Render API URL.

For a broader manual QA pass, see [QA_CHECKLIST.md](./QA_CHECKLIST.md).

## Critical warnings

**`APP_URL` must be your primary production frontend URL** (currently `https://teamflow-ai-murex.vercel.app`), not `http://localhost:8080`.

If `APP_URL` points to localhost, workspace invitation links and Google OAuth redirects will send users to localhost and auth will fail in production.

**`CORS_ORIGIN`** must match allowed frontend origin(s) **exactly** (scheme + host + port if non-default). **No trailing slash.**

Current production (primary Vercel origin + temporary Render fallback):

```text
CORS_ORIGIN=https://teamflow-ai-web.onrender.com,https://teamflow-ai-murex.vercel.app
```

Both origins are temporarily allowed while the old Render frontend is kept as a fallback. After the fallback is fully retired, remove `https://teamflow-ai-web.onrender.com` from `CORS_ORIGIN`.

Do not use wildcard CORS. Random Vercel Preview URLs are not covered by the exact allowlist; see [Preview deployments](#preview-deployments).

**Google OAuth:** If the client secret was ever exposed during local development, **rotate or recreate** it before production. Never reuse a leaked secret. Keep the OAuth callback on the Render API; do not move it to Vercel.

**Realtime:** keep a **single** backend instance and `WEB_CONCURRENCY=1` while presence is in-memory.

Never commit `server/.env` or a filled root `.env` with secrets.

---

## 1. Required production env (summary)

| Area           | Required                                        |
| -------------- | ----------------------------------------------- |
| Database       | `DATABASE_URL` (Neon)                           |
| Auth           | `JWT_SECRET` (long random; not the dev default) |
| Frontend links | `APP_URL` (primary production frontend URL)     |
| CORS           | `CORS_ORIGIN` (allowed frontend origin(s))      |
| Runtime        | `NODE_ENV=production`                           |
| Frontend build | `VITE_API_URL` (production API URL)             |
| Files          | `FILE_STORAGE_DRIVER=supabase` + Supabase vars  |

Optional but common:

| Feature            | Variables                                                                             |
| ------------------ | ------------------------------------------------------------------------------------- |
| Google sign-in     | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (all three or none) |
| Email invites      | `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`                               |
| Deadline reminders | `TASK_REMINDER_CRON_SECRET` (+ GitHub Actions secret of the same name)                |

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

On Vercel, set the same build-time variable for Production and Preview:

```bash
VITE_API_URL=https://teamflow-ai-api.onrender.com
```

---

## 3. Backend env (Render)

For local dev, copy the backend example from the repository root:

```bash
# From the repository root
cp server/.env.example server/.env
```

On Render, set the same variables in the service dashboard.

| Variable                    | Required         | Notes                                                                                  |
| --------------------------- | ---------------- | -------------------------------------------------------------------------------------- |
| `PORT`                      | No               | Default `4000`; Render injects `PORT` automatically                                    |
| `NODE_ENV`                  | Yes (prod)       | `production`                                                                           |
| `CORS_ORIGIN`               | Yes (prod)       | Exact frontend origin(s); no trailing slash; no localhost in production                |
| `DATABASE_URL`              | Yes              | Neon PostgreSQL connection string for Prisma                                           |
| `JWT_SECRET`                | Yes              | Long random string; must not be `dev-jwt-secret-change-in-production`                  |
| `APP_URL`                   | Yes (prod)       | Public frontend URL for invites and OAuth redirects                                    |
| `EMAIL_PROVIDER`            | No               | `console` (default) or `resend`                                                        |
| `EMAIL_FROM`                | If resend        | Verified sender/domain in Resend                                                       |
| `RESEND_API_KEY`            | If resend        | Resend API key                                                                         |
| `GOOGLE_CLIENT_ID`          | Optional         | All three Google vars together, or leave all empty                                     |
| `GOOGLE_CLIENT_SECRET`      | Optional         | Rotate if previously exposed during dev                                                |
| `GOOGLE_REDIRECT_URI`       | Optional         | Backend callback, e.g. `https://teamflow-ai-api.onrender.com/api/auth/google/callback` |
| `FILE_STORAGE_DRIVER`       | Prod: `supabase` | Durable uploads on Render                                                              |
| `SUPABASE_URL`              | If supabase      | Project URL                                                                            |
| `SUPABASE_SERVICE_ROLE_KEY` | If supabase      | Service role; never expose to the frontend                                             |
| `SUPABASE_STORAGE_BUCKET`   | If supabase      | Bucket name                                                                            |
| `TASK_REMINDER_CRON_SECRET` | For reminders    | Bearer token for the internal reminders endpoint                                       |
| `YOOKASSA_SHOP_ID`          | For billing      | YooKassa shop identifier; server only                                                  |
| `YOOKASSA_SECRET_KEY`       | For billing      | YooKassa secret key; server only                                                       |
| `YOOKASSA_RETURN_URL`       | Optional         | Defaults to `APP_URL/app/billing`                                                      |
| `YOOKASSA_MODE`             | No               | `test` by default; set `live` explicitly for real payments                             |
| `WEB_CONCURRENCY`           | Yes for presence | Keep `1` while presence is in-memory                                                   |

**Current production values for frontend-facing URLs** (non-secret):

```text
APP_URL=https://teamflow-ai-murex.vercel.app
CORS_ORIGIN=https://teamflow-ai-web.onrender.com,https://teamflow-ai-murex.vercel.app
GOOGLE_REDIRECT_URI=https://teamflow-ai-api.onrender.com/api/auth/google/callback
```

Why these values:

- `APP_URL` uses the Vercel URL so invitation links and post-OAuth redirects land on the primary frontend.
- `CORS_ORIGIN` temporarily allows both the Vercel production origin and the old Render frontend fallback.
- After the Render frontend is fully retired, remove its origin from `CORS_ORIGIN`.
- Origins must not include a trailing slash.

Do not document real values for `JWT_SECRET`, `DATABASE_URL`, Supabase service role, Resend, YooKassa, or cron secrets.

### YooKassa billing V1

- Billing is a one-time plan activation without subscriptions or automatic renewal.
- Keep `YOOKASSA_MODE=test` until live checkout and webhook delivery are intentionally enabled.
- Configure the webhook URL as `https://<api-host>/api/billing/webhook` for `payment.succeeded` and `payment.canceled`.
- The webhook body is untrusted. TeamFlow locates a local payment and performs an authenticated YooKassa Payment GET before applying any entitlement.
- The frontend return URL never activates a plan by itself.

Startup validation lives in `server/src/config/env.ts`. Misconfigured production or Resend settings fail fast at boot.

---

## 4. Google OAuth setup

1. Create an OAuth 2.0 **Web application** client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. **Rotate or recreate the client secret** if it was ever committed, logged, or shared during development.
3. Set **Authorized JavaScript origins** to the primary frontend origin:
   ```text
   https://teamflow-ai-murex.vercel.app
   ```
   During the transitional period you may also keep the temporary Render fallback origin if that UI is still used for OAuth testing.
4. Set **Authorized redirect URI** to the **backend** callback (unchanged; do not move to Vercel):
   ```text
   https://teamflow-ai-api.onrender.com/api/auth/google/callback
   ```
5. Set all three env vars on the API service (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and):
   ```bash
   GOOGLE_REDIRECT_URI=https://teamflow-ai-api.onrender.com/api/auth/google/callback
   ```
6. Ensure `APP_URL` is the primary production frontend URL (`https://teamflow-ai-murex.vercel.app`).

Flow: browser → frontend “Continue with Google” → backend `/api/auth/google` → Google → backend `/api/auth/google/callback` → redirect to frontend (`APP_URL`) with session token handling.

If Google env vars are all empty, the API starts normally and the sign-in page shows Google as unavailable when clicked.

---

## 5. Resend setup

1. Create a [Resend](https://resend.com) account and **verify your sending domain**.
2. Create an API key and set on Render: `EMAIL_PROVIDER=resend`, `EMAIL_FROM` for a verified sender, and `RESEND_API_KEY` (set the real key only in the Render dashboard).
   ```bash
   EMAIL_PROVIDER=resend
   EMAIL_FROM="TeamFlow AI <noreply@yourdomain.com>"
   ```
3. **`EMAIL_FROM` must use a verified sender or domain in Resend.** Do not use `noreply@example.com` in production.
4. Restart the API. With `EMAIL_PROVIDER=resend`, missing `RESEND_API_KEY` or `EMAIL_FROM` prevents startup.

For local dev without Resend, use `EMAIL_PROVIDER=console` (invites are logged to the server console).

---

## 6. File uploads (local disk or Supabase Storage)

Uploads (avatars, task attachments, project documents, chat files) are handled in `server/src/lib/file-storage/`.

| `FILE_STORAGE_DRIVER` | Behavior                                                                            |
| --------------------- | ----------------------------------------------------------------------------------- |
| `local` (default)     | Files on disk under `server/uploads/` (fine for local dev)                          |
| `supabase`            | Durable object storage via Supabase Storage (**required for production on Render**) |

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
SUPABASE_STORAGE_BUCKET=teamflow-uploads
```

Also set `SUPABASE_SERVICE_ROLE_KEY` in the Render dashboard only (never in git or frontend env).

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
4. Apply migrations as part of the API build (see section 10) or manually with `npm run prisma:migrate:deploy`.

Do not run `prisma migrate dev` against production. Use `npm run prisma:migrate:deploy` only.

Optional demo data (not for a real production tenant):

```bash
cd server
npm run db:seed
```

---

## 8. Render backend (Web Service)

| Setting                 | Value                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| Root directory          | `server`                                                                                             |
| Build command           | `npm install --include=dev && npx prisma generate && npm run build && npm run prisma:migrate:deploy` |
| Start command           | `npm run start`                                                                                      |
| Instances / concurrency | One instance; `WEB_CONCURRENCY=1`                                                                    |

**Non-secret environment variables** (set secret values only in the Render dashboard, never in git):

```bash
NODE_ENV=production
PORT=4000
WEB_CONCURRENCY=1
CORS_ORIGIN=https://teamflow-ai-web.onrender.com,https://teamflow-ai-murex.vercel.app
APP_URL=https://teamflow-ai-murex.vercel.app
EMAIL_PROVIDER=resend
EMAIL_FROM="TeamFlow AI <noreply@yourdomain.com>"
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_REDIRECT_URI=https://teamflow-ai-api.onrender.com/api/auth/google/callback
FILE_STORAGE_DRIVER=supabase
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_STORAGE_BUCKET=teamflow-uploads
```

Also configure in Render only (do not paste real values into docs or git): `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TASK_REMINDER_CRON_SECRET`, `YOOKASSA_SHOP_ID`, and `YOOKASSA_SECRET_KEY`. Leave `YOOKASSA_MODE=test` unless live billing is deliberately enabled.

Notes:

- Render usually sets `PORT` automatically; the app reads `PORT` from env (`server/src/config/env.ts`).
- `npm run build` runs `tsc` and outputs `dist/server.js` (`server/tsconfig.json`).
- `npm run start` runs `node dist/server.js`.
- `--include=dev` keeps Prisma CLI available during build even when production install would omit `devDependencies`.
- Older shorter build lines (`npm install && npm run build && …`) may fail if Prisma CLI is not installed. Prefer the command above.
- **Realtime chat (Socket.IO)** shares the same HTTP port as the REST API. Correct for a **single** backend instance. Do not scale to multiple instances until a shared Socket.IO adapter (for example Redis) is added.
- **Online presence** is **in memory**. It is cleared on restart and rebuilt when clients reconnect. Horizontal scaling needs a shared presence store plus the Socket.IO Redis adapter. Redis is **not** implemented at this stage.

---

## 9. Vercel frontend (current) and Render frontend (temporary fallback)

### Current: Vercel (primary production frontend)

| Setting           | Value                               |
| ----------------- | ----------------------------------- |
| Root Directory    | `.`                                 |
| Framework Preset  | `Other`                             |
| Node.js Version   | `22.x`                              |
| Install Command   | `npm install --include=dev`         |
| Build Command     | `NITRO_PRESET=vercel npm run build` |
| Output Directory  | leave blank                         |
| Production Branch | `main`                              |

**Environment variable** (Production and Preview):

```bash
VITE_API_URL=https://teamflow-ai-api.onrender.com
```

Leave **Output Directory** blank. Do not set it to `dist`. With `NITRO_PRESET=vercel`, Nitro writes the Vercel Build Output API under `.vercel/output`, and Vercel consumes that layout automatically.

Do **not** configure a Vercel start command. The serverless runtime is started by Vercel.

Vercel hosts only the frontend SSR app. Do not deploy Express, Socket.IO, Prisma, or backend secrets to Vercel.

### Dual-target frontend build

The same repository supports two Nitro presets:

**Render / local compatibility** (default preset `node-server`):

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

| Detail       | Value                                      |
| ------------ | ------------------------------------------ |
| Nitro preset | `vercel`                                   |
| Output       | `.vercel/output` (Vercel Build Output API) |

Notes:

- The default preset remains `node-server` so local and Render builds stay compatible.
- The Vercel preset is enabled only via `NITRO_PRESET=vercel`.
- `.vercel/` is generated output / CLI metadata and is ignored by Git.
- This dual-target approach keeps the Render frontend available as a temporary fallback without a separate configuration branch.

### Temporary fallback: Render Web Service (frontend)

| Setting        | Value                                        |
| -------------- | -------------------------------------------- |
| Root directory | repository root                              |
| Build command  | `npm install --include=dev && npm run build` |
| Start command  | `node dist/server/index.mjs`                 |

**Environment variable** (build-time):

```bash
VITE_API_URL=https://teamflow-ai-api.onrender.com
```

TanStack Start builds a Nitro `node-server` bundle; production start is `node dist/server/index.mjs` (not a static-only export). Use this Render service only as a transitional fallback while the Vercel cutover settles.

### Preview deployments

- Random Vercel Preview URLs are **not** allowed by the current exact CORS allowlist.
- For a full API smoke test against a specific preview deployment, temporarily add that exact preview origin to `CORS_ORIGIN` on the Render API.
- Do not use wildcard CORS.
- The production Vercel domain (`https://teamflow-ai-murex.vercel.app`) is already allowed.

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

### Frontend (Render / local compatibility)

```bash
# from repository root
echo 'VITE_API_URL=https://teamflow-ai-api.onrender.com' > .env
npm install --include=dev
npm run build
node dist/server/index.mjs
```

### Frontend (Vercel-oriented build)

```bash
# from repository root
VITE_API_URL=https://teamflow-ai-api.onrender.com NITRO_PRESET=vercel npm run build
# Nitro writes .vercel/output for the Vercel Build Output API
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

Confirmed on the primary Vercel frontend (`https://teamflow-ai-murex.vercel.app`) after cutover:

- Root and SSR routes return successfully
- Email/password login and Google OAuth
- Dashboard and workspace data
- Projects, tasks, and Kanban status persistence after reload
- Chat and Socket.IO
- Private task/project attachments (upload and delete)
- Invitation links using the Vercel origin (`APP_URL`)

Also keep checking:

1. **Health:** `GET https://teamflow-ai-api.onrender.com/api/health` returns OK.
2. **API URL:** browser network tab shows requests to `teamflow-ai-api.onrender.com`, not `localhost:4000`.
3. **AI summary:** open AI Assistant / regenerate; summary reflects accessible projects and tasks (no external LLM).
4. **Billing:** open `/app/billing`. Confirm current plan, usage, limits, one-time activation wording, and the configured test/live mode. A paid upgrade must remain pending until backend YooKassa confirmation; a downgrade must apply without checkout.
5. **RU/EN switch:** language toggle updates UI strings.

Full manual QA: [QA_CHECKLIST.md](./QA_CHECKLIST.md).

### Post-migration follow-up (not fixed by the cutover)

These UI issues remain known follow-ups and are **not** claimed as resolved:

- Attachment readiness / loading UX after page reload
- Duplicate empty-state CTA buttons
- Sidebar billing-card positioning
- Invite page localization / responsive polish
- Favicon and broader visual redesign

---

## Current production limitations

These remain honest product limits after the Vercel frontend cutover:

- Backend on Render may cold-start after idle time
- Online presence is in-memory and single-instance (`WEB_CONCURRENCY=1`)
- Billing is a read-only preview; no payment provider
- Workspace briefings do not call an external LLM
- Auth JWT is stored in `localStorage` (not httpOnly cookies / refresh-token flow)

---

## Validation commands

From `server/`:

```bash
npm run typecheck
npm run build
# Rejected start: production NODE_ENV with the known-dev JWT placeholder and localhost APP_URL / CORS_ORIGIN
# Expected: startup error (JWT / localhost guards)

# Accepted start: production NODE_ENV with a strong random JWT, real APP_URL / CORS_ORIGIN, and a valid Neon DATABASE_URL
# Expected: starts when DATABASE_URL and other required vars are valid
```

From repository root:

```bash
npm run build
# Production build without VITE_API_URL: check browser console for VITE_API_URL warning
VITE_API_URL=https://api.example.com npm run build
# Expected: build succeeds; bundle uses configured API URL

NITRO_PRESET=vercel npm run build
# Expected: Nitro writes Vercel Build Output API under .vercel/output
```
