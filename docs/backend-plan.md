# TeamFlow AI Backend Plan

This document describes the planned backend architecture for TeamFlow AI.

The current frontend uses mock data from `src/lib/mock-data.ts`. The backend will replace this mock data with real API responses while keeping the same product concepts: users, workspaces, projects, tasks, comments, activity logs, attachments and AI summaries.

## Backend Goal

Build a production-oriented REST API for a SaaS project management application.

The backend should support:

- user registration and login
- JWT authentication
- workspace-based multi-user structure
- roles and permissions
- projects
- tasks
- comments
- task activity history
- attachments metadata
- AI-generated summaries
- PostgreSQL persistence
- Prisma ORM
- Zod validation

## Planned Backend Stack

- Node.js
- Express
- TypeScript
- PostgreSQL
- Prisma ORM
- Zod
- JWT
- bcrypt
- dotenv
- cors
- helmet
- morgan
- Docker

## Current Frontend Mock Entities

The frontend currently contains these main mock entities:

- `Member`
- `Project`
- `Task`
- `Comment`

The current task model already includes:

- project relation
- assignee relation
- comments
- checklist
- activity
- attachments
- priority
- status
- due date
- labels

The backend database will split nested frontend fields into normalized relational tables.

## Database Entities

### User

Represents an application user.

Fields:

- `id`
- `name`
- `email`
- `passwordHash`
- `avatar`
- `createdAt`
- `updatedAt`

Relations:

- one user can belong to many workspaces through `WorkspaceMember`
- one user can be assigned to many tasks
- one user can create comments
- one user can create activity log records

### Workspace

Represents a team or company workspace.

Fields:

- `id`
- `name`
- `slug`
- `createdAt`
- `updatedAt`

Relations:

- one workspace has many members
- one workspace has many projects
- one workspace has many tasks through projects

### WorkspaceMember

Join table between users and workspaces.

Fields:

- `id`
- `workspaceId`
- `userId`
- `role`
- `status`
- `joinedAt`

Roles:

- `OWNER`
- `ADMIN`
- `MEMBER`

Statuses:

- `ACTIVE`
- `INVITED`
- `OFFLINE`

Relations:

- belongs to one workspace
- belongs to one user

### Project

Represents a project inside a workspace.

Fields:

- `id`
- `workspaceId`
- `name`
- `description`
- `status`
- `color`
- `dueDate`
- `createdAt`
- `updatedAt`

Statuses:

- `PLANNING`
- `ACTIVE`
- `ON_HOLD`
- `COMPLETED`

Relations:

- belongs to one workspace
- has many tasks

Computed values:

- `progress`
- `openTasks`
- `totalTasks`

These values can be computed on the backend instead of stored directly.

### Task

Represents a work item inside a project.

Fields:

- `id`
- `key`
- `projectId`
- `title`
- `description`
- `status`
- `priority`
- `assigneeId`
- `dueDate`
- `createdAt`
- `updatedAt`

Statuses:

- `BACKLOG`
- `TODO`
- `IN_PROGRESS`
- `REVIEW`
- `DONE`

Priorities:

- `LOW`
- `MEDIUM`
- `HIGH`
- `URGENT`

Relations:

- belongs to one project
- can be assigned to one user
- has many comments
- has many checklist items
- has many activity records
- has many attachments

### TaskComment

Represents a comment on a task.

Fields:

- `id`
- `taskId`
- `authorId`
- `body`
- `createdAt`
- `updatedAt`

Relations:

- belongs to one task
- belongs to one author user

### TaskChecklistItem

Represents a checklist item inside a task.

Fields:

- `id`
- `taskId`
- `label`
- `done`
- `createdAt`
- `updatedAt`

Relations:

- belongs to one task

### TaskActivity

Represents task history.

Fields:

- `id`
- `taskId`
- `userId`
- `action`
- `metadata`
- `createdAt`

Examples:

- task created
- status changed
- assignee changed
- comment added
- attachment uploaded

Relations:

- belongs to one task
- optionally belongs to one user

### Attachment

Represents uploaded file metadata.

Fields:

- `id`
- `taskId`
- `name`
- `url`
- `mimeType`
- `size`
- `createdAt`

Relations:

- belongs to one task

