import { prisma } from "../lib/prisma.js";

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
