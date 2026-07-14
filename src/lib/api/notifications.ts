import type { QueryClient } from "@tanstack/react-query";

import type { Lang, TKey } from "@/lib/i18n";
import { apiRequest } from "./client";

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;
export const NOTIFICATIONS_POLL_MS = 5_000;

export function invalidateNotifications(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
}

export function refetchNotifications(queryClient: QueryClient) {
  void queryClient.refetchQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
}

export function updateNotificationsCache(
  queryClient: QueryClient,
  updater: (data: NotificationsResponse) => NotificationsResponse,
) {
  queryClient.setQueryData<NotificationsResponse>(NOTIFICATIONS_QUERY_KEY, (old) =>
    old ? updater(old) : old,
  );
}

export function applyNotificationReadInCache(queryClient: QueryClient, id: string) {
  updateNotificationsCache(queryClient, (data) => {
    const target = data.notifications.find((notification) => notification.id === id);
    if (!target || target.isRead) {
      return data;
    }

    return {
      notifications: data.notifications.map((notification) =>
        notification.id === id
          ? { ...notification, isRead: true, readAt: new Date().toISOString() }
          : notification,
      ),
      unreadCount: Math.max(0, data.unreadCount - 1),
    };
  });
}

export function applyAllNotificationsReadInCache(queryClient: QueryClient) {
  updateNotificationsCache(queryClient, (data) => {
    const inviteUnreadCount = data.notifications.filter(
      (notification) => isWorkspaceInvitationNotification(notification) && !notification.isRead,
    ).length;

    return {
      notifications: data.notifications.map((notification) =>
        isWorkspaceInvitationNotification(notification)
          ? notification
          : {
              ...notification,
              isRead: true,
              readAt: notification.readAt ?? new Date().toISOString(),
            },
      ),
      unreadCount: inviteUnreadCount,
    };
  });
}

export function countMarkableUnreadNotifications(notifications: NotificationItem[]) {
  return notifications.filter(
    (notification) => !notification.isRead && !isWorkspaceInvitationNotification(notification),
  ).length;
}

export interface NotificationItem {
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
}

