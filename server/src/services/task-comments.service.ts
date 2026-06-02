import { prisma } from "../lib/prisma.js";
import { findTaskInWorkspace } from "./tasks.service.js";

const authorSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
} as const;

function mapComment(comment: {
  id: string;
  body: string;
  createdAt: Date;
  author: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
}) {
  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt,
    author: comment.author,
  };
}

export async function getTaskComments(workspaceId: string, taskId: string) {
  const task = await findTaskInWorkspace(taskId, workspaceId);
  if (!task) {
    return null;
  }

  const comments = await prisma.taskComment.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: authorSelect },
    },
  });

  return comments.map(mapComment);
}

export async function createTaskComment(
  workspaceId: string,
  taskId: string,
  authorId: string,
  body: string,
) {
  const task = await findTaskInWorkspace(taskId, workspaceId);
  if (!task) {
    return null;
  }

  const comment = await prisma.taskComment.create({
    data: {
      taskId,
      authorId,
      body,
    },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: authorSelect },
    },
  });

  return mapComment(comment);
}

export async function updateTaskComment(
  workspaceId: string,
  taskId: string,
  commentId: string,
  userId: string,
  body: string,
) {
  const task = await findTaskInWorkspace(taskId, workspaceId);
  if (!task) {
    return null;
  }

  const comment = await prisma.taskComment.findFirst({
    where: { id: commentId, taskId },
    select: { id: true, authorId: true },
  });

  if (!comment) {
    return "not_found" as const;
  }

  if (comment.authorId !== userId) {
    return "forbidden" as const;
  }

  const updated = await prisma.taskComment.update({
    where: { id: commentId },
    data: { body },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: authorSelect },
    },
  });

  return mapComment(updated);
}

export async function deleteTaskComment(
  workspaceId: string,
  taskId: string,
  commentId: string,
  userId: string,
) {
  const task = await findTaskInWorkspace(taskId, workspaceId);
  if (!task) {
    return null;
  }

  const comment = await prisma.taskComment.findFirst({
    where: { id: commentId, taskId },
    select: { id: true, authorId: true },
  });

  if (!comment) {
    return "not_found" as const;
  }

  if (comment.authorId !== userId) {
    return "forbidden" as const;
  }

  await prisma.taskComment.delete({
    where: { id: commentId },
  });

  return { id: commentId };
}
