import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import {
  CHAT_MESSAGE_MAX_LENGTH,
  validateChatMessageContent,
} from "../lib/chat-message-utils.js";
import { resolveRequestWorkspaceContext } from "../lib/workspace-request.js";
import {
  createConversationMessage,
  deleteConversationMessage,
  getOrCreateDirectConversation,
  getTotalUnreadChatCount,
  listChatConversations,
  listConversationMessages,
  markConversationRead,
  setConversationPinned,
} from "../services/chat.service.js";

const createMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "content is required")
    .max(CHAT_MESSAGE_MAX_LENGTH, `content must be at most ${CHAT_MESSAGE_MAX_LENGTH} characters`),
});

const createDirectSchema = z.object({
  userId: z.string().trim().min(1, "userId is required"),
});

const pinSchema = z.object({
  isPinned: z.boolean(),
});

async function resolveWorkspace(req: Request, res: Response) {
  const context = await resolveRequestWorkspaceContext(req.userId!, req);
  if (!context) {
    res.status(403).json({ message: "Workspace not found" });
    return null;
  }
  return context;
}

function getConversationIdParam(req: Request): string | null {
  const conversationId = req.params.conversationId;
  return typeof conversationId === "string" && conversationId.length > 0
    ? conversationId
    : null;
}

export async function getChatConversationsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const conversations = await listChatConversations(context.workspaceId, req.userId!);
    res.json({ data: conversations });
  } catch (error) {
    next(error);
  }
}

export async function getChatUnreadCountController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const unreadCount = await getTotalUnreadChatCount(context.workspaceId, req.userId!);
    res.json({ data: { unreadCount } });
  } catch (error) {
    next(error);
  }
}

export async function createDirectConversationController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const parsed = createDirectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: "userId is required",
        issues: parsed.error.issues,
      });
      return;
    }

    const result = await getOrCreateDirectConversation(
      context.workspaceId,
      req.userId!,
      parsed.data.userId,
    );

    if (result === "self") {
      res.status(400).json({ message: "Cannot create a direct chat with yourself" });
      return;
    }

    if (result === "target_not_member") {
      res.status(404).json({ message: "Workspace member not found" });
      return;
    }

    res.status(201).json({ data: result.conversation });
  } catch (error) {
    next(error);
  }
}

export async function pinConversationController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const conversationId = getConversationIdParam(req);
    if (!conversationId) {
      res.status(404).json({ message: "Conversation not found" });
      return;
    }

    const parsed = pinSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: "isPinned must be a boolean",
        issues: parsed.error.issues,
      });
      return;
    }

    const result = await setConversationPinned({
      workspaceId: context.workspaceId,
      conversationId,
      userId: req.userId!,
      isPinned: parsed.data.isPinned,
    });

    if (result === "not_found") {
      res.status(404).json({ message: "Conversation not found" });
      return;
    }

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function markConversationReadController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const conversationId = getConversationIdParam(req);
    if (!conversationId) {
      res.status(404).json({ message: "Conversation not found" });
      return;
    }

    const result = await markConversationRead({
      workspaceId: context.workspaceId,
      conversationId,
      userId: req.userId!,
    });

    if (result === "not_found") {
      res.status(404).json({ message: "Conversation not found" });
      return;
    }

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function getConversationMessagesController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const conversationId = getConversationIdParam(req);
    if (!conversationId) {
      res.status(404).json({ message: "Conversation not found" });
      return;
    }

    const page = await listConversationMessages(
      context.workspaceId,
      conversationId,
      req.userId!,
      {
        limit: req.query.limit,
        before: req.query.before,
        after: req.query.after,
      },
    );

    if (page === "not_found") {
      res.status(404).json({ message: "Conversation not found" });
      return;
    }

    if (page === "invalid_cursor") {
      res.status(400).json({ message: "Invalid chat cursor" });
      return;
    }

    res.json({ data: page });
  } catch (error) {
    next(error);
  }
}

export async function createConversationMessageController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const conversationId = getConversationIdParam(req);
    if (!conversationId) {
      res.status(404).json({ message: "Conversation not found" });
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

    const message = await createConversationMessage(
      context.workspaceId,
      conversationId,
      req.userId!,
      validation.content,
    );

    if (message === "not_found") {
      res.status(404).json({ message: "Conversation not found" });
      return;
    }

    if (message === "invalid_content") {
      res.status(400).json({ message: "Invalid chat message payload" });
      return;
    }

    res.status(201).json({ data: message });
  } catch (error) {
    next(error);
  }
}

export async function deleteConversationMessageController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const conversationId = getConversationIdParam(req);
    const messageId = req.params.messageId;
    if (!conversationId || typeof messageId !== "string") {
      res.status(404).json({ message: "Message not found" });
      return;
    }

    const deleted = await deleteConversationMessage(
      context.workspaceId,
      conversationId,
      messageId,
      req.userId!,
    );

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
