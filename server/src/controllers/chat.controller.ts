import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { z } from "zod";

import {
  CHAT_MAX_FILE_ATTACHMENTS,
  parseIdListField,
} from "../lib/chat-attachment-utils.js";
import { runMultipartUploadIfAuthorized } from "../lib/chat-multipart-upload.js";
import {
  CHAT_MESSAGE_MAX_LENGTH,
  validateChatMessageContent,
} from "../lib/chat-message-utils.js";
import { chatAttachmentUpload } from "../lib/chat-upload.js";
import { sendResolvedStoredFile } from "../lib/file-storage/index.js";
import { resolveRequestWorkspaceContext } from "../lib/workspace-request.js";
import {
  addChatMessageReaction,
  createConversationMessage,
  createConversationMessageWithAttachments,
  deleteConversationMessage,
  getChatAttachmentFile,
  getOrCreateDirectConversation,
  getTotalUnreadChatCount,
  listChatConversations,
  listConversationMessages,
  listPinnedChatMessages,
  markConversationRead,
  pinChatMessage,
  removeChatMessageReaction,
  renameChatConversation,
  setConversationPinned,
  SUPABASE_UPLOAD_REQUIRED_MESSAGE,
  unpinChatMessage,
  validateConversationAccess,
} from "../services/chat.service.js";
import { CHAT_CONVERSATION_TITLE_MAX_LENGTH } from "../lib/chat-conversation-utils.js";
import {
  emitChatConversationRenamed,
  emitChatMessageCreated,
  emitChatMessageDeleted,
  emitChatMessagePinUpdated,
  emitChatMessageReactionUpdated,
} from "../realtime/chat-realtime.js";

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

const renameConversationSchema = z.object({
  title: z
    .string({ required_error: "title is required" })
    .max(
      CHAT_CONVERSATION_TITLE_MAX_LENGTH,
      `title must be at most ${CHAT_CONVERSATION_TITLE_MAX_LENGTH} characters`,
    ),
});

const reactionEmojiSchema = z.object({
  emoji: z.string({ required_error: "emoji is required" }),
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

function isMultipartRequest(req: Request): boolean {
  const contentType = req.headers["content-type"];
  return typeof contentType === "string" && contentType.includes("multipart/form-data");
}

function handleChatUploadError(error: unknown, res: Response): boolean {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ message: "File must be 10 MB or smaller" });
      return true;
    }
    if (error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE") {
      res.status(400).json({
        message: `You can attach at most ${CHAT_MAX_FILE_ATTACHMENTS} files`,
      });
      return true;
    }
  }

  if (error instanceof Error) {
    if (
      error.message === "Unsupported file type" ||
      error.message === "Invalid file name"
    ) {
      res.status(400).json({ message: error.message });
      return true;
    }
  }

  return false;
}

