import type { NextFunction, Request, Response } from "express";

import { getUserById } from "../services/auth.service.js";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notifications.service.js";

export async function getNotificationsController(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await getUserById(req.userId!);
    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const result = await getNotifications(req.userId!, user.email);
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
    const notificationId = req.params.id;
    if (typeof notificationId !== "string") {
      res.status(404).json({ message: "Notification not found" });
      return;
    }

    const notification = await markNotificationRead(req.userId!, notificationId);

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
    const result = await markAllNotificationsRead(req.userId!);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}
