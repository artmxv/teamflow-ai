import { prisma } from "../lib/prisma.js";

type CreateTaskInput = {
  projectId: string;
  title: string;
  description?: string;
  status?: "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assigneeId?: string | null;
  dueDate?: string | null;
};

export async function getTasks() {
  const tasks = await prisma.task.findMany({
    orderBy: { updatedAt: "desc" },
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
    },
  });

  return tasks.map((task) => {
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

export async function createTask(input: CreateTaskInput) {
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
