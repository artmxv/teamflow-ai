import {
  PrismaClient,
  type ProjectStatus,
  type TaskPriority,
  type TaskStatus,
  type WorkspaceRole,
} from "@prisma/client";
import bcrypt from "bcryptjs";

import { ensureActiveMembersInWorkspaceGeneralConversation } from "../src/lib/chat-conversation-ensure.js";

const prisma = new PrismaClient();

const DEMO_WORKSPACE_SLUG = "acme-studio";
const DEMO_PRIMARY_EMAIL = "alex@teamflow.ai";
const DEMO_PRIMARY_PASSWORD = "Password123!";
const BCRYPT_ROUNDS = 10;

type DemoUserSeed = {
  name: string;
  email: string;
  avatar: string;
  role: WorkspaceRole;
};

const DEMO_USERS: DemoUserSeed[] = [
  { name: "Alex Morgan", email: DEMO_PRIMARY_EMAIL, avatar: "AM", role: "OWNER" },
  { name: "Priya Shah", email: "priya@acme.teamflow.ai", avatar: "PS", role: "ADMIN" },
  { name: "Marcus Chen", email: "marcus@acme.teamflow.ai", avatar: "MC", role: "MEMBER" },
  { name: "Sofia Reyes", email: "sofia@acme.teamflow.ai", avatar: "SR", role: "MEMBER" },
  { name: "Jonas Weber", email: "jonas@acme.teamflow.ai", avatar: "JW", role: "MEMBER" },
];

type DemoProjectSeed = {
  name: string;
  description: string;
  status: ProjectStatus;
  color: string;
  dueInDays: number | null;
};

const DEMO_PROJECTS: DemoProjectSeed[] = [
  {
    name: "Orion Web App",
    description: "Customer-facing dashboard rebuild with a new design system and role-based views.",
    status: "ACTIVE",
    color: "from-indigo-500 to-violet-500",
    dueInDays: 45,
  },
  {
    name: "Mobile App v3",
    description:
      "Native iOS and Android release with offline sync, push notifications, and biometric login.",
    status: "ACTIVE",
    color: "from-sky-500 to-cyan-500",
    dueInDays: 60,
  },
  {
    name: "Marketing Site",
    description:
      "Launch-ready marketing pages, blog templates, and conversion-focused landing flows.",
    status: "ACTIVE",
    color: "from-rose-500 to-orange-500",
    dueInDays: 30,
  },
  {
    name: "Data Pipeline",
    description:
      "Event ingestion, analytics schema, and background job migration for reporting workloads.",
    status: "PLANNING",
    color: "from-emerald-500 to-teal-500",
    dueInDays: 90,
  },
];

type DemoTaskSeed = {
  key: string;
  projectIndex: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeEmail?: string;
  dueInDays?: number | null;
  updatedInDays?: number;
};