function mapCreateMessageError(error: string, res: Response): boolean {
  switch (error) {
    case "not_found":
      res.status(404).json({ message: "Conversation not found" });
      return true;
    case "invalid_content":
      res.status(400).json({ message: "Invalid chat message payload" });
      return true;
    case "empty":
      res.status(400).json({ message: "Message text or attachments are required" });
      return true;
    case "too_long":
      res.status(400).json({
        message: `content must be at most ${CHAT_MESSAGE_MAX_LENGTH} characters`,
      });
      return true;
    case "too_many_files":
      res.status(400).json({
        message: `You can attach at most ${CHAT_MAX_FILE_ATTACHMENTS} files`,
      });
      return true;
    case "invalid_file":
      res.status(400).json({ message: "One or more files are invalid" });
      return true;
    case "duplicate_entity":
      res.status(400).json({ message: "Duplicate task or project attachments are not allowed" });
      return true;
    case "task_not_found":
      res.status(400).json({ message: "One or more tasks were not found in this workspace" });
      return true;
    case "project_not_found":
      res.status(400).json({ message: "One or more projects were not found in this workspace" });
      return true;
    case "storage_unavailable":
      res.status(503).json({ message: SUPABASE_UPLOAD_REQUIRED_MESSAGE });
      return true;
    default:
      return false;
  }
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

export async function renameConversationController(
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

    const parsed = renameConversationSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const tooLong = parsed.error.issues.some(
        (issue) => issue.code === "too_big",
      );
      res.status(400).json({
        message: tooLong
          ? `title must be at most ${CHAT_CONVERSATION_TITLE_MAX_LENGTH} characters`
          : "title is required",
        issues: parsed.error.issues,
      });
      return;
    }

    const result = await renameChatConversation({
      workspaceId: context.workspaceId,
      conversationId,
      userId: req.userId!,
      role: context.role,
      title: parsed.data.title,
    });

    if (result === "not_found") {
      res.status(404).json({ message: "Conversation not found" });
      return;
    }

    if (result === "forbidden") {
      res.status(403).json({
        message: "Only workspace owners and admins can rename the general chat",
      });
      return;
    }

    if (result === "invalid_type") {
      res.status(400).json({ message: "Direct conversations cannot be renamed" });
      return;
    }

    if (result === "empty") {
      res.status(400).json({ message: "title cannot be empty" });
      return;
    }

    if (result === "too_long") {
      res.status(400).json({
        message: `title must be at most ${CHAT_CONVERSATION_TITLE_MAX_LENGTH} characters`,
      });
      return;
    }

    await emitChatConversationRenamed({
      conversationId: result.id,
      workspaceId: context.workspaceId,
      title: result.title,
      displayName: result.displayName,
    });

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

async function respondCreatedMessage(
  res: Response,
  conversationId: string,
  workspaceId: string,
  message: Awaited<ReturnType<typeof createConversationMessageWithAttachments>>,
) {
  if (typeof message === "string") {
    if (!mapCreateMessageError(message, res)) {
      res.status(400).json({ message: "Invalid chat message payload" });
    }
    return;
  }

  void emitChatMessageCreated({
    conversationId,
    workspaceId,
    message,
    createdAt: message.createdAt,
  }).catch((error) => {
    console.error("Failed to emit chat:message-created:", error);
  });

  res.status(201).json({ data: message });
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

    if (isMultipartRequest(req)) {
      const multipartResult = await runMultipartUploadIfAuthorized({
        validateAccess: () =>
          validateConversationAccess({
            workspaceId: context.workspaceId,
            conversationId,
            userId: req.userId!,
          }),
        parseUpload: async () => {
          await new Promise<void>((resolve, reject) => {
            chatAttachmentUpload.array("files", CHAT_MAX_FILE_ATTACHMENTS)(
              req,
              res,
              (error) => {
                if (error) {
                  reject(error);
                  return;
                }
                resolve();
              },
            );
          });

          return Array.isArray(req.files)
            ? (req.files as Express.Multer.File[])
            : [];
        },
      });

      if (multipartResult.status === "not_found") {
        res.status(404).json({ message: "Conversation not found" });
        return;
      }

      const files = multipartResult.result;

      const message = await createConversationMessageWithAttachments(
        context.workspaceId,
        conversationId,
        req.userId!,
        {
          content: req.body?.content,
          taskIds: req.body?.taskIds,
          projectIds: req.body?.projectIds,
          files,
        },
      );

      await respondCreatedMessage(res, conversationId, context.workspaceId, message);
      return;
    }

    const hasAttachmentIds =
      parseIdListField(req.body?.taskIds).length > 0 ||
      parseIdListField(req.body?.projectIds).length > 0;

    if (hasAttachmentIds) {
      const message = await createConversationMessageWithAttachments(
        context.workspaceId,
        conversationId,
        req.userId!,
        {
          content: req.body?.content,
          taskIds: req.body?.taskIds,
          projectIds: req.body?.projectIds,
          files: [],
        },
      );
      await respondCreatedMessage(res, conversationId, context.workspaceId, message);
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

    void emitChatMessageCreated({
      conversationId,
      workspaceId: context.workspaceId,
      message,
      createdAt: message.createdAt,
    }).catch((error) => {
      console.error("Failed to emit chat:message-created:", error);
    });

    res.status(201).json({ data: message });
  } catch (error) {
    if (handleChatUploadError(error, res)) {
      return;
    }
    if (error instanceof Error && error.message.includes("Supabase Storage")) {
      res.status(503).json({ message: SUPABASE_UPLOAD_REQUIRED_MESSAGE });
      return;
    }
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

    void emitChatMessageDeleted({
      conversationId,
      workspaceId: context.workspaceId,
      messageId: deleted.id,
    }).catch((error) => {
      console.error("Failed to emit chat:message-deleted:", error);
    });

    res.json({ data: deleted });
  } catch (error) {
    next(error);
  }
}

export async function addChatMessageReactionController(
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

    const parsed = reactionEmojiSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "emoji is required" });
      return;
    }

    const result = await addChatMessageReaction({
      workspaceId: context.workspaceId,
      conversationId,
      messageId,
      userId: req.userId!,
      rawEmoji: parsed.data.emoji,
    });

    if (result === "invalid_emoji") {
      res.status(400).json({ message: "Unsupported reaction emoji" });
      return;
    }

    if (result === "not_found") {
      res.status(404).json({ message: "Message not found" });
      return;
    }

    void emitChatMessageReactionUpdated({
      workspaceId: context.workspaceId,
      conversationId,
      messageId,
      reactions: result.reactions,
    }).catch((error) => {
      console.error("Failed to emit chat:message-reaction-updated:", error);
    });

    res.json({ data: { reactions: result.reactions } });
  } catch (error) {
    next(error);
  }
}

