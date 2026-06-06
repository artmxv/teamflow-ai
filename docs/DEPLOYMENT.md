# Deployment guide

Step-by-step reference for deploying TeamFlow AI to production. For a manual QA pass after deploy, see [QA_CHECKLIST.md](./QA_CHECKLIST.md).

## Critical warning

**`APP_URL` must be your production frontend URL** (for example `https://app.example.com`), not `http://localhost:5173`.

If `APP_URL` points to localhost, workspace invitation links and Google OAuth redirects will send users to localhost and auth will fail in production.

Similarly, **`CORS_ORIGIN`** must match the deployed frontend origin, and **`GOOGLE_REDIRECT_URI`** must be the deployed backend callback URL when Google sign-in is enabled.

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

Never commit `server/.env` or a filled root `.env` with secrets.

---

## 2. Frontend env

Create `.env` in the **repository root** (see `.env.example`):

```bash
VITE_API_URL=https://api.example.com
```

- **Required in production** if the API is not at `http://localhost:4000`.
- Vite embeds `VITE_*` values at **build time**. Rebuild after changing the API URL.
- Do not put secrets in frontend env vars; they are exposed in the browser bundle.

Default for local dev: `http://localhost:4000` (see `src/lib/api/client.ts`).

---

## 3. Backend env

Copy `server/.env.example` to `server/.env` and set values for your host.

| Variable               | Required   | Notes                                                                               |
| ---------------------- | ---------- | ----------------------------------------------------------------------------------- |
| `PORT`                 | No         | Default `4000`; many hosts inject this                                              |
| `NODE_ENV`             | Yes (prod) | Use `production` when deployed                                                      |
| `CORS_ORIGIN`          | Yes (prod) | Exact frontend origin; no localhost in production                                   |
| `DATABASE_URL`         | Yes        | PostgreSQL URL for Prisma                                                           |
| `JWT_SECRET`           | Yes        | Long random string; must not be `dev-jwt-secret-change-in-production` in production |
| `APP_URL`              | Yes (prod) | Public frontend URL for invites and OAuth redirects                                 |
| `EMAIL_PROVIDER`       | No         | `console` (default) or `resend`                                                     |
| `EMAIL_FROM`           | If resend  | Verified sender in Resend                                                           |
| `RESEND_API_KEY`       | If resend  | Resend API key                                                                      |
| `GOOGLE_CLIENT_ID`     | Optional   | All three Google vars together, or leave all empty                                  |
| `GOOGLE_CLIENT_SECRET` | Optional   |                                                                                     |
| `GOOGLE_REDIRECT_URI`  | Optional   | Backend callback, e.g. `https://api.example.com/api/auth/google/callback`           |

Startup validation lives in `server/src/config/env.ts`. Misconfigured production or Resend settings fail fast at boot.

---

## 4. Google OAuth setup

1. Create an OAuth 2.0 client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Set **Authorized redirect URI** to your backend callback:
   ```text
   https://api.example.com/api/auth/google/callback
   ```
3. Set all three env vars in `server/.env`:
   ```bash
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=https://api.example.com/api/auth/google/callback
   ```
4. Ensure `APP_URL` is the production frontend URL (used after OAuth completes).

If Google env vars are all empty, the API starts normally and the sign-in page shows Google as unavailable when clicked.

---

## 5. Resend setup

1. Create a [Resend](https://resend.com) account and verify your sending domain.
2. Create an API key and set:
   ```bash
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_xxxxxxxx
   EMAIL_FROM="TeamFlow AI <noreply@yourdomain.com>"
   ```
3. Restart the API. With `EMAIL_PROVIDER=resend`, missing `RESEND_API_KEY` or `EMAIL_FROM` prevents startup.

For local dev without Resend, use `EMAIL_PROVIDER=console` (invites are logged to the server console).

---

## 6. Database migrations

Provision PostgreSQL, then from `server/`:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate:deploy
```

- Use `prisma:migrate:deploy` in production and CI (non-interactive).
- Use `npm run prisma:migrate` only for **local development** (`migrate dev`).
- Do not edit applied migration history on a live database.

Optional demo data (not for a real production tenant):

```bash
npm run db:seed
```

Latest migration: `20260604200000_add_workspace_billing_plan`.

---

## 7. Build and start commands

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
echo 'VITE_API_URL=https://api.example.com' > .env
npm install
npm run build
```

Serve the frontend build output from your static host or SSR platform.

### File uploads

Uploads are stored under `server/uploads/` on disk. Many PaaS containers use an ephemeral filesystem; mount persistent storage at that path or accept that uploads may be lost on redeploy.

---

## 8. Production smoke tests

After deploy, verify quickly:

1. **Health:** `GET https://api.example.com/api/health` returns OK.
2. **Auth:** Register or sign in with email/password.
3. **API URL:** Browser network tab shows requests to your API domain, not `localhost:4000`.
4. **Invite link:** Send a workspace invite; the email link host must match `APP_URL`, not localhost.
5. **Google (if enabled):** Sign in with Google completes and lands on the app dashboard.
6. **Resend (if enabled):** Invitation email is delivered (not only console log).

Full manual QA: [QA_CHECKLIST.md](./QA_CHECKLIST.md).

---

## Validation commands

From `server/`:

```bash
npm run typecheck
NODE_ENV=production JWT_SECRET=dev-jwt-secret-change-in-production APP_URL=http://localhost:5173 CORS_ORIGIN=http://localhost:5173 npm run start
# Expected: startup error (JWT / localhost guards)

NODE_ENV=production JWT_SECRET=$(openssl rand -hex 32) APP_URL=https://app.example.com CORS_ORIGIN=https://app.example.com DATABASE_URL="..." npm run start
# Expected: starts when DATABASE_URL and other required vars are valid
```

From repository root:

```bash
npm run lint
npm run build
```
