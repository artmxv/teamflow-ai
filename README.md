# TeamFlow AI

Modern SaaS project management application with AI assistant, team workspaces, projects, tasks, Kanban board, analytics dashboard and team roles.

TeamFlow AI is a portfolio fullstack project focused on modern product development workflows. The current version includes a polished frontend prototype with mock data. The next development stages include real authentication, backend API, PostgreSQL database, Prisma ORM and AI integration.

## Demo

Live demo: coming soon
Repository: TeamFlow AI

## Features

### Marketing website

- Landing page
- Product overview
- Feature sections
- Pricing preview
- Responsive layout
- Dark/light theme support
- EN/RU language switcher

### Application dashboard

- SaaS application layout
- Sidebar navigation
- Topbar with workspace controls
- Dashboard metrics
- Project progress widgets
- Recent activity feed
- AI insights section
- Charts and analytics widgets

### Project management

- Projects page
- Project cards and list views
- Project statuses
- Progress indicators
- Kanban board
- Task cards
- Task details drawer
- Task priorities
- Due dates
- Assignees
- Labels
- Comments and attachments indicators

### Team management

- Team members page
- User roles
- Member status badges
- Permissions overview
- Invite member UI

### AI Assistant

- AI assistant page
- Suggested prompts
- Project context selector
- AI answer cards
- Weekly summary example
- Generated checklist example

### Settings and billing

- Profile settings
- Workspace settings
- Language settings
- Theme settings
- Notification settings
- Security settings
- Billing page
- Plan and usage cards
- Billing history table

## Tech Stack

### Frontend

- React 19
- TypeScript
- TanStack Start
- TanStack Router
- TanStack Query
- Vite
- Tailwind CSS 4
- shadcn/ui
- Radix UI
- Recharts
- Lucide React
- React Hook Form
- Zod

### Tooling

- ESLint
- Prettier
- npm
- Git
- GitHub

## Current Status

The current version is a frontend prototype with mock data.

Implemented:

- Landing page
- Auth pages
- Internal app layout
- Dashboard
- Projects page
- Kanban board
- Tasks page
- AI Assistant page
- Team page
- Settings page
- Billing page
- Theme toggle
- Basic EN/RU language switcher
- Mock data structure

Not implemented yet:

- Real authentication
- Backend API
- Database
- Real user sessions
- Real project/task CRUD
- AI API integration
- File uploads
- Production deployment

## Planned Backend Stack

The next stage is to add a real backend:

- Node.js
- Express
- PostgreSQL
- Prisma ORM
- JWT authentication
- Zod validation
- Docker
- REST API
- TanStack Query integration on frontend

## Planned Database Models

Planned main entities:

- User
- Workspace
- WorkspaceMember
- Project
- Task
- TaskComment
- TaskActivity
- Attachment
- AiSummary
- BillingPlan

## Project Structure

```text
src/
  components/
    app/
    auth/
    ui/
  hooks/
  lib/
  routes/
  router.tsx
  routeTree.gen.ts
  server.ts
  start.ts
  styles.css
```

Important files:

```text
src/routes/
```

Application pages and file-based routes.

```text
src/components/app/
```

Main reusable application components such as sidebar, topbar, app shell, task card and task drawer.

```text
src/components/ui/
```

shadcn/ui and Radix UI based components.

```text
src/lib/mock-data.ts
```

Mock data used by the current frontend prototype.

```text
src/lib/i18n.tsx
```

Basic language provider and EN/RU translation logic.

```text
src/lib/theme.tsx
```

Theme provider for dark/light mode.

## Getting Started

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Available Scripts

```bash
npm run dev
```

Starts the development server.

```bash
npm run build
```

Builds the application for production.

```bash
npm run preview
```

Runs a local preview of the production build.

```bash
npm run lint
```

Runs ESLint.

```bash
npm run format
```

Formats the project with Prettier.

## Roadmap

### Stage 1 — Frontend prototype

- [x] Generate initial UI prototype
- [x] Add landing page
- [x] Add internal app screens
- [x] Add mock data
- [x] Add dashboard, projects, tasks and Kanban pages
- [x] Add AI Assistant mock page
- [x] Add team, settings and billing pages

### Stage 2 — Frontend cleanup

- [ ] Improve folder structure
- [ ] Clean mock data
- [ ] Improve EN/RU translations
- [ ] Improve task drawer interactions
- [ ] Add create project modal logic
- [ ] Add create task modal logic
- [ ] Add local state for task status changes
- [ ] Improve responsive layout
- [ ] Add screenshots to README

### Stage 3 — Backend API

- [ ] Add Express server
- [ ] Add Prisma
- [ ] Add PostgreSQL
- [ ] Add User model
- [ ] Add Workspace model
- [ ] Add Project model
- [ ] Add Task model
- [ ] Add authentication
- [ ] Add protected routes
- [ ] Add CRUD API for projects and tasks

### Stage 4 — Frontend and backend integration

- [ ] Replace mock data with API calls
- [ ] Add TanStack Query hooks
- [ ] Add loading states
- [ ] Add error states
- [ ] Add form validation
- [ ] Add optimistic updates

### Stage 5 — AI features

- [ ] Add AI summary endpoint
- [ ] Add generated task checklist
- [ ] Add project weekly summary
- [ ] Add AI assistant chat history

### Stage 6 — Production

- [ ] Add Docker configuration
- [ ] Add environment variables
- [ ] Add deployment
- [ ] Add demo user
- [ ] Add screenshots
- [ ] Make repository public

## Portfolio Goal

This project is designed to demonstrate skills required for a Middle Fullstack JavaScript Developer role:

- Modern React application architecture
- TypeScript usage
- File-based routing
- SaaS dashboard UI
- Component-based development
- Mock-to-API migration plan
- Backend API planning
- Authentication planning
- Database modeling
- AI feature integration planning
- Production-oriented project structure