const DEMO_TASKS: DemoTaskSeed[] = [
  {
    key: "TF-101",
    projectIndex: 0,
    title: "Refactor kanban status update flow",
    description: "Simplify optimistic updates and align board drag-and-drop with API persistence.",
    status: "BACKLOG",
    priority: "LOW",
    dueInDays: 21,
  },
  {
    key: "TF-102",
    projectIndex: 0,
    title: "Finalize onboarding checklist",
    description: "Document first-run steps for workspace owners and invited members.",
    status: "BACKLOG",
    priority: "URGENT",
    assigneeEmail: DEMO_PRIMARY_EMAIL,
    dueInDays: 7,
    updatedInDays: 0,
  },
  {
    key: "TF-103",
    projectIndex: 0,
    title: "Implement billing edge cases",
    description: "Handle proration, failed payments, and plan downgrades without blocking access.",
    status: "IN_PROGRESS",
    priority: "URGENT",
    assigneeEmail: "priya@acme.teamflow.ai",
    dueInDays: 5,
    updatedInDays: 1,
  },
  {
    key: "TF-104",
    projectIndex: 0,
    title: "Audit accessibility issues",
    description: "Run axe checks on dashboard, tasks, and settings flows; file fixes by severity.",
    status: "REVIEW",
    priority: "URGENT",
    assigneeEmail: "marcus@acme.teamflow.ai",
    dueInDays: 3,
    updatedInDays: 0,
  },
  {
    key: "TF-105",
    projectIndex: 1,
    title: "Review mobile offline sync",
    description: "Validate conflict resolution when edits are made without connectivity.",
    status: "BACKLOG",
    priority: "MEDIUM",
    assigneeEmail: "sofia@acme.teamflow.ai",
    dueInDays: 14,
  },
  {
    key: "TF-106",
    projectIndex: 1,
    title: "Fix push notification deep links",
    status: "BACKLOG",
    priority: "URGENT",
    assigneeEmail: "jonas@acme.teamflow.ai",
    dueInDays: 4,
    updatedInDays: 2,
  },
  {
    key: "TF-107",
    projectIndex: 1,
    title: "Polish settings screen animations",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    assigneeEmail: "jonas@acme.teamflow.ai",
    dueInDays: 10,
  },
  {
    key: "TF-108",
    projectIndex: 1,
    title: "Ship biometric login beta",
    status: "DONE",
    priority: "URGENT",
    assigneeEmail: "marcus@acme.teamflow.ai",
    updatedInDays: 5,
  },
  {
    key: "TF-109",
    projectIndex: 2,
    title: "Draft launch email copy",
    description:
      "Outline hero message, feature bullets, and CTA for the public launch announcement.",
    status: "BACKLOG",
    priority: "LOW",
    assigneeEmail: "priya@acme.teamflow.ai",
    dueInDays: 6,
    updatedInDays: 1,
  },
  {
    key: "TF-110",
    projectIndex: 2,
    title: "Update homepage hero messaging",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    assigneeEmail: DEMO_PRIMARY_EMAIL,
    dueInDays: 8,
    updatedInDays: 0,
  },
  {
    key: "TF-111",
    projectIndex: 2,
    title: "Prepare weekly product digest",
    status: "DONE",
    priority: "LOW",
    assigneeEmail: "sofia@acme.teamflow.ai",
    updatedInDays: 4,
  },
  {
    key: "TF-112",
    projectIndex: 2,
    title: "Validate SEO metadata on blog templates",
    status: "REVIEW",
    priority: "MEDIUM",
    dueInDays: 12,
    updatedInDays: 1,
  },
  {
    key: "TF-113",
    projectIndex: 3,
    title: "Define event schema for analytics",
    status: "BACKLOG",
    priority: "MEDIUM",
    assigneeEmail: "jonas@acme.teamflow.ai",
    dueInDays: 20,
  },
  {
    key: "TF-114",
    projectIndex: 3,
    title: "Migrate legacy job queue workers",
    status: "IN_PROGRESS",
    priority: "URGENT",
    assigneeEmail: DEMO_PRIMARY_EMAIL,
    dueInDays: 9,
    updatedInDays: 0,
  },
  {
    key: "TF-115",
    projectIndex: 3,
    title: "Add dashboard empty states",
    description: "Illustrations and copy for zero projects, zero tasks, and empty board columns.",
    status: "DONE",
    priority: "URGENT",
    updatedInDays: 3,
  },
];

function addDays(base: Date, days: number): Date {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return date;
}

function subtractDays(base: Date, days: number): Date {
  return addDays(base, -days);
}

