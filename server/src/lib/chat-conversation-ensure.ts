import { Prisma } from "@prisma/client";

import { prisma } from "./prisma.js";
import { buildWorkspaceGeneralIdentityKey } from "./chat-conversation-utils.js";

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function ensureWorkspaceGeneralConversation(
  db: DbClient,
  workspaceId: string,
): Promise<{ id: string }> {
  const identityKey = buildWorkspaceGeneralIdentityKey(workspaceId);
  const existing = await db.chatConversation.findUnique({
    where: { identityKey },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  try {
    return await db.chatConversation.create({
      data: {
        workspaceId,
        type: "WORKSPACE",
        identityKey,
      },
      select: { id: true },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await db.chatConversation.findUnique({
        where: { identityKey },
        select: { id: true },
      });
      if (raced) {
        return raced;
      }
    }
    throw error;
  }
}

export async function ensureUserInWorkspaceGeneralConversation(
  db: DbClient,
  workspaceId: string,
  userId: string,
  joinedAt: Date = new Date(),
): Promise<void> {
  const general = await ensureWorkspaceGeneralConversation(db, workspaceId);

  await db.chatConversationMember.upsert({
    where: {
      conversationId_userId: {
        conversationId: general.id,
        userId,
      },
    },
    create: {
      conversationId: general.id,
      userId,
      joinedAt,
      lastReadAt: new Date(),
      isPinned: false,
    },
    update: {},
  });
}

export async function ensureActiveMembersInWorkspaceGeneralConversation(
  db: DbClient,
  workspaceId: string,
): Promise<{ id: string }> {
  const general = await ensureWorkspaceGeneralConversation(db, workspaceId);
  const members = await db.workspaceMember.findMany({
    where: {
      workspaceId,
      status: "ACTIVE",
    },
    select: {
      userId: true,
      joinedAt: true,
    },
  });

  for (const member of members) {
    await db.chatConversationMember.upsert({
      where: {
        conversationId_userId: {
          conversationId: general.id,
          userId: member.userId,
        },
      },
      create: {
        conversationId: general.id,
        userId: member.userId,
        joinedAt: member.joinedAt,
        lastReadAt: new Date(),
        isPinned: false,
      },
      update: {},
    });
  }

  return general;
}