### AiSummary

Represents AI-generated summary for a task or project.

Fields:

- `id`
- `workspaceId`
- `projectId`
- `taskId`
- `type`
- `content`
- `createdAt`

Types:

- `TASK_SUMMARY`
- `PROJECT_SUMMARY`
- `WEEKLY_SUMMARY`
- `CHECKLIST`

Relations:

- belongs to one workspace
- can belong to one project
- can belong to one task

## Planned Prisma Enums

```prisma
enum WorkspaceRole {
  OWNER
  ADMIN
  MEMBER
}

enum MemberStatus {
  ACTIVE
  INVITED
  OFFLINE
}

enum ProjectStatus {
  PLANNING
  ACTIVE
  ON_HOLD
  COMPLETED
}

enum TaskStatus {
  BACKLOG
  TODO
  IN_PROGRESS
  REVIEW
  DONE
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum AiSummaryType {
  TASK_SUMMARY
  PROJECT_SUMMARY
  WEEKLY_SUMMARY
  CHECKLIST
}
```

## REST API Plan

### Auth

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Workspaces

```text
GET    /api/workspaces
GET    /api/workspaces/:workspaceId
POST   /api/workspaces
PATCH  /api/workspaces/:workspaceId
DELETE /api/workspaces/:workspaceId
```

### Workspace Members

```text
GET    /api/workspaces/:workspaceId/members
POST   /api/workspaces/:workspaceId/members
PATCH  /api/workspaces/:workspaceId/members/:memberId
DELETE /api/workspaces/:workspaceId/members/:memberId
```

### Projects

```text
GET    /api/workspaces/:workspaceId/projects
GET    /api/projects/:projectId
POST   /api/workspaces/:workspaceId/projects
PATCH  /api/projects/:projectId
DELETE /api/projects/:projectId
```

### Tasks

```text
GET    /api/projects/:projectId/tasks
GET    /api/tasks/:taskId
POST   /api/projects/:projectId/tasks
PATCH  /api/tasks/:taskId
DELETE /api/tasks/:taskId
```

### Task Comments

```text
GET    /api/tasks/:taskId/comments
POST   /api/tasks/:taskId/comments
PATCH  /api/comments/:commentId
DELETE /api/comments/:commentId
```

### Task Checklist

```text
GET    /api/tasks/:taskId/checklist
POST   /api/tasks/:taskId/checklist
PATCH  /api/checklist/:itemId
DELETE /api/checklist/:itemId
```

### Task Activity

```text
GET /api/tasks/:taskId/activity
```

### AI

```text
POST /api/ai/task-summary
POST /api/ai/project-summary
POST /api/ai/weekly-summary
POST /api/ai/checklist
```

Initial AI endpoints can return mock responses before connecting a real AI provider.

## Permissions Plan

### Owner

Can:

- manage workspace
- manage billing
- invite and remove users
- manage all projects and tasks

### Admin

Can:

- invite members
- manage projects
- manage tasks
- manage comments

### Member

Can:

- view workspace
- view projects
- create and update tasks
- add comments
- update own profile

## Implementation Stages

### Stage 1 — Server foundation

- create `server/` folder
- add Express + TypeScript
- add health check endpoint
- add error middleware
- add env config
- add CORS
- add logging
- add basic folder structure

### Stage 2 — Database

- add Prisma
- connect PostgreSQL
- create Prisma schema
- create first migration
- add seed data

### Stage 3 — Auth

- add password hashing with bcrypt
- add JWT access token
- add register route
- add login route
- add auth middleware
- add `GET /api/auth/me`

### Stage 4 — Core API

- add workspace routes
- add project routes
- add task routes
- add comments routes
- add checklist routes
- add activity route

### Stage 5 — Frontend integration

- add API client
- replace mock data with TanStack Query
- add loading states
- add error states
- add mutations
- add optimistic updates

### Stage 6 — AI

- add mock AI endpoints
- connect frontend AI Assistant to backend
- later connect real AI provider

## Notes

The frontend should not be rewritten during backend development.

The backend should be added incrementally. Each stage should pass build checks before moving to the next stage.

The first backend milestone is a working Express server with:

```text
GET /api/health
```

returning:

```json
{
  "status": "ok"
}
```
