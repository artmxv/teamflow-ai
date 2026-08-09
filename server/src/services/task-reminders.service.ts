import { prisma } from "../lib/prisma.js";
import {
  buildTaskDueSoonTitle,
  buildTaskOverdueTitle,
  buildTaskReminderDedupeBody,
  buildTaskReminderDedupeKey,
  classifyTaskDueDate,
  TASK_REMINDER_DUE_SOON_WINDOW_MS,
  TASK_REMINDER_TYPES,
  type TaskReminderType,
} from "../lib/task-reminder-utils.js";
import { canAccessProject } from "./project-access.service.js";
import { createNotification } from "./notifications.service.js";

type TaskReminderDependencies = {
  createNotification: typeof createNotification;
};

const defaultTaskReminderDependencies: TaskReminderDependencies = {
  createNotification,
};

export type TaskReminderRunResult = {
  dueSoonCreated: number;
  overdueCreated: number;
  skippedDuplicates: number;
};

type TaskCandidate = {
  id: string;
  title: string;
  dueDate: Date;
  projectId: string;
  workspaceId: string;
  assigneeId: string | null;
  taskAssignees: { userId: string }[];
};

const OPEN_TASK_SELECT = {
  id: true,
  title: true,
  dueDate: true,
  projectId: true,
  assigneeId: true,
  taskAssignees: { select: { userId: true } },
  project: { select: { workspaceId: true } },
} as const;

function resolveAssigneeIds(task: TaskCandidate): string[] {
  if (task.taskAssignees.length > 0) {
    return task.taskAssignees.map((link) => link.userId);
  }

  return task.assigneeId ? [task.assigneeId] : [];
}

async function recipientHasProjectAccess(
  userId: string,
  projectId: string,
  workspaceId: string,
): Promise<boolean> {
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId, status: "ACTIVE" },
    select: { role: true },
  });

  if (!membership) {
    return false;
  }

  return canAccessProject(userId, workspaceId, membership.role, projectId);
}

async function reminderAlreadyExists(params: {
  recipientId: string;
  type: TaskReminderType;
  taskId: string;
  dedupeBody: string;
}): Promise<boolean> {
  const existing = await prisma.notification.findFirst({
    where: {
      recipientId: params.recipientId,
      type: params.type,
      entityType: "task",
      entityId: params.taskId,
      body: params.dedupeBody,
    },
    select: { id: true },
  });

  return existing !== null;
}

async function createReminderForAssignee(
  params: {
    workspaceId: string;
    taskId: string;
    recipientId: string;
    type: TaskReminderType;
    dedupeBody: string;
    dedupeKey: string;
    title: string;
  },
  dependencies: TaskReminderDependencies,
): Promise<"created" | "duplicate" | "failed"> {
  const isDuplicate = await reminderAlreadyExists({
    recipientId: params.recipientId,
    type: params.type,
    taskId: params.taskId,
    dedupeBody: params.dedupeBody,
  });

  if (isDuplicate) {
    return "duplicate";
  }

  const creation = await dependencies.createNotification({
    dedupeKey: params.dedupeKey,
    workspaceId: params.workspaceId,
    recipientId: params.recipientId,
    actorId: null,
    type: params.type,
    title: params.title,
    body: params.dedupeBody,
    entityType: "task",
    entityId: params.taskId,
    href: `/app/tasks?taskId=${params.taskId}`,
  });

  if (creation === "created") {
    return "created";
  }
  return creation === "duplicate" ? "duplicate" : "failed";
}

async function processTasks(
  params: {
    tasks: TaskCandidate[];
    type: TaskReminderType;
    buildTitle: (taskTitle: string) => string;
    result: TaskReminderRunResult;
  },
  dependencies: TaskReminderDependencies,
) {
  for (const task of params.tasks) {
    if (!task.dueDate) {
      continue;
    }

    const assigneeIds = resolveAssigneeIds(task);
    if (assigneeIds.length === 0) {
      continue;
    }

    const dedupeBody = buildTaskReminderDedupeBody(task.dueDate);
    const title = params.buildTitle(task.title);

    for (const recipientId of assigneeIds) {
      const hasAccess = await recipientHasProjectAccess(
        recipientId,
        task.projectId,
        task.workspaceId,
      );

      if (!hasAccess) {
        continue;
      }

      const outcome = await createReminderForAssignee(
        {
          workspaceId: task.workspaceId,
          taskId: task.id,
          recipientId,
          type: params.type,
          dedupeBody,
          dedupeKey: buildTaskReminderDedupeKey({
            recipientId,
            type: params.type,
            taskId: task.id,
            dueDate: task.dueDate,
          }),
          title,
        },
        dependencies,
      );

      if (outcome === "created") {
        if (params.type === TASK_REMINDER_TYPES.DUE_SOON) {
          params.result.dueSoonCreated += 1;
        } else {
          params.result.overdueCreated += 1;
        }
      } else if (outcome === "duplicate") {
        params.result.skippedDuplicates += 1;
      }
    }
  }
}

export async function runTaskDeadlineReminders(
  now: Date = new Date(),
  dependencyOverrides: Partial<TaskReminderDependencies> = {},
): Promise<TaskReminderRunResult> {
  const dependencies = { ...defaultTaskReminderDependencies, ...dependencyOverrides };
  const result: TaskReminderRunResult = {
    dueSoonCreated: 0,
    overdueCreated: 0,
    skippedDuplicates: 0,
  };

  // Widen the Prisma window slightly so legacy UTC-midnight deadlines
  // (treated as end-of-day) are still candidates for JS classification.
  const candidateEnd = new Date(now.getTime() + TASK_REMINDER_DUE_SOON_WINDOW_MS);

  const candidateRows = await prisma.task.findMany({
    where: {
      status: { not: "DONE" },
      dueDate: { not: null, lte: candidateEnd },
    },
    select: OPEN_TASK_SELECT,
  });

  const mapTask = (row: (typeof candidateRows)[number]): TaskCandidate => ({
    id: row.id,
    title: row.title,
    dueDate: row.dueDate!,
    projectId: row.projectId,
    workspaceId: row.project.workspaceId,
    assigneeId: row.assigneeId,
    taskAssignees: row.taskAssignees,
  });

  const dueSoonTasks: TaskCandidate[] = [];
  const overdueTasks: TaskCandidate[] = [];

  for (const row of candidateRows) {
    const task = mapTask(row);
    const classification = classifyTaskDueDate(task.dueDate, now);
    if (classification === "due_soon") {
      dueSoonTasks.push(task);
    } else if (classification === "overdue") {
      overdueTasks.push(task);
    }
  }

  await processTasks(
    {
      tasks: dueSoonTasks,
      type: TASK_REMINDER_TYPES.DUE_SOON,
      buildTitle: buildTaskDueSoonTitle,
      result,
    },
    dependencies,
  );

  await processTasks(
    {
      tasks: overdueTasks,
      type: TASK_REMINDER_TYPES.OVERDUE,
      buildTitle: buildTaskOverdueTitle,
      result,
    },
    dependencies,
  );

  return result;
}
