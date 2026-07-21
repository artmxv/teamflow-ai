import { Prisma } from "@prisma/client";

import { ensureActiveMembersInWorkspaceGeneralConversation } from "../lib/chat-conversation-ensure.js";
import {
  assertDistinctDirectParticipants,
  buildDirectIdentityKey,
  compareConversationsForSidebar,
} from "../lib/chat-conversation-utils.js";
import {
  canDeleteChatMessage,
  clampChatMessageLimit,
  decodeChatCursor,
  encodeChatCursor,
  type ChatCursor,
  validateChatMessageContent,
} from "../lib/chat-message-utils.js";
import { prisma } from "../lib/prisma.js";

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

export type ChatConversationListItem = {
  id: string;
  type: "WORKSPACE" | "DIRECT";
  title: string | null;
  displayName: string;
  avatar: string | null;
  avatarUrl: string | null;
  otherParticipant: SenderRow | null;
  latestMessage: {
    id: string;
    content: string;
    createdAt: string;
    senderId: string;
  } | null;
  latestMessageAt: string | null;
  unreadCount: number;
  isPinned: boolean;
  updatedAt: string;
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

async function findAccessibleConversation(input: {
  workspaceId: string;
  conversationId: string;
  userId: string;
}) {
  return prisma.chatConversation.findFirst({
    where: {
      id: input.conversationId,
      workspaceId: input.workspaceId,
      members: {
        some: {
          userId: input.userId,
        },
      },
    },
    select: {
      id: true,
      type: true,
      workspaceId: true,
      title: true,
      identityKey: true,
      updatedAt: true,
    },
  });
}

export async function listChatConversations(
  workspaceId: string,
  userId: string,
): Promise<ChatConversationListItem[]> {
  await ensureActiveMembersInWorkspaceGeneralConversation(prisma, workspaceId);

  const memberships = await prisma.chatConversationMember.findMany({
    where: {
      userId,
      conversation: {
        workspaceId,
      },
    },
    select: {
      isPinned: true,
      lastReadAt: true,
      conversation: {
        select: {
          id: true,
          type: true,
          title: true,
          updatedAt: true,
          members: {
            where: {
              userId: {
                not: userId,
              },
            },
            select: {
              user: {
                select: senderSelect,
              },
            },
            take: 1,
          },
          messages: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 1,
            select: {
              id: true,
              content: true,
              createdAt: true,
              senderId: true,
            },
          },
        },
      },
    },
  });

  const items: ChatConversationListItem[] = [];

  for (const membership of memberships) {
    const conversation = membership.conversation;
    const latest = conversation.messages[0] ?? null;
    const other = conversation.members[0]?.user ?? null;

    let unreadCount = 0;
    if (latest) {
      const unreadWhere: Prisma.WorkspaceChatMessageWhereInput = {
        conversationId: conversation.id,
        senderId: { not: userId },
        ...(membership.lastReadAt
          ? { createdAt: { gt: membership.lastReadAt } }
          : {}),
      };

      unreadCount = await prisma.workspaceChatMessage.count({
        where: unreadWhere,
      });
    }

    const displayName =
      conversation.type === "WORKSPACE"
        ? conversation.title?.trim() || "General chat"
        : other?.name ?? (conversation.title?.trim() || "Direct message");

    items.push({
      id: conversation.id,
      type: conversation.type,
      title: conversation.title,
      displayName,
      avatar: conversation.type === "DIRECT" ? other?.avatar ?? null : null,
      avatarUrl: conversation.type === "DIRECT" ? other?.avatarUrl ?? null : null,
      otherParticipant: conversation.type === "DIRECT" ? other : null,
      latestMessage: latest
        ? {
            id: latest.id,
            content: latest.content,
            createdAt: latest.createdAt.toISOString(),
            senderId: latest.senderId,
          }
        : null,
      latestMessageAt: latest ? latest.createdAt.toISOString() : null,
      unreadCount,
      isPinned: membership.isPinned,
      updatedAt: conversation.updatedAt.toISOString(),
    });
  }

  items.sort((a, b) =>
    compareConversationsForSidebar(
      {
        id: a.id,
        isPinned: a.isPinned,
        latestMessageAt: a.latestMessageAt,
        updatedAt: a.updatedAt,
        type: a.type,
        title: a.title,
      },
      {
        id: b.id,
        isPinned: b.isPinned,
        latestMessageAt: b.latestMessageAt,
        updatedAt: b.updatedAt,
        type: b.type,
        title: b.title,
      },
    ),
  );

  return items;
}

export async function getOrCreateDirectConversation(
  workspaceId: string,
  currentUserId: string,
  targetUserId: string,
): Promise<
  | { conversation: ChatConversationListItem }
  | "self"
  | "target_not_member"
