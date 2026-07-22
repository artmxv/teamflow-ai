import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import {
  assertProjectsBelongToWorkspace,
  assertTasksBelongToWorkspace,
  buildAttachmentPreviewText,
  buildChatStorageKey,
  canAccessChatAttachmentDownload,
  dedupeIds,
  filterSafeChatStorageKeys,
  isSafeChatStorageKey,
  parseRawIdListField,
  validateChatAttachmentFields,
  validateChatMessagePayload,
  validateChatUploadedFile,
  type ChatAttachmentTypeValue,
} from "../lib/chat-attachment-utils.js";
import { ensureActiveMembersInWorkspaceGeneralConversation } from "../lib/chat-conversation-ensure.js";
import {
  assertDistinctDirectParticipants,
  buildDirectIdentityKey,
  compareConversationsForSidebar,
} from "../lib/chat-conversation-utils.js";
import {
  canDeleteChatMessage,
  CHAT_MESSAGE_MAX_LENGTH,
  clampChatMessageLimit,
  decodeChatCursor,
  encodeChatCursor,
  type ChatCursor,
  validateChatMessageContent,
} from "../lib/chat-message-utils.js";
import {
  deleteStoredFile,
  persistUploadedFile,
  resolveStoredFile,
  shouldUseSupabaseForProjectTaskUploads,
  type ResolvedStoredFile,
} from "../lib/file-storage/index.js";
import { prisma } from "../lib/prisma.js";

const senderSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  avatarUrl: true,
} as const;

const attachmentInclude = {
  task: {
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      projectId: true,
      project: {
        select: {
          id: true,
          name: true,
          workspaceId: true,
        },
      },
    },
  },
  project: {
    select: {
      id: true,
      name: true,
      status: true,
      workspaceId: true,
    },
  },
} as const;

const messageSelect = {
  id: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  senderId: true,
  sender: { select: senderSelect },
  attachments: {
    orderBy: { createdAt: "asc" as const },
    include: attachmentInclude,
  },
} as const;

type SenderRow = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  avatarUrl: string | null;
};

type AttachmentRow = {
  id: string;
  type: ChatAttachmentTypeValue;
  originalName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  storageKey: string | null;
  taskId: string | null;
  projectId: string | null;
  task: {
    id: string;
    title: string;
    status: string;
    dueDate: Date | null;
    projectId: string;
    project: { id: string; name: string; workspaceId: string };
  } | null;
  project: {
    id: string;
    name: string;
    status: string;
    workspaceId: string;
  } | null;
};

type MessageRow = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  senderId: string;
  sender: SenderRow;
  attachments: AttachmentRow[];
};

export type ChatFileAttachmentDto = {
  id: string;
  type: "FILE";
  originalName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  downloadUrl: string;
};

export type ChatTaskAttachmentDto = {
  id: string;
  type: "TASK";
  taskId: string | null;
  title: string | null;
  status: string | null;
  dueDate: string | null;
  projectId: string | null;
  projectName: string | null;
  unavailable?: boolean;
};

export type ChatProjectAttachmentDto = {
  id: string;
  type: "PROJECT";
  projectId: string | null;
  name: string | null;
  status: string | null;
  unavailable?: boolean;
};

export type ChatAttachmentDto =
  | ChatFileAttachmentDto
  | ChatTaskAttachmentDto
  | ChatProjectAttachmentDto;

export type ChatMessageDto = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  sender: SenderRow;
  attachments: ChatAttachmentDto[];
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

export type CreateChatMessageInput = {
  content?: unknown;
  taskIds?: unknown;
  projectIds?: unknown;
  files?: Express.Multer.File[];
};

export type CreateChatMessageError =
  | "not_found"
  | "invalid_content"
  | "empty"
  | "too_long"
  | "too_many_files"
  | "invalid_file"
  | "duplicate_entity"
  | "task_not_found"
  | "project_not_found"
  | "storage_unavailable";

const SUPABASE_UPLOAD_REQUIRED_MESSAGE =
  "Chat file uploads require Supabase Storage. Set FILE_STORAGE_DRIVER=supabase with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET.";

