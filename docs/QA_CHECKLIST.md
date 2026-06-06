# QA checklist

Manual checks before or after a production deploy. Pair with [DEPLOYMENT.md](./DEPLOYMENT.md) for env and build steps.

## Authentication

- [ ] Email/password signup (new user receives starter workspace data)
- [ ] Email/password login (existing user)
- [ ] Google login — existing user linked by email
- [ ] Google signup — new user creates account and workspace

## Workspace invitations

- [ ] Invite existing user (already has an account)
- [ ] Accept invite from email link (lands in correct workspace)
- [ ] Production invite link uses production domain (not localhost)

## Workspaces

- [ ] Create workspace
- [ ] Switch between workspaces
- [ ] Delete workspace (with confirmation)

## Tasks and projects

- [ ] Create task (board, project detail, tasks list)
- [ ] Edit task (title, status, priority, assignees, due date)
- [ ] Delete task
- [ ] Create / edit / delete project

## Team and UI

- [ ] Assignee avatars display on task cards and drawers
- [ ] Global notifications appear; auto-switch to relevant workspace when applicable
- [ ] Profile avatar upload and display
- [ ] Member profile drawer opens from assignee avatars

## Billing (demo)

- [ ] Switch billing plan (Free / Pro / Team preview)
- [ ] Plan limits reflected in UI (no real payment)

## Localization and theme

- [ ] RU / EN language switch updates UI copy
- [ ] Light / dark theme toggle (no flash on reload)

## Email (production)

- [ ] With `EMAIL_PROVIDER=resend`, workspace invitation email is delivered
- [ ] Invite accept URL opens the production frontend

## Regression notes

- Starter demo data should remain for new signups (sample project and onboarding tasks).
- Google sign-in button should fail gracefully with a clear message when Google OAuth is not configured.
