import { prisma } from "../lib/prisma.js";
import {
  canDeleteChatMessage,
  clampChatMessageLimit,
  decodeChatCursor,
  encodeChatCursor,
  type ChatCursor,
  validateChatMessageContent,
} from "../lib/chat-message-utils.js";

const senderSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  avatarUrl: true,
} as const;

type SenderRow = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  avatarUrl: string | null;
};

type MessageRow = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  senderId: string;
  sender: SenderRow;
};

export type ChatMessageDto = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  sender: SenderRow;
};

export type ChatMessagesPage = {
  messages: ChatMessageDto[];
  pageInfo: {
    hasMoreOlder: boolean;
    oldestCursor: string | null;
    newestCursor: string | null;
  };
};

function mapMessage(message: MessageRow): ChatMessageDto {
  return {
    id: message.id,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
    sender: message.sender,
  };
}

function buildPageInfo(messages: MessageRow[], hasMoreOlder: boolean) {
  if (messages.length === 0) {
    return {
      hasMoreOlder,
      oldestCursor: null,
      newestCursor: null,
    };
  }

  const oldest = messages[0]!;
  const newest = messages[messages.length - 1]!;

  return {
    hasMoreOlder,
    oldestCursor: encodeChatCursor(oldest.createdAt, oldest.id),
    newestCursor: encodeChatCursor(newest.createdAt, newest.id),
  };
}

function olderThanWhere(cursor: ChatCursor) {
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      {
        AND: [{ createdAt: cursor.createdAt }, { id: { lt: cursor.id } }],
      },
    ],
  };
}

function newerThanWhere(cursor: ChatCursor) {
  return {
    OR: [
      { createdAt: { gt: cursor.createdAt } },
      {
        AND: [{ createdAt: cursor.createdAt }, { id: { gt: cursor.id } }],
      },
    ],
  };
}

export async function listChatMessages(
  workspaceId: string,
  options: {
    limit?: unknown;
    before?: unknown;
    after?: unknown;
  } = {},
): Promise<ChatMessagesPage | "invalid_cursor"> {
  const limit = clampChatMessageLimit(options.limit);
  const beforeRaw = typeof options.before === "string" ? options.before : undefined;
  const afterRaw = typeof options.after === "string" ? options.after : undefined;

  if (beforeRaw && afterRaw) {
    return "invalid_cursor";
  }

  const before = beforeRaw ? decodeChatCursor(beforeRaw) : null;
  const after = afterRaw ? decodeChatCursor(afterRaw) : null;

  if (beforeRaw && !before) {
    return "invalid_cursor";
  }
  if (afterRaw && !after) {
    return "invalid_cursor";
  }

  if (after) {
    const newer = await prisma.workspaceChatMessage.findMany({
      where: {
        workspaceId,
        ...newerThanWhere(after),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit,
      select: {
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        senderId: true,
        sender: { select: senderSelect },
      },
    });

    return {
      messages: newer.map(mapMessage),
      pageInfo: buildPageInfo(newer, false),
    };
  }

  const rows = await prisma.workspaceChatMessage.findMany({
    where: {
      workspaceId,
      ...(before ? olderThanWhere(before) : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      senderId: true,
      sender: { select: senderSelect },
    },
  });

  const hasMoreOlder = rows.length > limit;
  const page = hasMoreOlder ? rows.slice(0, limit) : rows;
  const chronological = [...page].reverse();

  return {
    messages: chronological.map(mapMessage),
    pageInfo: buildPageInfo(chronological, hasMoreOlder),
  };
}

export async function createChatMessage(
  workspaceId: string,
  senderId: string,
  rawContent: unknown,
): Promise<ChatMessageDto | "invalid_content"> {
  const validation = validateChatMessageContent(rawContent);
  if (!validation.ok) {
    return "invalid_content";
  }

  const message = await prisma.workspaceChatMessage.create({
    data: {
      workspaceId,
      senderId,
      content: validation.content,
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      senderId: true,
      sender: { select: senderSelect },
    },
  });

  return mapMessage(message);
}

export async function deleteChatMessage(
  workspaceId: string,
  messageId: string,
  actorId: string,
): Promise<{ id: string } | "not_found" | "forbidden"> {
  const message = await prisma.workspaceChatMessage.findFirst({
    where: { id: messageId, workspaceId },
    select: { id: true, senderId: true },
  });

  if (!message) {
    return "not_found";
  }

  if (!canDeleteChatMessage(message.senderId, actorId)) {
    return "forbidden";
  }

  await prisma.workspaceChatMessage.delete({
    where: { id: messageId },
  });

  return { id: messageId };
}