function buildFileDownloadUrl(
  conversationId: string,
  attachmentId: string,
): string {
  return `/api/chat/conversations/${conversationId}/attachments/${attachmentId}/file`;
}

function mapAttachment(
  attachment: AttachmentRow,
  conversationId: string,
  workspaceId: string,
): ChatAttachmentDto {
  if (attachment.type === "FILE") {
    return {
      id: attachment.id,
      type: "FILE",
      originalName: attachment.originalName ?? "file",
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      downloadUrl: buildFileDownloadUrl(conversationId, attachment.id),
    };
  }

  if (attachment.type === "TASK") {
    const task = attachment.task;
    const inWorkspace = task?.project.workspaceId === workspaceId;
    if (!task || !inWorkspace) {
      return {
        id: attachment.id,
        type: "TASK",
        taskId: attachment.taskId,
        title: null,
        status: null,
        dueDate: null,
        projectId: null,
        projectName: null,
        unavailable: true,
      };
    }

    return {
      id: attachment.id,
      type: "TASK",
      taskId: task.id,
      title: task.title,
      status: task.status,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      projectId: task.projectId,
      projectName: task.project.name,
    };
  }

  const project = attachment.project;
  const inWorkspace = project?.workspaceId === workspaceId;
  if (!project || !inWorkspace) {
    return {
      id: attachment.id,
      type: "PROJECT",
      projectId: attachment.projectId,
      name: null,
      status: null,
      unavailable: true,
    };
  }

  return {
    id: attachment.id,
    type: "PROJECT",
    projectId: project.id,
    name: project.name,
    status: project.status,
  };
}

function mapMessage(
  message: MessageRow,
  conversationId: string,
  workspaceId: string,
): ChatMessageDto {
  return {
    id: message.id,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
    sender: message.sender,
    attachments: message.attachments.map((attachment) =>
      mapAttachment(attachment, conversationId, workspaceId),
    ),
  };
}

function previewContentForMessage(message: {
  content: string;
  attachments?: Array<{ type: ChatAttachmentTypeValue }>;
}): string {
  return buildAttachmentPreviewText(message.content, message.attachments ?? []);
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

async function cleanupUploadedStorageKeys(input: {
  workspaceId: string;
  conversationId: string;
  messageId: string;
  storageKeys: string[];
}) {
  const safeKeys = filterSafeChatStorageKeys({
    storageKeys: input.storageKeys,
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    messageId: input.messageId,
  });

  if (safeKeys.length !== input.storageKeys.length) {
    console.warn("Skipping unsafe chat storage key during cleanup");
  }

  for (const storageKey of safeKeys) {
    try {
      await deleteStoredFile({
        category: "chat",
        entityId: input.conversationId,
        filename: storageKey,
      });
    } catch (error) {
      console.error("Failed to clean up chat attachment storage object");
      if (error instanceof Error) {
        console.error(error.message);
      }
    }
  }
}

export async function validateConversationAccess(input: {
  workspaceId: string;
  conversationId: string;
  userId: string;
}): Promise<"ok" | "not_found"> {
  const conversation = await findAccessibleConversation(input);
  return conversation ? "ok" : "not_found";
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
              attachments: {
                select: { type: true },
              },
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
            content: previewContentForMessage(latest),
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
      select: messageSelect,
    });

    return {
      messages: newer.map((message) => mapMessage(message, conversationId, workspaceId)),
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
    select: messageSelect,
  });

  const hasMoreOlder = rows.length > limit;
  const page = hasMoreOlder ? rows.slice(0, limit) : rows;
  const chronological = [...page].reverse();

  return {
    messages: chronological.map((message) =>
      mapMessage(message, conversationId, workspaceId),
    ),
    pageInfo: buildPageInfo(chronological, hasMoreOlder),
  };
}

/**
 * Text-only path preserved for existing JSON clients.
 */
