import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { resolveRequestWorkspaceContext } from "../lib/workspace-request.js";
import {
  CHAT_MESSAGE_MAX_LENGTH,
  validateChatMessageContent,
} from "../lib/chat-message-utils.js";
import {
  createChatMessage,
  deleteChatMessage,
  listChatMessages,
} from "../services/chat.service.js";

const createMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "content is required")
    .max(CHAT_MESSAGE_MAX_LENGTH, `content must be at most ${CHAT_MESSAGE_MAX_LENGTH} characters`),
});

async function resolveWorkspace(req: Request, res: Response) {
  const context = await resolveRequestWorkspaceContext(req.userId!, req);
  if (!context) {
    res.status(403).json({ message: "Workspace not found" });
    return null;
  }
  return context;
}

export async function getChatMessagesController(req: Request, res: Response, next: NextFunction) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const page = await listChatMessages(context.workspaceId, {
      limit: req.query.limit,
      before: req.query.before,
      after: req.query.after,
    });

    if (page === "invalid_cursor") {
      res.status(400).json({ message: "Invalid chat cursor" });
      return;
    }

    res.json({ data: page });
  } catch (error) {
    next(error);
  }
}

export async function createChatMessageController(req: Request, res: Response, next: NextFunction) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const validation = validateChatMessageContent(req.body?.content);
    if (!validation.ok) {
      const result = createMessageSchema.safeParse(req.body);
      res.status(400).json({
        message:
          validation.reason === "too_long"
            ? `content must be at most ${CHAT_MESSAGE_MAX_LENGTH} characters`
            : "content is required",
        issues: result.success ? undefined : result.error.issues,
      });
      return;
    }

    const message = await createChatMessage(
      context.workspaceId,
      req.userId!,
      validation.content,
    );

    if (message === "invalid_content") {
      res.status(400).json({ message: "Invalid chat message payload" });
      return;
    }

    res.status(201).json({ data: message });
  } catch (error) {
    next(error);
  }
}

export async function deleteChatMessageController(req: Request, res: Response, next: NextFunction) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const messageId = req.params.id;
    if (typeof messageId !== "string") {
      res.status(404).json({ message: "Message not found" });
      return;
    }

    const deleted = await deleteChatMessage(context.workspaceId, messageId, req.userId!);

    if (deleted === "not_found") {
      res.status(404).json({ message: "Message not found" });
      return;
    }

    if (deleted === "forbidden") {
      res.status(403).json({ message: "You can only delete your own messages" });
      return;
    }

    res.json({ data: deleted });
  } catch (error) {
    next(error);
  }
}
