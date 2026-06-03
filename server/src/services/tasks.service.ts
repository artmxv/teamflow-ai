import { prisma } from "../lib/prisma.js";
import { notifyTaskAssigned } from "./notifications.service.js";
import { canAccessProject, getAccessibleTaskWhere } from "./project-access.service.js";
import type { WorkspaceRole } from "./workspace-context.service.js";

type CreateTaskInput = {
  projectId: string;
  title: string;
  description?: string;
  status?: "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assigneeIds?: string[];
  assigneeId?: string | null;
  dueDate?: string | null;
};

type UpdateTaskInput = {
  title?: string;
  description?: string | null;
  status?: "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assigneeIds?: string[];
  assigneeId?: string | null;
  dueDate?: string | null;
};

const assigneeUserSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
} as const;

const taskDetailSelect = {
  id: true,
  key: true,
  projectId: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  assigneeId: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  project: {
    select: {
      id: true,
      name: true,
      status: true,
    },
  },
  assignee: {
    select: assigneeUserSelect,
  },
  taskAssignees: {
    orderBy: { createdAt: "asc" as const },
    select: {
      user: {
        select: assigneeUserSelect,
      },
    },
  },
  comments: {
    select: {
      id: true,
    },
  },
  checklistItems: {
    select: {
      id: true,
      done: true,
    },
  },
  attachments: {
    select: {
      id: true,
    },
  },
} as const;

type AssigneeUser = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
};

function mapAssigneeUser(user: AssigneeUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
  };
}

function resolveAssigneesFromTask(task: {
  assignee: AssigneeUser | null;
  taskAssignees: { user: AssigneeUser }[];
}) {
  const fromJoin = task.taskAssignees.map((link) => mapAssigneeUser(link.user));
  if (fromJoin.length > 0) {
    return fromJoin;
  }
  if (task.assignee) {
    return [mapAssigneeUser(task.assignee)];
  }
  return [];
}

function mapTaskDetail(task: {
  id: string;
  key: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  project: { id: string; name: string; status: string };
  assignee: AssigneeUser | null;
  taskAssignees: { user: AssigneeUser }[];
  comments: { id: string }[];
  checklistItems: { id: string; done: boolean }[];
  attachments: { id: string }[];
}) {
  const commentsCount = task.comments.length;
  const checklistTotal = task.checklistItems.length;
  const checklistDone = task.checklistItems.filter((item) => item.done).length;
  const attachmentsCount = task.attachments.length;
  const assignees = resolveAssigneesFromTask(task);
  const assigneeIds = assignees.map((assignee) => assignee.id);

  return {
    id: task.id,
    key: task.key,
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assigneeIds,
    assignees,
    assigneeId: assigneeIds[0] ?? null,
    assignee: assignees[0] ?? null,
    dueDate: task.dueDate,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    project: task.project,
    commentsCount,
    checklistTotal,
    checklistDone,
    attachmentsCount,
  };
}

export async function getTasks(workspaceId: string, userId: string, role: WorkspaceRole) {
  const tasks = await prisma.task.findMany({
    where: getAccessibleTaskWhere(userId, workspaceId, role),
    orderBy: { updatedAt: "desc" },
    select: taskDetailSelect,
  });

  return tasks.map(mapTaskDetail);
}

export async function findTaskInWorkspace(taskId: string, workspaceId: string) {
  return prisma.task.findFirst({
    where: { id: taskId, project: { workspaceId } },
    select: { id: true },
  });
}

async function resolveAssigneeIds(
  assigneeIds?: string[],
  assigneeId?: string | null,
  projectId?: string,
  workspaceId?: string,
): Promise<string[] | undefined> {
  if (assigneeIds === undefined && assigneeId === undefined) {
    return undefined;
  }

  const rawIds =
    assigneeIds !== undefined ? assigneeIds : assigneeId?.trim() ? [assigneeId.trim()] : [];

  const uniqueIds = [...new Set(rawIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return [];
  }

  if (!projectId || !workspaceId) {
    const validIds: string[] = [];
    for (const id of uniqueIds) {
      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true },
      });
      if (user) {
        validIds.push(user.id);
      }
    }
    return validIds;
  }

  const workspaceMembers = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      userId: { in: uniqueIds },
      status: "ACTIVE",
    },
    select: { userId: true },
  });
  const workspaceMemberIds = new Set(workspaceMembers.map((member) => member.userId));

  const projectMemberCount = await prisma.projectMember.count({
    where: { projectId, project: { workspaceId } },
  });

  if (projectMemberCount === 0) {
    return uniqueIds.filter((id) => workspaceMemberIds.has(id));
  }

  const projectMembers = await prisma.projectMember.findMany({
    where: {
      projectId,
      userId: { in: uniqueIds },
      project: { workspaceId },
    },
    select: { userId: true },
  });
  const projectMemberIds = new Set(projectMembers.map((member) => member.userId));

  return uniqueIds.filter((id) => workspaceMemberIds.has(id) && projectMemberIds.has(id));
}

