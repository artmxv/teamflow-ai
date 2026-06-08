# Deployment guide

Step-by-step reference for deploying TeamFlow AI to production.

**Target stack:** Frontend on Vercel, API on Render, PostgreSQL on Neon, email via Resend, Google OAuth via Google Cloud.

For a manual QA pass after deploy, see [QA_CHECKLIST.md](./QA_CHECKLIST.md).

## Critical warnings

**`APP_URL` must be your production frontend URL** (for example `https://app.example.com`), not `http://localhost:5173`.

If `APP_URL` points to localhost, workspace invitation links and Google OAuth redirects will send users to localhost and auth will fail in production.

**`CORS_ORIGIN`** must match the deployed frontend origin **exactly** (scheme + host + port if non-default). **No trailing slash.** Example: `https://app.example.com`, not `https://app.example.com/`.

Multiple origins (production + Vercel preview) are comma-separated:

```text
CORS_ORIGIN=https://app.example.com,https://teamflow-ai-git-main-yourorg.vercel.app
```

**Google OAuth:** If the client secret was ever exposed during local development, **rotate or recreate the Google OAuth client secret** before production. Never reuse a leaked secret.

Never commit `server/.env` or a filled root `.env` with secrets.

---

## 1. Required production env (summary)

| Area           | Required                                        |
| -------------- | ----------------------------------------------- |
| Database       | `DATABASE_URL`                                  |
| Auth           | `JWT_SECRET` (long random; not the dev default) |
| Frontend links | `APP_URL` (production frontend URL)             |
| CORS           | `CORS_ORIGIN` (production frontend URL)         |
| Runtime        | `NODE_ENV=production`                           |
| Frontend build | `VITE_API_URL` (production API URL)             |

Optional but common:

| Feature        | Variables                                                                             |
| -------------- | ------------------------------------------------------------------------------------- |
| Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (all three or none) |
| Email invites  | `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`                               |

---

## 2. Frontend env (Vercel)

Create `.env` in the **repository root** for local overrides (see `.env.example`):

```bash
VITE_API_URL=https://your-api-domain
```

- **Required in production** if the API is not at `http://localhost:4000`.
- Vite embeds `VITE_*` values at **build time**. Rebuild after changing the API URL.
- Do not put secrets in frontend env vars; they are exposed in the browser bundle.
- Do not hardcode a production API URL in source; always use `VITE_API_URL`.
- If `VITE_API_URL` is missing in a production build, the app logs a console warning and falls back to `http://localhost:4000` (which will not work in production).

Default for local dev: `http://localhost:4000` (see `src/lib/api/client.ts`).

---

## 3. Backend env (Render)

Copy `server/.env.example` to `server/.env` for local dev. On Render, set the same variables in the service dashboard.

| Variable               | Required   | Notes                                                                               |
| ---------------------- | ---------- | ----------------------------------------------------------------------------------- |
| `PORT`                 | No         | Default `4000`; Render injects `PORT` automatically — the app reads it from env     |
| `NODE_ENV`             | Yes (prod) | Use `production` when deployed                                                      |
| `CORS_ORIGIN`          | Yes (prod) | Exact frontend origin(s); no trailing slash; no localhost in production             |
| `DATABASE_URL`         | Yes        | Neon PostgreSQL connection string for Prisma                                        |
| `JWT_SECRET`           | Yes        | Long random string; must not be `dev-jwt-secret-change-in-production` in production |
| `APP_URL`              | Yes (prod) | Public frontend URL for invites and OAuth redirects                                 |
| `EMAIL_PROVIDER`       | No         | `console` (default) or `resend`                                                     |
| `EMAIL_FROM`           | If resend  | Verified sender/domain in Resend; do not use `noreply@example.com` in production    |
| `RESEND_API_KEY`       | If resend  | Resend API key                                                                      |
| `GOOGLE_CLIENT_ID`     | Optional   | All three Google vars together, or leave all empty                                  |
| `GOOGLE_CLIENT_SECRET` | Optional   | Rotate if previously exposed during dev                                             |
| `GOOGLE_REDIRECT_URI`  | Optional   | Backend callback, e.g. `https://your-api-domain/api/auth/google/callback`           |

