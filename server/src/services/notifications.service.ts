import type { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import {
  canAccessProject,
  getAccessibleProjectWhere,
  getAccessibleTaskWhere,
} from "./project-access.service.js";
import { listPendingInvitationsForUser } from "./workspace-invitations.service.js";
import type { WorkspaceRole } from "./workspace-context.service.js";

const NOTIFICATION_LIST_LIMIT = 30;

export type CreateNotificationInput = {
  dedupeKey?: string | null;
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

export type CreateNotificationResult = "created" | "duplicate" | "skipped_self" | "failed";

export type NotificationDto = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
  actorId: string | null;
  isRead: boolean;
  workspaceId?: string;
  projectId?: string | null;
  taskId?: string | null;
  workspaceName?: string;
  invitationRole?: string;
  invitationToken?: string;
};

const INVITE_NOTIFICATION_PREFIX = "invite:";

function mapNotification(notification: {
  id: string;
  workspaceId: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
  actorId: string | null;
  workspace?: { name: string } | null;
}): NotificationDto {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    entityType: notification.entityType,
    entityId: notification.entityId,
    href: notification.href,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
    actorId: notification.actorId,
    isRead: notification.readAt !== null,
    workspaceId: notification.workspaceId,
    projectId: notification.entityType === "project" ? notification.entityId : null,
    taskId: notification.entityType === "task" ? notification.entityId : null,
    workspaceName: notification.workspace?.name,
  };
}

function mapPendingInvitationNotification(invite: {
  id: string;
  token: string;
  role: string;
  createdAt: Date;
  workspaceId: string;
  workspaceName: string;
}): NotificationDto {
  return {
    id: `${INVITE_NOTIFICATION_PREFIX}${invite.id}`,
    type: "WORKSPACE_INVITATION",
    title: "You were invited to a workspace",
    body: `${invite.workspaceName} · ${invite.role}`,
    entityType: "workspace_invitation",
    entityId: invite.id,
    href: `/invite/${invite.token}`,
    readAt: null,
    createdAt: invite.createdAt.toISOString(),
    actorId: null,
    isRead: false,
    workspaceId: invite.workspaceId,
    workspaceName: invite.workspaceName,
    invitationRole: invite.role,
    invitationToken: invite.token,
  };
}

export function isVirtualInviteNotificationId(notificationId: string): boolean {
  return notificationId.startsWith(INVITE_NOTIFICATION_PREFIX);
}