export async function createConversationMessage(
  workspaceId: string,
  conversationId: string,
  senderId: string,
  rawContent: unknown,
): Promise<ChatMessageDto | "invalid_content" | "not_found"> {
  const validation = validateChatMessageContent(rawContent);
  if (!validation.ok) {
    return "invalid_content";
  }

  const result = await createConversationMessageWithAttachments(
    workspaceId,
    conversationId,
    senderId,
    { content: validation.content },
  );

  if (typeof result === "string") {
    if (result === "not_found") {
      return "not_found";
    }
    return "invalid_content";
  }

  return result;
}

export async function createConversationMessageWithAttachments(
  workspaceId: string,
  conversationId: string,
  senderId: string,
  input: CreateChatMessageInput,
): Promise<ChatMessageDto | CreateChatMessageError> {
  const conversation = await findAccessibleConversation({
    workspaceId,
    conversationId,
    userId: senderId,
  });
  if (!conversation) {
    return "not_found";
  }

  const files = input.files ?? [];
  const rawTaskIds = parseRawIdListField(input.taskIds);
  const rawProjectIds = parseRawIdListField(input.projectIds);

  const payload = validateChatMessagePayload({
    rawContent: input.content,
    maxLength: CHAT_MESSAGE_MAX_LENGTH,
    fileCount: files.length,
    taskIds: rawTaskIds,
    projectIds: rawProjectIds,
  });

  if (!payload.ok) {
    return payload.reason;
  }

  const taskIds = dedupeIds(rawTaskIds);
  const projectIds = dedupeIds(rawProjectIds);

  for (const file of files) {
    const fileValidation = validateChatUploadedFile({
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });
    if (!fileValidation.ok) {
      return "invalid_file";
    }
  }

  if (files.length > 0 && !shouldUseSupabaseForProjectTaskUploads()) {
    return "storage_unavailable";
  }

  if (taskIds.length > 0) {
    const tasks = await prisma.task.findMany({
      where: { id: { in: taskIds } },
      select: {
        id: true,
        project: { select: { workspaceId: true } },
      },
    });

    const mapped = tasks.map((task) => ({
      id: task.id,
      workspaceId: task.project.workspaceId,
    }));

    const taskCheck = assertTasksBelongToWorkspace({
      requestedTaskIds: taskIds,
      foundTasks: mapped,
      workspaceId,
    });

    if (taskCheck === "missing") {
      return "task_not_found";
    }
    if (taskCheck === "cross_workspace") {
      return "task_not_found";
    }
  }

  if (projectIds.length > 0) {
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, workspaceId: true },
    });

    const projectCheck = assertProjectsBelongToWorkspace({
      requestedProjectIds: projectIds,
      foundProjects: projects,
      workspaceId,
    });

    if (projectCheck === "missing" || projectCheck === "cross_workspace") {
      return "project_not_found";
    }
  }

  const messageId = randomUUID();
  const uploadedKeys: string[] = [];
  const fileAttachmentRows: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
  }> = [];

  try {
    for (const file of files) {
      const fileValidation = validateChatUploadedFile({
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      });
      if (!fileValidation.ok || !file.buffer) {
        throw new Error("Invalid uploaded chat file");
      }

      const storageKey = buildChatStorageKey({
        workspaceId,
        conversationId,
        messageId,
        originalName: fileValidation.originalName,
      });

      const fieldCheck = validateChatAttachmentFields({
        type: "FILE",
        originalName: fileValidation.originalName,
        mimeType: fileValidation.mimeType,
        sizeBytes: fileValidation.sizeBytes,
        storageKey,
        taskId: null,
        projectId: null,
      });
      if (!fieldCheck.ok) {
        throw new Error("Invalid chat file attachment fields");
      }

      await persistUploadedFile({
        objectKey: storageKey,
        mimeType: fileValidation.mimeType,
        buffer: file.buffer,
      });
      uploadedKeys.push(storageKey);
      fileAttachmentRows.push({
        id: randomUUID(),
        originalName: fileValidation.originalName,
        mimeType: fileValidation.mimeType,
        sizeBytes: fileValidation.sizeBytes,
        storageKey,
      });
    }

    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.workspaceChatMessage.create({
        data: {
          id: messageId,
          conversationId,
          senderId,
          content: payload.content,
          attachments: {
            create: [
              ...fileAttachmentRows.map((file) => ({
                id: file.id,
                type: "FILE" as const,
                originalName: file.originalName,
                mimeType: file.mimeType,
                sizeBytes: file.sizeBytes,
                storageKey: file.storageKey,
              })),
              ...taskIds.map((taskId) => ({
                type: "TASK" as const,
                taskId,
              })),
              ...projectIds.map((projectId) => ({
                type: "PROJECT" as const,
                projectId,
              })),
            ],
          },
        },
        select: messageSelect,
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

    return mapMessage(message, conversationId, workspaceId);
  } catch (error) {
    await cleanupUploadedStorageKeys({
      workspaceId,
      conversationId,
      messageId,
      storageKeys: uploadedKeys,
    });
    throw error;
  }
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
    select: {
      id: true,
      senderId: true,
      attachments: {
        where: { type: "FILE" },
        select: { storageKey: true },
      },
    },
  });

  if (!message) {
    return "not_found";
  }

  if (!canDeleteChatMessage(message.senderId, actorId)) {
    return "forbidden";
  }

  const storageKeys = message.attachments
    .map((attachment) => attachment.storageKey)
    .filter((key): key is string => Boolean(key));

  await prisma.workspaceChatMessage.delete({
    where: { id: messageId },
  });

  await cleanupUploadedStorageKeys({
    workspaceId,
    conversationId,
    messageId,
    storageKeys,
  });

  return { id: messageId };
}

