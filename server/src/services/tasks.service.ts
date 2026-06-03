import { prisma } from "../lib/prisma.js";
import { notifyTaskAssigned } from "./notifications.service.js";

type CreateTaskInput = {
  projectId: string;
  title: string;
  description?: string;
  status?: "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assigneeId?: string | null;
  dueDate?: string | null;
};

type UpdateTaskInput = {
  title?: string;
  description?: string | null;
  status?: "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assigneeId?: string | null;
  dueDate?: string | null;
};

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
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
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
  assignee: { id: string; name: string; email: string; avatar: string | null } | null;
  comments: { id: string }[];
  checklistItems: { id: string; done: boolean }[];
  attachments: { id: string }[];
}) {
  const commentsCount = task.comments.length;
  const checklistTotal = task.checklistItems.length;
  const checklistDone = task.checklistItems.filter((item) => item.done).length;
  const attachmentsCount = task.attachments.length;

  return {
    id: task.id,
    key: task.key,
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId,
    dueDate: task.dueDate,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    project: task.project,
    assignee: task.assignee,
    commentsCount,
    checklistTotal,
    checklistDone,
    attachmentsCount,
  };
}

export async function getTasks(workspaceId: string) {
  const tasks = await prisma.task.findMany({
    where: {
      project: { workspaceId },
    },
    orderBy: { updatedAt: "desc" },
    select: taskDetailSelect,
  });

  return tasks.map(mapTaskDetail);
}

async function findProjectInWorkspace(projectId: string, workspaceId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true },
  });
}

export async function findTaskInWorkspace(taskId: string, workspaceId: string) {
  return prisma.task.findFirst({
    where: { id: taskId, project: { workspaceId } },
    select: { id: true },
  });
}

async function resolveAssigneeId(assigneeId?: string | null) {
  if (!assigneeId?.trim()) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: assigneeId },
    select: { id: true },
  });

  return user?.id ?? null;
}

export async function createTask(workspaceId: string, input: CreateTaskInput) {
  const project = await findProjectInWorkspace(input.projectId, workspaceId);
  if (!project) {
    return null;
  }

  const taskCount = await prisma.task.count();
  const assigneeId = await resolveAssigneeId(input.assigneeId);

  const task = await prisma.task.create({
    data: {
      key: `TF-${taskCount + 101}`,
      projectId: input.projectId,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "BACKLOG",
      priority: input.priority ?? "MEDIUM",
      assigneeId,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
    },
    select: {
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
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      },
    },
  });

  return {
    ...task,
    commentsCount: 0,
    checklistTotal: 0,
    checklistDone: 0,
    attachmentsCount: 0,
  };
}

export async function updateTask(
  workspaceId: string,
  id: string,
  input: UpdateTaskInput,
  actorId?: string,
) {
  const existing = await prisma.task.findFirst({
    where: { id, project: { workspaceId } },
    select: { id: true, title: true, assigneeId: true },
  });

  if (!existing) {
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
  if (input.assigneeId !== undefined) {
    data.assigneeId = await resolveAssigneeId(input.assigneeId);
  }

  const task = await prisma.task.update({
    where: { id },
    data,
    select: taskDetailSelect,
  });

  if (
    actorId &&
    input.assigneeId !== undefined &&
    task.assigneeId &&
    task.assigneeId !== existing.assigneeId
  ) {
    void notifyTaskAssigned({
      workspaceId,
      taskId: task.id,
      taskTitle: task.title,
      assigneeId: task.assigneeId,
      actorId,
    });
  }

  return mapTaskDetail(task);
}

export async function deleteTask(workspaceId: string, id: string) {
  const existing = await findTaskInWorkspace(id, workspaceId);

  if (!existing) {
    return null;
  }

  await prisma.task.delete({
    where: { id },
  });

  return { id };
}