/** Clears app data so reseed is idempotent and removes manual test rows (e.g. "czczc"). */
async function resetDatabase() {
  await prisma.$transaction([
    prisma.aiSummary.deleteMany(),
    prisma.taskComment.deleteMany(),
    prisma.taskChecklistItem.deleteMany(),
    prisma.taskActivity.deleteMany(),
    prisma.taskAttachment.deleteMany(),
    prisma.task.deleteMany(),
    prisma.project.deleteMany(),
    prisma.workspaceMember.deleteMany(),
    prisma.workspace.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

async function seedDemoWorkspace() {
  const now = new Date();
  const demoPrimaryPasswordHash = await bcrypt.hash(DEMO_PRIMARY_PASSWORD, BCRYPT_ROUNDS);

  const usersByEmail = new Map<string, { id: string; name: string }>();

  for (const member of DEMO_USERS) {
    const passwordHash =
      member.email === DEMO_PRIMARY_EMAIL
        ? demoPrimaryPasswordHash
        : await bcrypt.hash(`seed-only-${member.email}`, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name: member.name,
        email: member.email,
        passwordHash,
        avatar: member.avatar,
      },
      select: { id: true, name: true, email: true },
    });
    usersByEmail.set(member.email, user);
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: "Acme Studio",
      slug: DEMO_WORKSPACE_SLUG,
    },
  });

  for (const member of DEMO_USERS) {
    const user = usersByEmail.get(member.email);
    if (!user) continue;

    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: member.role,
        status: "ACTIVE",
      },
    });
  }

  await ensureActiveMembersInWorkspaceGeneralConversation(prisma, workspace.id);

  const projects = await Promise.all(
    DEMO_PROJECTS.map((project) =>
      prisma.project.create({
        data: {
          workspaceId: workspace.id,
          name: project.name,
          description: project.description,
          status: project.status,
          color: project.color,
          dueDate: project.dueInDays === null ? null : addDays(now, project.dueInDays),
        },
      }),
    ),
  );

  const createdTasks: { id: string; key: string }[] = [];

  for (const task of DEMO_TASKS) {
    const project = projects[task.projectIndex];
    if (!project) {
      throw new Error(`Missing project at index ${task.projectIndex}`);
    }

    const assigneeId = task.assigneeEmail
      ? (usersByEmail.get(task.assigneeEmail)?.id ?? null)
      : null;

    const created = await prisma.task.create({
      data: {
        key: task.key,
        projectId: project.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assigneeId,
        dueDate: task.dueInDays == null ? null : addDays(now, task.dueInDays),
        updatedAt: task.updatedInDays == null ? now : subtractDays(now, task.updatedInDays),
        ...(assigneeId
          ? {
              taskAssignees: {
                create: [{ userId: assigneeId }],
              },
            }
          : {}),
      },
      select: { id: true, key: true },
    });

    createdTasks.push(created);
  }

  const taskByKey = (key: string) => {
    const task = createdTasks.find((item) => item.key === key);
    if (!task) throw new Error(`Missing seeded task ${key}`);
    return task;
  };

  const alex = usersByEmail.get(DEMO_PRIMARY_EMAIL)!;
  const priya = usersByEmail.get("priya@acme.teamflow.ai")!;
  const marcus = usersByEmail.get("marcus@acme.teamflow.ai")!;

  await prisma.taskComment.createMany({
    data: [
      {
        taskId: taskByKey("TF-103").id,
        authorId: priya.id,
        body: "YooKassa test payments are wired; still need downgrade grace period handling.",
      },
      {
        taskId: taskByKey("TF-104").id,
        authorId: alex.id,
        body: "Focus on keyboard traps in the task drawer and color contrast on priority badges.",
      },
      {
        taskId: taskByKey("TF-110").id,
        authorId: alex.id,
        body: "Hero headline approved; waiting on final screenshot assets from design.",
      },
    ],
  });

  await prisma.taskChecklistItem.createMany({
    data: [
      { taskId: taskByKey("TF-102").id, label: "Invite flow copy reviewed", done: true },
      { taskId: taskByKey("TF-102").id, label: "Sample project templates linked", done: false },
      { taskId: taskByKey("TF-102").id, label: "Help center article drafted", done: false },
      { taskId: taskByKey("TF-103").id, label: "Proration rules documented", done: true },
      { taskId: taskByKey("TF-103").id, label: "Failed payment retry window", done: false },
      { taskId: taskByKey("TF-115").id, label: "Projects empty state", done: true },
      { taskId: taskByKey("TF-115").id, label: "Board column empty state", done: true },
    ],
  });

  await prisma.taskActivity.createMany({
    data: [
      {
        taskId: taskByKey("TF-103").id,
        userId: priya.id,
        action: "status_changed",
        metadata: { from: "BACKLOG", to: "IN_PROGRESS" },
      },
      {
        taskId: taskByKey("TF-104").id,
        userId: marcus.id,
        action: "status_changed",
        metadata: { from: "IN_PROGRESS", to: "REVIEW" },
      },
      {
        taskId: taskByKey("TF-108").id,
        userId: marcus.id,
        action: "status_changed",
        metadata: { from: "REVIEW", to: "DONE" },
      },
      {
        taskId: taskByKey("TF-114").id,
        userId: alex.id,
        action: "assigned",
        metadata: { assignee: "Alex Morgan" },
      },
    ],
  });

  console.log(`Seeded workspace "${workspace.name}" (${DEMO_WORKSPACE_SLUG})`);
  console.log(`  Users: ${DEMO_USERS.length}`);
  console.log(`  Projects: ${projects.length}`);
  console.log(`  Tasks: ${createdTasks.length}`);
}

async function main() {
  console.log("Resetting database for demo seed...");
  await resetDatabase();
  await seedDemoWorkspace();
  console.log("Demo seed completed.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
