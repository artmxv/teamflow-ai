import type { Server as HttpServer } from "node:http";

import { Server, type Socket } from "socket.io";

import { buildAttachmentPreviewText } from "../lib/chat-attachment-utils.js";
import { env } from "../config/env.js";
import { AuthError } from "../services/auth.service.js";
import { prisma } from "../lib/prisma.js";
import {
  CHAT_CONVERSATION_UPDATED,
  CHAT_MESSAGE_CREATED,
  CHAT_MESSAGE_DELETED,
  type ChatConversationUpdatedPayload,
  type ChatMessageCreatedPayload,
  type ChatMessageDeletedPayload,
} from "./chat-events.js";
import { userRoom, workspaceRoom } from "./rooms.js";
import {
  authenticateSocketToken,
  parseSocketCredentials,
  resolveSocketWorkspaceMembership,
} from "./socket-auth.js";

export type AuthenticatedSocketData = {
  userId: string;
  workspaceId: string;
};

type AuthenticatedSocket = Socket & {
  data: AuthenticatedSocketData;
};

let io: Server | null = null;

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/$/, "");
}

const allowedOrigins = new Set(env.CORS_ORIGINS.map(normalizeOrigin));

/**
 * Single-instance Socket.IO gateway.
 * Horizontal scaling later needs a shared adapter (e.g. Redis).
 */
export function initChatRealtime(httpServer: HttpServer): Server {
  if (io) {
    return io;
  }

  io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }
        const normalized = normalizeOrigin(origin);
        if (allowedOrigins.has(normalized)) {
          callback(null, normalized);
          return;
        }
        callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
    // Same origin allowlist as Express CORS (local + production frontends).
    allowEIO3: false,
  });

  io.use(async (socket, next) => {
    try {
      const credentials = parseSocketCredentials({
        auth: socket.handshake.auth as Record<string, unknown>,
        headers: socket.handshake.headers,
      });

      const userId = authenticateSocketToken(credentials.token);
      const membership = await resolveSocketWorkspaceMembership(
        userId,
        credentials.workspaceId,
      );

      if (membership === "missing_workspace") {
        next(new Error("workspace_required"));
        return;
      }

      if (membership === "forbidden") {
        next(new Error("forbidden"));
        return;
      }

      socket.data.userId = membership.userId;
      socket.data.workspaceId = membership.workspaceId;
      next();
    } catch (error) {
      if (error instanceof AuthError) {
        next(new Error("unauthorized"));
        return;
      }
      next(error instanceof Error ? error : new Error("unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const { userId, workspaceId } = authSocket.data;

    void authSocket.join(userRoom(userId));
    void authSocket.join(workspaceRoom(workspaceId));
  });

  return io;
}

export function getChatRealtimeServer(): Server | null {
  return io;
}

async function listConversationMemberUserIds(conversationId: string): Promise<string[]> {
  const members = await prisma.chatConversationMember.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  return members.map((member) => member.userId);
}

function emitToUsers(userIds: string[], event: string, payload: unknown) {
  if (!io) {
    return;
  }
  for (const userId of userIds) {
    io.to(userRoom(userId)).emit(event, payload);
  }
}

/** Emit only to validated conversation members' user rooms (never workspace-wide for DM content). */
export async function emitChatMessageCreated(payload: ChatMessageCreatedPayload) {
  const memberIds = await listConversationMemberUserIds(payload.conversationId);
  emitToUsers(memberIds, CHAT_MESSAGE_CREATED, payload);

  const conversationPayload: ChatConversationUpdatedPayload = {
    conversationId: payload.conversationId,
    workspaceId: payload.workspaceId,
    latestMessage: {
      id: payload.message.id,
      content: buildAttachmentPreviewText(
        payload.message.content,
        payload.message.attachments.map((attachment) => ({ type: attachment.type })),
      ),
      createdAt: payload.message.createdAt,
      senderId: payload.message.sender.id,
    },
    latestMessageAt: payload.message.createdAt,
  };
  emitToUsers(memberIds, CHAT_CONVERSATION_UPDATED, conversationPayload);
}

export async function emitChatMessageDeleted(payload: ChatMessageDeletedPayload) {
  const memberIds = await listConversationMemberUserIds(payload.conversationId);
  emitToUsers(memberIds, CHAT_MESSAGE_DELETED, payload);
}

export async function closeChatRealtime(): Promise<void> {
  if (!io) {
    return;
  }

  const server = io;
  io = null;

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}
