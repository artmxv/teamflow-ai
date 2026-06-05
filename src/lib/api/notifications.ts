import { apiRequest } from "./client";

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