export async function removeChatMessageReactionController(
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

    const parsed = reactionEmojiSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "emoji is required" });
      return;
    }

    const result = await removeChatMessageReaction({
      workspaceId: context.workspaceId,
      conversationId,
      messageId,
      userId: req.userId!,
      rawEmoji: parsed.data.emoji,
    });

    if (result === "invalid_emoji") {
      res.status(400).json({ message: "Unsupported reaction emoji" });
      return;
    }

    if (result === "not_found") {
      res.status(404).json({ message: "Message not found" });
      return;
    }

    void emitChatMessageReactionUpdated({
      workspaceId: context.workspaceId,
      conversationId,
      messageId,
      reactions: result.reactions,
    }).catch((error) => {
      console.error("Failed to emit chat:message-reaction-updated:", error);
    });

    res.json({ data: { reactions: result.reactions } });
  } catch (error) {
    next(error);
  }
}

export async function pinChatMessageController(
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

    const result = await pinChatMessage({
      workspaceId: context.workspaceId,
      conversationId,
      messageId,
      userId: req.userId!,
    });

    if (result === "pin_limit_reached") {
      res.status(400).json({
        message: "Pinned message limit reached (50 per conversation)",
      });
      return;
    }

    if (result === "not_found") {
      res.status(404).json({ message: "Message not found" });
      return;
    }

    void emitChatMessagePinUpdated({
      workspaceId: context.workspaceId,
      conversationId,
      messageId,
      pin: result.pin,
    }).catch((error) => {
      console.error("Failed to emit chat:message-pin-updated:", error);
    });

    res.json({ data: { pin: result.pin } });
  } catch (error) {
    next(error);
  }
}

export async function unpinChatMessageController(
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

    const result = await unpinChatMessage({
      workspaceId: context.workspaceId,
      conversationId,
      messageId,
      userId: req.userId!,
    });

    if (result === "not_found") {
      res.status(404).json({ message: "Message not found" });
      return;
    }

    void emitChatMessagePinUpdated({
      workspaceId: context.workspaceId,
      conversationId,
      messageId,
      pin: null,
    }).catch((error) => {
      console.error("Failed to emit chat:message-pin-updated:", error);
    });

    res.json({ data: { pin: null } });
  } catch (error) {
    next(error);
  }
}

export async function getPinnedChatMessagesController(
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

    const result = await listPinnedChatMessages({
      workspaceId: context.workspaceId,
      conversationId,
      userId: req.userId!,
    });

    if (result === "not_found") {
      res.status(404).json({ message: "Conversation not found" });
      return;
    }

    res.json({ data: { messages: result.messages } });
  } catch (error) {
    next(error);
  }
}

export async function downloadChatAttachmentController(
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
    const attachmentId = req.params.attachmentId;
    if (!conversationId || typeof attachmentId !== "string") {
      res.status(404).json({ message: "Attachment not found" });
      return;
    }

    const file = await getChatAttachmentFile({
      workspaceId: context.workspaceId,
      conversationId,
      attachmentId,
      userId: req.userId!,
      isAuthenticated: Boolean(req.userId),
      isActiveWorkspaceMember: true,
    });

    if (file === "unauthenticated") {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    if (file === "forbidden") {
      res.status(403).json({ message: "You cannot download this attachment" });
      return;
    }

    if (file === "not_found") {
      res.status(404).json({ message: "Attachment not found" });
      return;
    }

    await sendResolvedStoredFile(res, file, next);
  } catch (error) {
    next(error);
  }
}