function sameAssigneeIds(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((id, index) => id === sortedRight[index]);
}

async function getExistingAssigneeIds(taskId: string) {
  const links = await prisma.taskAssignee.findMany({
    where: { taskId },
    select: { userId: true },
    orderBy: { createdAt: "asc" },
  });

  if (links.length > 0) {
    return links.map((link) => link.userId);
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { assigneeId: true },
  });

  return task?.assigneeId ? [task.assigneeId] : [];
}

export async function createTask(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
  input: CreateTaskInput,
) {
  const hasAccess = await canAccessProject(userId, workspaceId, role, input.projectId);
  if (!hasAccess) {
    return null;
  }

  const taskCount = await prisma.task.count();
  const assigneeIds =
    (await resolveAssigneeIds(input.assigneeIds, input.assigneeId, input.projectId, workspaceId)) ??
    [];

  const task = await prisma.task.create({
    data: {
      key: `TF-${taskCount + 101}`,
      projectId: input.projectId,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "BACKLOG",
      priority: input.priority ?? "MEDIUM",
      assigneeId: assigneeIds[0] ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      taskAssignees: {
        create: assigneeIds.map((assigneeUserId) => ({ userId: assigneeUserId })),
      },
    },
    select: taskDetailSelect,
  });

  return mapTaskDetail(task);
}

export async function updateTask(
  workspaceId: string,
  id: string,
  input: UpdateTaskInput,
  userId: string,
  role: WorkspaceRole,
  actorId?: string,
) {
  const existing = await prisma.task.findFirst({
    where: { id, project: { workspaceId } },
    select: { id: true, title: true, assigneeId: true, projectId: true },
  });

  if (!existing) {
    return null;
  }

  const hasAccess = await canAccessProject(userId, workspaceId, role, existing.projectId);
  if (!hasAccess) {
    return null;
  }

  const data: {
    title?: string;
    description?: string | null;
    status?: UpdateTaskInput["status"];
    priority?: UpdateTaskInput["priority"];
    assigneeId?: string | null;
    dueDate?: Date | null;
  } = {};

  if (input.title !== undefined) {
    data.title = input.title;
  }
  if (input.description !== undefined) {
    data.description = input.description;
  }
  if (input.status !== undefined) {
    data.status = input.status;
  }
  if (input.priority !== undefined) {
    data.priority = input.priority;
  }
  if (input.dueDate !== undefined) {
    data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  }

  const previousAssigneeIds = await getExistingAssigneeIds(id);
  const resolvedAssigneeIds = await resolveAssigneeIds(
    input.assigneeIds,
    input.assigneeId,
    existing.projectId,
    workspaceId,
  );
  const nextAssigneeIds =
    resolvedAssigneeIds !== undefined && !sameAssigneeIds(resolvedAssigneeIds, previousAssigneeIds)
      ? resolvedAssigneeIds
      : undefined;

  if (nextAssigneeIds !== undefined) {
    data.assigneeId = nextAssigneeIds[0] ?? null;
  }

  const task = await prisma.$transaction(async (tx) => {
    if (nextAssigneeIds !== undefined) {
      await tx.taskAssignee.deleteMany({ where: { taskId: id } });
      if (nextAssigneeIds.length > 0) {
        await tx.taskAssignee.createMany({
          data: nextAssigneeIds.map((assigneeUserId) => ({
            taskId: id,
            userId: assigneeUserId,
          })),
        });
      }
    }

    return tx.task.update({
      where: { id },
      data,
      select: taskDetailSelect,
    });
  });

  if (actorId && nextAssigneeIds !== undefined) {
    const newlyAssigned = nextAssigneeIds.filter(
      (assigneeUserId) => !previousAssigneeIds.includes(assigneeUserId),
    );
    for (const assigneeUserId of newlyAssigned) {
      void notifyTaskAssigned({
        workspaceId,
        taskId: task.id,
        taskTitle: task.title,
        projectId: existing.projectId,
        assigneeId: assigneeUserId,
        actorId,
      });
    }
  }

  return mapTaskDetail(task);
}

export async function deleteTask(
  workspaceId: string,
  id: string,
  userId: string,
  role: WorkspaceRole,
) {
  const existing = await prisma.task.findFirst({
    where: { id, project: { workspaceId } },
    select: { id: true, projectId: true },
  });

  if (!existing) {
    return null;
  }

  const hasAccess = await canAccessProject(userId, workspaceId, role, existing.projectId);
  if (!hasAccess) {
    return null;
  }

  await prisma.task.delete({
    where: { id },
  });

  return { id };
}