function shouldSkipSelfNotification(recipientId: string, actorId?: string | null) {
  return Boolean(actorId && recipientId === actorId);
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002",
  );
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<CreateNotificationResult> {
  if (shouldSkipSelfNotification(input.recipientId, input.actorId)) {
    return "skipped_self";
  }

  try {
    await prisma.notification.create({
      data: {
        dedupeKey: input.dedupeKey ?? null,
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
    return "created";
  } catch (error) {
    if (input.dedupeKey && isUniqueConstraintError(error)) {
      return "duplicate";
    }
    console.error("Failed to create notification", {
      code:
        error && typeof error === "object" && "code" in error
          ? (error as { code?: unknown }).code
          : "unknown",
    });
    return "failed";
  }
}

export async function createNotificationsForUsers(
  recipientIds: string[],
  input: Omit<CreateNotificationInput, "recipientId">,
) {
  const uniqueRecipientIds = [...new Set(recipientIds)]
    .filter((id) => Boolean(id))
    .filter((id) => !shouldSkipSelfNotification(id, input.actorId));

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

async function buildNotificationAccessWhere(params: {
  recipientId: string;
  workspaceId: string;
  role: WorkspaceRole;
}): Promise<Prisma.NotificationWhereInput> {
  const entityReferences = await prisma.notification.findMany({
    where: {
      recipientId: params.recipientId,
      workspaceId: params.workspaceId,
      entityType: { in: ["task", "project"] },
      entityId: { not: null },
    },
    distinct: ["entityType", "entityId"],
    select: { entityType: true, entityId: true },
  });

  const referencedTaskIds = entityReferences
    .filter((item) => item.entityType === "task")
    .map((item) => item.entityId)
    .filter((id): id is string => Boolean(id));
  const referencedProjectIds = entityReferences
    .filter((item) => item.entityType === "project")
    .map((item) => item.entityId)
    .filter((id): id is string => Boolean(id));

  const [accessibleTasks, accessibleProjects] = await Promise.all([
    referencedTaskIds.length > 0
      ? prisma.task.findMany({
          where: {
            AND: [
              getAccessibleTaskWhere(params.recipientId, params.workspaceId, params.role),
              { id: { in: referencedTaskIds } },
            ],
          },
          select: { id: true },
        })
      : Promise.resolve([]),
    referencedProjectIds.length > 0
      ? prisma.project.findMany({
          where: {
            AND: [
              getAccessibleProjectWhere(params.recipientId, params.workspaceId, params.role),
              { id: { in: referencedProjectIds } },
            ],
          },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    recipientId: params.recipientId,
    workspaceId: params.workspaceId,
    OR: [
      { entityType: null },
      { entityType: { notIn: ["task", "project"] } },
      { entityType: "task", entityId: { in: accessibleTasks.map((task) => task.id) } },
      {
        entityType: "project",
        entityId: { in: accessibleProjects.map((project) => project.id) },
      },
    ],
  };
}

export async function getNotifications(
  recipientId: string,
  userEmail: string,
  workspaceId: string,
  role: WorkspaceRole,
) {
  const accessWhere = await buildNotificationAccessWhere({ recipientId, workspaceId, role });

  const [workspaceNotifications, workspaceUnreadCount, pendingInvites] = await Promise.all([
    prisma.notification.findMany({
      where: accessWhere,
      orderBy: { createdAt: "desc" },
      take: NOTIFICATION_LIST_LIMIT,
      select: {
        id: true,
        workspaceId: true,
        type: true,
        title: true,
        body: true,
        entityType: true,
        entityId: true,
        href: true,
        readAt: true,
        createdAt: true,
        actorId: true,
        workspace: { select: { name: true } },
      },
    }),
    prisma.notification.count({
      where: { AND: [accessWhere, { readAt: null }] },
    }),
    listPendingInvitationsForUser(recipientId, userEmail),
  ]);

  const inviteNotifications = pendingInvites.map(mapPendingInvitationNotification);
  const notifications = [...inviteNotifications, ...workspaceNotifications.map(mapNotification)]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, NOTIFICATION_LIST_LIMIT);

  return {
    notifications,
    unreadCount: workspaceUnreadCount + inviteNotifications.length,
  };
}

export async function markNotificationRead(
  recipientId: string,
  notificationId: string,
  workspaceId: string,
  role: WorkspaceRole,
) {
  if (isVirtualInviteNotificationId(notificationId)) {
    return null;
  }

  const accessWhere = await buildNotificationAccessWhere({ recipientId, workspaceId, role });
  const notification = await prisma.notification.findFirst({
    where: {
      AND: [accessWhere, { id: notificationId }],
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
      workspaceId: true,
      type: true,
      title: true,
      body: true,
      entityType: true,
      entityId: true,
      href: true,
      readAt: true,
      createdAt: true,
      actorId: true,
      workspace: { select: { name: true } },
    },
  });

  return mapNotification(updated);
}

export async function markAllNotificationsRead(
  recipientId: string,
  workspaceId: string,
  role: WorkspaceRole,
) {
  const accessWhere = await buildNotificationAccessWhere({ recipientId, workspaceId, role });
  await prisma.notification.updateMany({
    where: { AND: [accessWhere, { readAt: null }] },
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

async function resolveTaskAssigneeIds(taskId: string): Promise<string[]> {
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

async function userCanAccessProject(
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

async function filterRecipientsWithProjectAccess(params: {
  recipientIds: string[];
  projectId: string;
  workspaceId: string;
  actorId?: string | null;
}): Promise<string[]> {
  const uniqueIds = [...new Set(params.recipientIds)].filter(Boolean);
  const recipients: string[] = [];

  for (const recipientId of uniqueIds) {
    if (params.actorId && recipientId === params.actorId) {
      continue;
    }

    const hasAccess = await userCanAccessProject(recipientId, params.projectId, params.workspaceId);
    if (hasAccess) {
      recipients.push(recipientId);
    }
  }

  return recipients;
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
      projectId: true,
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

  const assigneeIds = await resolveTaskAssigneeIds(task.id);
  const recipientIds = await filterRecipientsWithProjectAccess({
    recipientIds: assigneeIds,
    projectId: task.projectId,
    workspaceId: params.workspaceId,
    actorId: params.actorId,
  });

  if (recipientIds.length > 0) {
    await createNotificationsForUsers(recipientIds, {
      ...base,
      title: `New comment on ${task.title}`,
      body: `${actorName}: ${preview}`,
    });
  }
}

export async function notifyTaskAssigned(params: {
  workspaceId: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  assigneeId: string;
  actorId: string;
}) {
  if (params.assigneeId === params.actorId) {
    return;
  }

  const recipientIds = await filterRecipientsWithProjectAccess({
    recipientIds: [params.assigneeId],
    projectId: params.projectId,
    workspaceId: params.workspaceId,
    actorId: params.actorId,
  });

  if (recipientIds.length === 0) {
    return;
  }

  const actorName = await getUserName(params.actorId);

  await createNotification({
    workspaceId: params.workspaceId,
    actorId: params.actorId,
    type: "TASK_ASSIGNED",
    entityType: "task",
    entityId: params.taskId,
    href: `/app/tasks?taskId=${params.taskId}`,
    recipientId: params.assigneeId,
    title: "Task assigned to you",
    body: `${actorName} assigned you to ${params.taskTitle}`,
  });
}

export async function notifyTaskMovedToReview(params: {
  workspaceId: string;
  taskId: string;
  actorId: string;
}) {
  const task = await prisma.task.findFirst({
    where: { id: params.taskId, project: { workspaceId: params.workspaceId } },
    select: {
      id: true,
      title: true,
      projectId: true,
      assigneeId: true,
      taskAssignees: { select: { userId: true } },
      project: { select: { projectMembers: { select: { userId: true } } } },
    },
  });

  if (!task) {
    return;
  }

  const assigneeIds =
    task.taskAssignees.length > 0
      ? task.taskAssignees.map((link) => link.userId)
      : task.assigneeId
        ? [task.assigneeId]
        : [];
  const recipientIds = await filterRecipientsWithProjectAccess({
    recipientIds: [...assigneeIds, ...task.project.projectMembers.map((member) => member.userId)],
    projectId: task.projectId,
    workspaceId: params.workspaceId,
    actorId: params.actorId,
  });

  if (recipientIds.length === 0) {
    return;
  }

  const actorName = await getUserName(params.actorId);
  await createNotificationsForUsers(recipientIds, {
    workspaceId: params.workspaceId,
    actorId: params.actorId,
    type: "TASK_REVIEW",
    entityType: "task",
    entityId: task.id,
    href: `/app/tasks?taskId=${task.id}`,
    title: `Task "${task.title}" moved to review`,
    body: `${actorName} moved this task to review`,
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
      projectId: true,
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

  const assigneeIds = await resolveTaskAssigneeIds(task.id);
  const recipientIds = await filterRecipientsWithProjectAccess({
    recipientIds: assigneeIds,
    projectId: task.projectId,
    workspaceId: params.workspaceId,
    actorId: params.actorId,
  });

  if (recipientIds.length > 0) {
    await createNotificationsForUsers(recipientIds, {
      ...base,
      title: `New attachment on ${task.title}`,
      body: `${actorName} uploaded ${params.fileName}`,
    });
  }
}

export async function notifyProjectMemberAdded(params: {
  workspaceId: string;
  projectId: string;
  projectName: string;
  memberUserId: string;
  actorId: string;
}) {
  if (params.memberUserId === params.actorId) {
    return;
  }

  const actorName = await getUserName(params.actorId);

  await createNotification({
    workspaceId: params.workspaceId,
    actorId: params.actorId,
    type: "PROJECT_MEMBER_ADDED",
    entityType: "project",
    entityId: params.projectId,
    href: `/app/projects/${params.projectId}`,
    recipientId: params.memberUserId,
    title: "Added to project",
    body: `${actorName} added you to ${params.projectName}`,
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
}
