import { prisma } from "../lib/prisma.js";

const NOTIFICATION_LIST_LIMIT = 30;

export type CreateNotificationInput = {
  workspaceId: string;
  recipientId: string;
  actorId?: string | null;
  type: string;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  href?: string | null;
};

function mapNotification(notification: {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
  actorId: string | null;
}) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    entityType: notification.entityType,
    entityId: notification.entityId,
    href: notification.href,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
    actorId: notification.actorId,
    isRead: notification.readAt !== null,
  };
}

export async function createNotification(input: CreateNotificationInput) {
  try {
    await prisma.notification.create({
      data: {
        workspaceId: input.workspaceId,
        recipientId: input.recipientId,
        actorId: input.actorId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        href: input.href ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to create notification", error);
  }
}

export async function createNotificationsForUsers(
  recipientIds: string[],
  input: Omit<CreateNotificationInput, "recipientId">,
) {
  const uniqueRecipientIds = [...new Set(recipientIds)].filter((id) => Boolean(id));

  if (uniqueRecipientIds.length === 0) {
    return;
  }

  try {
    await prisma.notification.createMany({
      data: uniqueRecipientIds.map((recipientId) => ({
        workspaceId: input.workspaceId,
        recipientId,
        actorId: input.actorId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        href: input.href ?? null,
      })),
    });
  } catch (error) {
    console.error("Failed to create notifications", error);
  }
}

export async function getNotifications(workspaceId: string, recipientId: string) {
  const where = {
    workspaceId,
    recipientId,
  };

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: NOTIFICATION_LIST_LIMIT,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        entityType: true,
        entityId: true,
        href: true,
        readAt: true,
        createdAt: true,
        actorId: true,
      },
    }),
    prisma.notification.count({
      where: {
        ...where,
        readAt: null,
      },
    }),
  ]);

  return {
    notifications: notifications.map(mapNotification),
    unreadCount,
  };
}

export async function markNotificationRead(
  workspaceId: string,
  recipientId: string,
  notificationId: string,
) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      workspaceId,
      recipientId,
    },
    select: { id: true },
  });

  if (!notification) {
    return null;
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      entityType: true,
      entityId: true,
      href: true,
      readAt: true,
      createdAt: true,
      actorId: true,
    },
  });

  return mapNotification(updated);
}

export async function markAllNotificationsRead(workspaceId: string, recipientId: string) {
  await prisma.notification.updateMany({
    where: {
      workspaceId,
      recipientId,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return { ok: true as const };
}

async function getUserName(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  return user?.name ?? "Someone";
}

export async function notifyTaskCommentCreated(params: {
  workspaceId: string;
  taskId: string;
  actorId: string;
  commentPreview: string;
}) {
  const task = await prisma.task.findFirst({
    where: { id: params.taskId, project: { workspaceId: params.workspaceId } },
    select: {
      id: true,
      title: true,
      assigneeId: true,
    },
  });

  if (!task) {
    return;
  }

  const actorName = await getUserName(params.actorId);
  const preview =
    params.commentPreview.length > 120
      ? `${params.commentPreview.slice(0, 117)}...`
      : params.commentPreview;

  const base = {
    workspaceId: params.workspaceId,
    actorId: params.actorId,
    type: "TASK_COMMENT",
    entityType: "task",
    entityId: task.id,
    href: `/app/tasks?taskId=${task.id}`,
  };

  if (task.assigneeId && task.assigneeId !== params.actorId) {
    await createNotification({
      ...base,
      recipientId: task.assigneeId,
      title: `New comment on ${task.title}`,
      body: `${actorName}: ${preview}`,
    });
  }

  await createNotification({
    ...base,
    recipientId: params.actorId,
    title: "You added a comment",
    body: `${task.title}: ${preview}`,
  });
}

export async function notifyTaskAssigned(params: {
  workspaceId: string;
  taskId: string;
  taskTitle: string;
  assigneeId: string;
  actorId: string;
}) {
  const actorName = await getUserName(params.actorId);

  const base = {
    workspaceId: params.workspaceId,
    actorId: params.actorId,
    type: "TASK_ASSIGNED",
    entityType: "task",
    entityId: params.taskId,
    href: `/app/tasks?taskId=${params.taskId}`,
  };

  if (params.assigneeId === params.actorId) {
    await createNotification({
      ...base,
      recipientId: params.actorId,
      title: "You were assigned a task",
      body: params.taskTitle,
    });
    return;
  }

  await createNotification({
    ...base,
    recipientId: params.assigneeId,
    title: "Task assigned to you",
    body: `${actorName} assigned you to ${params.taskTitle}`,
  });

  const assigneeName = await getUserName(params.assigneeId);

  await createNotification({
    ...base,
    recipientId: params.actorId,
    title: "Task assignment updated",
    body: `${params.taskTitle} assigned to ${assigneeName}`,
  });
}

export async function notifyTaskAttachmentUploaded(params: {
  workspaceId: string;
  taskId: string;
  actorId: string;
  fileName: string;
}) {
  const task = await prisma.task.findFirst({
    where: { id: params.taskId, project: { workspaceId: params.workspaceId } },
    select: {
      id: true,
      title: true,
      assigneeId: true,
    },
  });

  if (!task) {
    return;
  }

  const actorName = await getUserName(params.actorId);

  const base = {
    workspaceId: params.workspaceId,
    actorId: params.actorId,
    type: "TASK_ATTACHMENT",
    entityType: "task",
    entityId: task.id,
    href: `/app/tasks?taskId=${task.id}`,
  };

  if (task.assigneeId && task.assigneeId !== params.actorId) {
    await createNotification({
      ...base,
      recipientId: task.assigneeId,
      title: `New attachment on ${task.title}`,
      body: `${actorName} uploaded ${params.fileName}`,
    });
  }

  await createNotification({
    ...base,
    recipientId: params.actorId,
    title: "You uploaded an attachment",
    body: `${task.title}: ${params.fileName}`,
  });
}

export async function notifyProjectDocumentUploaded(params: {
  workspaceId: string;
  projectId: string;
  actorId: string;
  fileName: string;
}) {
  const project = await prisma.project.findFirst({
    where: { id: params.projectId, workspaceId: params.workspaceId },
    select: {
      id: true,
      name: true,
      projectMembers: { select: { userId: true } },
    },
  });

  if (!project) {
    return;
  }

  const otherRecipientIds = project.projectMembers
    .map((member) => member.userId)
    .filter((userId) => userId !== params.actorId);

  const actorName = await getUserName(params.actorId);

  const base = {
    workspaceId: params.workspaceId,
    actorId: params.actorId,
    type: "PROJECT_DOCUMENT",
    entityType: "project",
    entityId: project.id,
    href: `/app/projects/${project.id}`,
  };

  if (otherRecipientIds.length > 0) {
    await createNotificationsForUsers(otherRecipientIds, {
      ...base,
      title: `New document in ${project.name}`,
      body: `${actorName} uploaded ${params.fileName}`,
    });
  }

  await createNotification({
    ...base,
    recipientId: params.actorId,
    title: "You uploaded a project document",
    body: `${project.name}: ${params.fileName}`,
  });
}
