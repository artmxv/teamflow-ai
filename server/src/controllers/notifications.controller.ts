import type { NextFunction, Request, Response } from "express";

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notifications.service.js";
import { resolveRequestWorkspaceContext } from "../lib/workspace-request.js";

async function resolveWorkspace(req: Request, res: Response) {
  const context = await resolveRequestWorkspaceContext(req.userId!, req);
  if (!context) {
    res.status(403).json({ message: "Workspace not found" });
    return null;
  }
  return context;
}

export async function getNotificationsController(req: Request, res: Response, next: NextFunction) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const result = await getNotifications(context.workspaceId, req.userId!);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationReadController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const notificationId = req.params.id;
    if (typeof notificationId !== "string") {
      res.status(404).json({ message: "Notification not found" });
      return;
    }

    const notification = await markNotificationRead(
      context.workspaceId,
      req.userId!,
      notificationId,
    );

    if (!notification) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }

    res.json({ data: notification });
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsReadController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const result = await markAllNotificationsRead(context.workspaceId, req.userId!);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}