export async function getChatAttachmentFile(input: {
  workspaceId: string;
  conversationId: string;
  attachmentId: string;
  userId: string;
  isAuthenticated: boolean;
  isActiveWorkspaceMember: boolean;
}): Promise<
  | ResolvedStoredFile
  | "unauthenticated"
  | "forbidden"
  | "not_found"
> {
  if (!input.isAuthenticated) {
    return "unauthenticated";
  }

  if (!input.isActiveWorkspaceMember) {
    return "forbidden";
  }

  const conversation = await findAccessibleConversation({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    userId: input.userId,
  });

  const attachment = await prisma.chatMessageAttachment.findFirst({
    where: {
      id: input.attachmentId,
      message: {
        conversationId: input.conversationId,
        conversation: {
          workspaceId: input.workspaceId,
        },
      },
    },
    select: {
      id: true,
      type: true,
      originalName: true,
      mimeType: true,
      storageKey: true,
      message: {
        select: {
          id: true,
          conversationId: true,
          conversation: {
            select: { workspaceId: true },
          },
        },
      },
    },
  });

  const auth = canAccessChatAttachmentDownload({
    isAuthenticated: input.isAuthenticated,
    isActiveWorkspaceMember: input.isActiveWorkspaceMember,
    isConversationMember: Boolean(conversation),
    attachmentBelongsToConversation: Boolean(
      attachment && attachment.message.conversationId === input.conversationId,
    ),
    attachmentType: attachment?.type ?? null,
    attachmentWorkspaceId: attachment?.message.conversation.workspaceId ?? null,
    activeWorkspaceId: input.workspaceId,
  });

  if (auth !== "ok") {
    return auth;
  }

  if (!attachment?.storageKey) {
    return "not_found";
  }

  if (
    !isSafeChatStorageKey({
      storageKey: attachment.storageKey,
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      messageId: attachment.message.id,
    })
  ) {
    console.warn("Rejected unsafe chat attachment storage key for download");
    return "not_found";
  }

  const resolved = await resolveStoredFile({
    category: "chat",
    entityId: input.conversationId,
    filename: attachment.storageKey,
    mimeType: attachment.mimeType || "application/octet-stream",
    originalName: attachment.originalName || "file",
  });

  if (!resolved) {
    return "not_found";
  }

  return resolved;
}

export async function getTotalUnreadChatCount(
  workspaceId: string,
  userId: string,
): Promise<number> {
  const conversations = await listChatConversations(workspaceId, userId);
  return conversations.reduce((sum, item) => sum + item.unreadCount, 0);
}

export { buildAttachmentPreviewText, SUPABASE_UPLOAD_REQUIRED_MESSAGE };