export function isWorkspaceInvitationNotification(notification: NotificationItem): boolean {
  return notification.type === "WORKSPACE_INVITATION";
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

export async function fetchNotifications() {
  const response = await apiRequest<{ data: NotificationsResponse }>("/api/notifications", {
    skipWorkspaceHeader: true,
  });
  return response.data;
}

export async function markNotificationRead(id: string) {
  const response = await apiRequest<{ data: NotificationItem }>(`/api/notifications/${id}/read`, {
    method: "PATCH",
  });
  return response.data;
}

export async function markAllNotificationsRead() {
  const response = await apiRequest<{ data: { ok: true } }>("/api/notifications/read-all", {
    method: "PATCH",
  });
  return response.data;
}

/** Resolves navigation target, including legacy rows stored with generic /app/tasks href. */
export function resolveNotificationTarget(notification: NotificationItem): {
  to: string;
  search?: { taskId: string };
} | null {
  if (notification.type === "WORKSPACE_INVITATION") {
    if (notification.invitationToken) {
      return { to: `/invite/${notification.invitationToken}` };
    }
    const href = notification.href?.trim();
    if (href?.startsWith("/invite/")) {
      return { to: href };
    }
  }

  const href = notification.href?.trim();
  if (href) {
    try {
      const url = new URL(href, "http://local");
      if (url.pathname.startsWith("/invite/")) {
        return { to: `${url.pathname}${url.search}${url.hash}` };
      }
      const taskIdFromHref = url.searchParams.get("taskId");
      if (url.pathname === "/app/tasks") {
        const taskId =
          taskIdFromHref ?? (notification.entityType === "task" ? notification.entityId : null);
        if (taskId) {
          return { to: "/app/tasks", search: { taskId } };
        }
        return { to: "/app/tasks" };
      }
      return { to: `${url.pathname}${url.search}${url.hash}` };
    } catch {
      return { to: href };
    }
  }

  const taskId = notification.taskId ?? notification.entityId;
  if (notification.entityType === "task" && taskId) {
    return { to: "/app/tasks", search: { taskId } };
  }

  const projectId = notification.projectId ?? notification.entityId;
  if (notification.entityType === "project" && projectId) {
    return { to: `/app/projects/${projectId}` };
  }

  if (notification.workspaceId) {
    return { to: "/app/dashboard" };
  }

  return null;
}

type NotificationContext = {
  actor?: string;
  task?: string;
  project?: string;
  file?: string;
  preview?: string;
};

function extractNotificationContext(notification: NotificationItem): NotificationContext {
  const { type, title, body } = notification;

  switch (type) {
    case "TASK_ASSIGNED": {
      const match = body?.match(/^(.+) assigned you to (.+)$/);
      if (match) {
        return { actor: match[1], task: match[2] };
      }
      return {};
    }
    case "TASK_COMMENT": {
      const taskMatch = title.match(/^New comment on (.+)$/);
      const bodyMatch = body?.match(/^([^:]+):\s*(.+)$/s);
      return {
        task: taskMatch?.[1],
        actor: bodyMatch?.[1]?.trim(),
        preview: bodyMatch?.[2],
      };
    }
    case "TASK_ATTACHMENT": {
      const taskMatch = title.match(/^New attachment on (.+)$/);
      const bodyMatch = body?.match(/^(.+) uploaded (.+)$/);
      return {
        task: taskMatch?.[1],
        actor: bodyMatch?.[1],
        file: bodyMatch?.[2],
      };
    }
    case "PROJECT_MEMBER_ADDED": {
      const bodyMatch = body?.match(/^(.+) added you to (.+)$/);
      return {
        actor: bodyMatch?.[1],
        project: bodyMatch?.[2],
      };
    }
    case "PROJECT_DOCUMENT": {
      const projectMatch = title.match(/^New document in (.+)$/);
      const bodyMatch = body?.match(/^(.+) uploaded (.+)$/);
      return {
        project: projectMatch?.[1],
        actor: bodyMatch?.[1],
        file: bodyMatch?.[2],
      };
    }
    default:
      return {};
  }
}

export function getLocalizedNotificationTitle(
  notification: NotificationItem,
  t: (key: TKey) => string,
): string {
  if (isWorkspaceInvitationNotification(notification)) {
    return t("invite.bellTitle");
  }

  const ctx = extractNotificationContext(notification);

  switch (notification.type) {
    case "TASK_ASSIGNED":
      if (ctx.task) {
        return t("notifications.taskAssigned").replace("{task}", ctx.task);
      }
      break;
    case "TASK_COMMENT":
      if (ctx.task) {
        return t("notifications.taskComment").replace("{task}", ctx.task);
      }
      break;
    case "TASK_ATTACHMENT":
      if (ctx.task) {
        return t("notifications.taskAttachment").replace("{task}", ctx.task);
      }
      break;
    case "PROJECT_MEMBER_ADDED":
      if (ctx.project) {
        return t("notifications.projectMemberAdded").replace("{project}", ctx.project);
      }
      break;
    case "PROJECT_DOCUMENT":
      if (ctx.project) {
        return t("notifications.projectDocument").replace("{project}", ctx.project);
      }
      break;
  }

  return notification.title;
}

export function getLocalizedNotificationBody(
  notification: NotificationItem,
  t: (key: TKey) => string,
  workspaceRoleLabel: (role: string) => string,
): string | null {
  if (isWorkspaceInvitationNotification(notification)) {
    const role = notification.invitationRole
      ? workspaceRoleLabel(notification.invitationRole)
      : "";
    const workspace = notification.workspaceName ?? notification.body ?? "";
    return t("invite.bellBody").replace("{workspace}", workspace).replace("{role}", role);
  }

  const ctx = extractNotificationContext(notification);

  switch (notification.type) {
    case "TASK_ASSIGNED":
      if (ctx.actor) {
        return t("notifications.taskAssignedBody").replace("{actor}", ctx.actor);
      }
      break;
    case "TASK_COMMENT":
      if (ctx.actor && ctx.preview) {
        return t("notifications.taskCommentBody")
          .replace("{actor}", ctx.actor)
          .replace("{preview}", ctx.preview);
      }
      break;
    case "TASK_ATTACHMENT":
      if (ctx.actor && ctx.file) {
        return t("notifications.taskAttachmentBody")
          .replace("{actor}", ctx.actor)
          .replace("{file}", ctx.file);
      }
      break;
    case "PROJECT_MEMBER_ADDED":
      if (ctx.actor) {
        return t("notifications.projectMemberAddedBody").replace("{actor}", ctx.actor);
      }
      break;
    case "PROJECT_DOCUMENT":
      if (ctx.actor && ctx.file) {
        return t("notifications.projectDocumentBody")
          .replace("{actor}", ctx.actor)
          .replace("{file}", ctx.file);
      }
      break;
  }

  return notification.body;
}

export function formatNotificationTime(
  createdAt: string,
  t: (key: TKey) => string,
  lang: Lang,
) {
  const date = new Date(createdAt);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) {
    return t("time.justNow");
  }
  if (diffMinutes < 60) {
    return t("time.minutesAgo").replace("{count}", String(diffMinutes));
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return t("time.hoursAgo").replace("{count}", String(diffHours));
  }

  return date.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", {
    month: "short",
    day: "numeric",
  });
}
