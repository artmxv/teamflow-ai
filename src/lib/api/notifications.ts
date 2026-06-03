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
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

export async function fetchNotifications() {
  const response = await apiRequest<{ data: NotificationsResponse }>("/api/notifications");
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
  const href = notification.href?.trim();
  if (href) {
    try {
      const url = new URL(href, "http://local");
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

  if (notification.entityType === "task" && notification.entityId) {
    return { to: "/app/tasks", search: { taskId: notification.entityId } };
  }
  if (notification.entityType === "project" && notification.entityId) {
    return { to: `/app/projects/${notification.entityId}` };
  }

  return null;
}