Startup validation lives in `server/src/config/env.ts`. Misconfigured production or Resend settings fail fast at boot.

---

## 4. Google OAuth setup

1. Create an OAuth 2.0 **Web application** client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. **Rotate or recreate the client secret** if it was ever committed, logged, or shared during development.
3. Set **Authorized JavaScript origins**:
   ```text
   https://your-frontend-domain
   ```
4. Set **Authorized redirect URI** (backend callback):
   ```text
   https://your-api-domain/api/auth/google/callback
   ```
5. Set all three env vars on Render:
   ```bash
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=https://your-api-domain/api/auth/google/callback
   ```
6. Ensure `APP_URL` is the production frontend URL (used after OAuth completes).

If Google env vars are all empty, the API starts normally and the sign-in page shows Google as unavailable when clicked.

---

## 5. Resend setup

1. Create a [Resend](https://resend.com) account and **verify your sending domain**.
2. Create an API key and set on Render:
   ```bash
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_xxxxxxxx
   EMAIL_FROM="TeamFlow AI <noreply@yourdomain.com>"
   ```
3. **`EMAIL_FROM` must use a verified sender or domain in Resend.** Do not use `noreply@example.com` in production.
4. Restart the API. With `EMAIL_PROVIDER=resend`, missing `RESEND_API_KEY` or `EMAIL_FROM` prevents startup.

For local dev without Resend, use `EMAIL_PROVIDER=console` (invites are logged to the server console).

---

## 6. File uploads (local disk or Supabase Storage)

Uploads (avatars, task attachments, project documents) are handled in `server/src/lib/file-storage/`.

| `FILE_STORAGE_DRIVER` | Behavior |
| --------------------- | -------- |
| `local` (default)     | Files on disk under `server/uploads/` (fine for local dev) |
| `supabase`            | Durable object storage via Supabase Storage (recommended on Render) |

**Local disk (`FILE_STORAGE_DRIVER=local`):**

- On Render, the default filesystem is **ephemeral**. Uploads may be **lost on redeploy** unless you attach a **persistent disk** mounted at `server/uploads`.

**Supabase Storage (`FILE_STORAGE_DRIVER=supabase`):**

1. Create a [Supabase](https://supabase.com) project.
2. In **Storage**, create a bucket (for example `teamflow-uploads`).
3. Make the `avatars/` folder publicly readable (bucket public, or a storage policy for `avatars/*`). Task and project files stay private; the API redirects to short-lived signed URLs from authenticated `GET .../file` routes using the service role key.
4. Copy **Project URL**, **service role key** (Settings → API), and bucket name to Render:

```bash
FILE_STORAGE_DRIVER=supabase
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_STORAGE_BUCKET=teamflow-uploads
```

**Never commit** `SUPABASE_SERVICE_ROLE_KEY` or expose it to the frontend. The Vite app does not talk to Supabase directly for uploads.

Object keys inside the bucket:

- `avatars/{filename}`
- `workspaces/{workspaceId}/projects/{projectId}/{uuid}-{safeFilename}`
- `workspaces/{workspaceId}/tasks/{taskId}/{uuid}-{safeFilename}`

Legacy keys (`projects/{projectId}/{filename}`, `tasks/{taskId}/{filename}`) are still resolved for older uploads.

Private task and project files are opened via authenticated `GET .../file` routes. The API checks permissions, then redirects to a short-lived Supabase signed URL (about 2 minutes). The frontend never talks to Supabase directly.

---

## 7. Neon PostgreSQL

1. Create a project at [Neon](https://neon.tech).
2. Copy the **pooled** connection string if available (recommended for serverless/PaaS workloads).
3. Set `DATABASE_URL` on Render to that connection string.
4. Apply migrations once the API service can reach the database (see section 9).

Do not run `prisma migrate dev` against production. Use `npm run prisma:migrate:deploy` only.

Optional demo data (not for a real production tenant):

```bash
cd server
npm run db:seed
```

---

## 8. Render backend (Web Service)

| Setting        | Value                                                           |
| -------------- | --------------------------------------------------------------- |
| Root directory | `server`                                                        |
| Build command  | `npm install && npm run build && npm run prisma:migrate:deploy` |
| Start command  | `npm run start`                                                 |

**Environment variables** (placeholders — use your real values in Render, not in git):

```bash
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://...
JWT_SECRET=<long-random-secret>
CORS_ORIGIN=https://your-frontend-domain
APP_URL=https://your-frontend-domain
EMAIL_PROVIDER=resend
EMAIL_FROM="TeamFlow AI <noreply@yourdomain.com>"
RESEND_API_KEY=re_...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://your-api-domain/api/auth/google/callback
FILE_STORAGE_DRIVER=supabase
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_STORAGE_BUCKET=teamflow-uploads
```

Notes:

- Render usually sets `PORT` automatically; the app reads `PORT` from env (`server/src/config/env.ts`).
- `npm run build` runs `tsc` and outputs `dist/server.js` (`server/tsconfig.json`).
- `npm run start` runs `node dist/server.js`.
- After you know the Vercel frontend URL, set `APP_URL` and `CORS_ORIGIN`, then redeploy the backend if env changed.

---

## 9. Vercel frontend

| Setting       | Value                 |
| ------------- | --------------------- |
| Build command | `npm run build`       |
| Output        | Vite default (`dist`) |

**Environment variable** (Vercel project settings):

```bash
VITE_API_URL=https://your-api-domain
```

After the first frontend deploy:

1. Copy the production frontend URL into Render `APP_URL` and `CORS_ORIGIN`.
2. Add Vercel preview URL to `CORS_ORIGIN` if you need preview deployments to call the API.
3. Redeploy the backend if env vars changed.

---

## 10. Database migrations

Provision PostgreSQL (Neon), then from `server/`:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate:deploy
```

- Use `prisma:migrate:deploy` in production and CI (non-interactive).
- Use `npm run prisma:migrate` only for **local development** (`migrate dev`).
- Do not edit applied migration history on a live database.
- Do not add new Prisma migrations unless schema changes require them.

Latest migration: `20260604200000_add_workspace_billing_plan`.

---

## 11. Build and start commands (manual)

### Backend

```bash
cd server
npm install
npm run prisma:generate
npm run prisma:migrate:deploy
npm run build
NODE_ENV=production npm run start
```

### Frontend

```bash
# from repository root
echo 'VITE_API_URL=https://your-api-domain' > .env
npm install
npm run build
```

---

## 12. Production smoke tests

After deploy, verify:

1. **Health:** `GET https://your-api-domain/api/health` returns OK.
2. **Frontend loads:** open the Vercel URL.
3. **API URL:** browser network tab shows requests to your API domain, not `localhost:4000`.
4. **Email login:** register or sign in with email/password.
5. **Google login:** sign in with Google completes and lands on the app dashboard (if OAuth configured).
6. **Invite link:** send a workspace invite; the email link host must match `APP_URL`, not localhost.
7. **Resend email:** invitation email is delivered (not only console log).
8. **Task CRUD:** create, edit, complete, and delete a task.
9. **File uploads:** upload an avatar, task attachment, and project document. With `FILE_STORAGE_DRIVER=supabase`, files should survive an API redeploy.
10. **Notifications:** trigger an action that creates a notification and confirm it appears.
11. **Billing mock:** switch workspace plan in settings (mock billing, no real payments).
12. **RU/EN switch:** change language and confirm UI strings update.

Full manual QA: [QA_CHECKLIST.md](./QA_CHECKLIST.md).

---

## Validation commands

From `server/`:

```bash
npm run typecheck
npm run build
NODE_ENV=production JWT_SECRET=dev-jwt-secret-change-in-production APP_URL=http://localhost:5173 CORS_ORIGIN=http://localhost:5173 npm run start
# Expected: startup error (JWT / localhost guards)

NODE_ENV=production JWT_SECRET=$(openssl rand -hex 32) APP_URL=https://app.example.com CORS_ORIGIN=https://app.example.com DATABASE_URL="postgresql://..." npm run start
# Expected: starts when DATABASE_URL and other required vars are valid
```

From repository root:

```bash
npm run lint
npm run build
# Production build without VITE_API_URL: check browser console for VITE_API_URL warning
VITE_API_URL=https://api.example.com npm run build
# Expected: build succeeds; bundle uses configured API URL
```
