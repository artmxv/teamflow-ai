import type { NextFunction, Request, Response } from "express";

import { resolveRequestWorkspaceContext } from "../lib/workspace-request.js";
import { getUserById } from "../services/auth.service.js";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notifications.service.js";

export async function getNotificationsController(req: Request, res: Response, next: NextFunction) {
  try {
    const [user, context] = await Promise.all([
      getUserById(req.userId!),
      resolveRequestWorkspaceContext(req.userId!, req),
    ]);
    if (!context) {
      res.status(403).json({ message: "Workspace not found" });
      return;
    }
    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const result = await getNotifications(
      req.userId!,
      user.email,
      context.workspaceId,
      context.role,
    );
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
    const context = await resolveRequestWorkspaceContext(req.userId!, req);
    if (!context) {
      res.status(403).json({ message: "Workspace not found" });
      return;
    }

    const notificationId = req.params.id;
    if (typeof notificationId !== "string") {
      res.status(404).json({ message: "Notification not found" });
      return;
    }

    const notification = await markNotificationRead(
      req.userId!,
      notificationId,
      context.workspaceId,
      context.role,
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
    const context = await resolveRequestWorkspaceContext(req.userId!, req);
    if (!context) {
      res.status(403).json({ message: "Workspace not found" });
      return;
    }

    const result = await markAllNotificationsRead(req.userId!, context.workspaceId, context.role);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}
