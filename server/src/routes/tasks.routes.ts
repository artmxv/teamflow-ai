import { Router } from "express";

import {
  createTaskCommentController,
  deleteTaskCommentController,
  getTaskCommentsController,
  updateTaskCommentController,
} from "../controllers/task-comments.controller.js";
import {
  deleteTaskAttachmentController,
  downloadTaskAttachmentController,
  getTaskAttachmentsController,
  uploadTaskAttachmentController,
} from "../controllers/task-attachments.controller.js";
import {
  createTaskController,
  deleteTaskController,
  getTasksController,
  updateTaskController,
} from "../controllers/tasks.controller.js";
import { requireAuth } from "../middleware/require-auth.middleware.js";

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

tasksRouter.get("/", getTasksController);
tasksRouter.post("/", createTaskController);
tasksRouter.get("/:id/comments", getTaskCommentsController);
tasksRouter.post("/:id/comments", createTaskCommentController);
tasksRouter.patch("/:id/comments/:commentId", updateTaskCommentController);
tasksRouter.delete("/:id/comments/:commentId", deleteTaskCommentController);
tasksRouter.get("/:id/attachments", getTaskAttachmentsController);
tasksRouter.post("/:id/attachments", uploadTaskAttachmentController);
tasksRouter.get("/:id/attachments/:attachmentId/file", downloadTaskAttachmentController);
tasksRouter.delete("/:id/attachments/:attachmentId", deleteTaskAttachmentController);
tasksRouter.patch("/:id", updateTaskController);
tasksRouter.delete("/:id", deleteTaskController);