> {
  if (assertDistinctDirectParticipants(currentUserId, targetUserId) === "self") {
    return "self";
  }

  const targetMembership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId: targetUserId,
      status: "ACTIVE",
    },
    select: { userId: true },
  });

  if (!targetMembership) {
    return "target_not_member";
  }

  await ensureActiveMembersInWorkspaceGeneralConversation(prisma, workspaceId);

  const identityKey = buildDirectIdentityKey(workspaceId, currentUserId, targetUserId);

  let conversationId: string;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const conversation = await tx.chatConversation.create({
        data: {
          workspaceId,
          type: "DIRECT",
          identityKey,
        },
        select: { id: true },
      });

      await tx.chatConversationMember.createMany({
        data: [
          {
            conversationId: conversation.id,
            userId: currentUserId,
            lastReadAt: new Date(),
            isPinned: false,
          },
          {
            conversationId: conversation.id,
            userId: targetUserId,
            lastReadAt: new Date(),
            isPinned: false,
          },
        ],
      });

      return conversation;
    });

    conversationId = created.id;
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    ) {
      throw error;
    }

    const existing = await prisma.chatConversation.findUnique({
      where: { identityKey },
      select: { id: true, workspaceId: true },
    });

    if (!existing || existing.workspaceId !== workspaceId) {
      throw error;
    }

    conversationId = existing.id;

    await prisma.chatConversationMember.createMany({
      data: [
        {
          conversationId,
          userId: currentUserId,
          lastReadAt: new Date(),
          isPinned: false,
        },
        {
          conversationId,
          userId: targetUserId,
          lastReadAt: new Date(),
          isPinned: false,
        },
      ],
      skipDuplicates: true,
    });
  }

  const conversations = await listChatConversations(workspaceId, currentUserId);
  const conversation = conversations.find((item) => item.id === conversationId);
  if (!conversation) {
    throw new Error("Direct conversation was created but could not be loaded");
  }

  return { conversation };
}

export async function setConversationPinned(input: {
  workspaceId: string;
  conversationId: string;
  userId: string;
  isPinned: boolean;
}): Promise<{ id: string; isPinned: boolean } | "not_found"> {
  const conversation = await findAccessibleConversation(input);
  if (!conversation) {
    return "not_found";
  }

  const updated = await prisma.chatConversationMember.update({
    where: {
      conversationId_userId: {
        conversationId: input.conversationId,
        userId: input.userId,
      },
    },
    data: {
      isPinned: input.isPinned,
    },
    select: {
      conversationId: true,
      isPinned: true,
    },
  });

  return {
    id: updated.conversationId,
    isPinned: updated.isPinned,
  };
}

export async function markConversationRead(input: {
  workspaceId: string;
  conversationId: string;
  userId: string;
}): Promise<{ id: string; unreadCount: number; lastReadAt: string } | "not_found"> {
  const conversation = await findAccessibleConversation(input);
  if (!conversation) {
    return "not_found";
  }

  const latest = await prisma.workspaceChatMessage.findFirst({
    where: { conversationId: input.conversationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { createdAt: true },
  });

  const lastReadAt = latest?.createdAt ?? new Date();

  await prisma.chatConversationMember.update({
    where: {
      conversationId_userId: {
        conversationId: input.conversationId,
        userId: input.userId,
      },
    },
    data: {
      lastReadAt,
    },
  });

  return {
    id: input.conversationId,
    unreadCount: 0,
    lastReadAt: lastReadAt.toISOString(),
  };
}

export async function listConversationMessages(
  workspaceId: string,
  conversationId: string,
  userId: string,
  options: {
    limit?: unknown;
    before?: unknown;
    after?: unknown;
  } = {},
): Promise<ChatMessagesPage | "invalid_cursor" | "not_found"> {
  const conversation = await findAccessibleConversation({
    workspaceId,
    conversationId,
    userId,
  });
  if (!conversation) {
    return "not_found";
  }

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
        conversationId,
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
      conversationId,
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

export async function createConversationMessage(
  workspaceId: string,
  conversationId: string,
  senderId: string,
  rawContent: unknown,
): Promise<ChatMessageDto | "invalid_content" | "not_found"> {
  const conversation = await findAccessibleConversation({
    workspaceId,
    conversationId,
    userId: senderId,
  });
  if (!conversation) {
    return "not_found";
  }

  const validation = validateChatMessageContent(rawContent);
  if (!validation.ok) {
    return "invalid_content";
  }

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.workspaceChatMessage.create({
      data: {
        conversationId,
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

    await tx.chatConversation.update({
      where: { id: conversationId },
      data: { updatedAt: created.createdAt },
    });

    await tx.chatConversationMember.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: senderId,
        },
      },
      data: {
        lastReadAt: created.createdAt,
      },
    });

    return created;
  });

  return mapMessage(message);
}

export async function deleteConversationMessage(
  workspaceId: string,
  conversationId: string,
  messageId: string,
  actorId: string,
): Promise<{ id: string } | "not_found" | "forbidden"> {
  const conversation = await findAccessibleConversation({
    workspaceId,
    conversationId,
    userId: actorId,
  });
  if (!conversation) {
    return "not_found";
  }

  const message = await prisma.workspaceChatMessage.findFirst({
    where: {
      id: messageId,
      conversationId,
    },
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

export async function getTotalUnreadChatCount(
  workspaceId: string,
  userId: string,
): Promise<number> {
  const conversations = await listChatConversations(workspaceId, userId);
  return conversations.reduce((sum, item) => sum + item.unreadCount, 0);
}
