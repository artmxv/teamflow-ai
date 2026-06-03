import { Router } from "express";

import {
  getNotificationsController,
  markAllNotificationsReadController,
  markNotificationReadController,
} from "../controllers/notifications.controller.js";
import { requireAuth } from "../middleware/require-auth.middleware.js";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get("/", getNotificationsController);
notificationsRouter.patch("/read-all", markAllNotificationsReadController);
notificationsRouter.patch("/:id/read", markNotificationReadController);
