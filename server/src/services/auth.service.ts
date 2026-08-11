import { randomBytes } from "node:crypto";

import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { ensureUserInWorkspaceGeneralConversation } from "../lib/chat-conversation-ensure.js";
import { prisma } from "../lib/prisma.js";

const BCRYPT_ROUNDS = 10;

const publicUserSelect = {
  id: true,
  name: true,
  displayName: true,
  timezone: true,
  bio: true,
  email: true,
  avatar: true,
  avatarUrl: true,
  phone: true,
  position: true,
  location: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type PublicUser = {
  id: string;
  name: string;
  displayName: string | null;
  timezone: string | null;
  bio: string | null;
  email: string;
  avatar: string | null;
  avatarUrl: string | null;
  phone: string | null;
  position: string | null;
  location: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UpdateUserProfileInput = {
  name?: string;
  displayName?: string;
  timezone?: string;
  bio?: string;
  phone?: string;
  position?: string;
  location?: string;
};

type JwtPayload = {
  sub: string;
};

export class AuthError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "workspace";
}

async function createUniqueWorkspaceSlug(base: string): Promise<string> {
  const slug = slugify(base);
  let candidate = slug;
  let suffix = 0;

  while (await prisma.workspace.findUnique({ where: { slug: candidate } })) {
    suffix += 1;
    candidate = `${slug}-${suffix}`;
  }

  return candidate;
}

async function createStarterWorkspaceData(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  userId: string,
): Promise<void> {
  const project = await tx.project.create({
    data: {
      workspaceId,
      name: "Getting Started",
      description: "A starter project to help you explore TeamFlow AI.",
      status: "ACTIVE",
      color: "from-blue-500 to-cyan-500",
    },
  });

  const taskCount = await tx.task.count();
  const starterTasks = [
    {
      title: "Create your first project",
      description: "Set up a project that reflects how your team plans and ships work.",
      status: "BACKLOG" as const,
      priority: "URGENT" as const,
    },
    {
      title: "Review the Kanban workflow",
      description: "Move tasks across columns and confirm statuses update as expected.",
      status: "IN_PROGRESS" as const,
      priority: "MEDIUM" as const,
    },
    {
      title: "Invite your first teammate",
      description: "Add a colleague so you can collaborate on tasks in this workspace.",
      status: "BACKLOG" as const,
      priority: "MEDIUM" as const,
    },
    {
      title: "Customize workspace settings",
      description: "Update your workspace name and preferences to match your team.",
      status: "DONE" as const,
      priority: "LOW" as const,
    },
  ];

  for (let index = 0; index < starterTasks.length; index += 1) {
    const task = starterTasks[index];
    await tx.task.create({
      data: {
        key: `TF-${taskCount + 101 + index}`,
        projectId: project.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assigneeId: userId,
      },
    });
  }
}

export function signAuthToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyAuthToken(token: string): string {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (!payload.sub) {
      throw new AuthError("Unauthorized", 401);
    }
    return payload.sub;
  } catch {
    throw new AuthError("Unauthorized", 401);
  }
}

async function createUserWithStarterWorkspace(input: {
  name: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string | null;
}): Promise<PublicUser> {
  const email = input.email.toLowerCase();
  const workspaceName = "Workspace";
  const workspaceSlug = await createUniqueWorkspaceSlug(input.name);

  return prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        name: input.name,
        email,
        passwordHash: input.passwordHash,
        avatarUrl: input.avatarUrl ?? undefined,
      },
      select: publicUserSelect,
    });

    const workspace = await tx.workspace.create({
      data: {
        name: workspaceName,
        slug: workspaceSlug,
      },
    });

    await tx.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: createdUser.id,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    await ensureUserInWorkspaceGeneralConversation(tx, workspace.id, createdUser.id);
    await createStarterWorkspaceData(tx, workspace.id, createdUser.id);

    return createdUser;
  });
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI);
}

export type GoogleProfileInput = {
  email: string;
  name: string;
  avatarUrl?: string | null;
};

export async function findOrCreateGoogleUser(
  profile: GoogleProfileInput,
): Promise<{ user: PublicUser; token: string; isNew: boolean }> {
  const email = profile.email.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, avatarUrl: true },
  });

  if (existing) {
    if (!existing.avatarUrl && profile.avatarUrl) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { avatarUrl: profile.avatarUrl },
      });
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: existing.id },
      select: publicUserSelect,
    });

    return { user, token: signAuthToken(existing.id), isNew: false };
  }

  // passwordHash is required by schema; OAuth users get an internal random hash (not user-facing).
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), BCRYPT_ROUNDS);

  try {
    const user = await createUserWithStarterWorkspace({
      name: profile.name,
      email,
      passwordHash,
      avatarUrl: profile.avatarUrl,
    });

    return { user, token: signAuthToken(user.id), isNew: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const linkedUser = await prisma.user.findUniqueOrThrow({
        where: { email },
        select: publicUserSelect,
      });
      return { user: linkedUser, token: signAuthToken(linkedUser.id), isNew: false };
    }
    throw error;
  }
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ user: PublicUser; token: string }> {
  const email = input.email.toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  try {
    const user = await createUserWithStarterWorkspace({
      name: input.name,
      email,
      passwordHash,
    });

    const token = signAuthToken(user.id);
    return { user, token };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AuthError("Email already exists", 409);
    }
    throw error;
  }
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<{ user: PublicUser; token: string }> {
  const email = input.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AuthError("Invalid email or password", 401);
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new AuthError("Invalid email or password", 401);
  }

  const publicUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: publicUserSelect,
  });

  const token = signAuthToken(user.id);
  return { user: publicUser, token };
}

export async function getUserById(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });

  if (!user) {
    throw new AuthError("Unauthorized", 401);
  }

  return user;
}

function optionalStringToNull(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function updateUserProfile(
  userId: string,
  input: UpdateUserProfileInput,
): Promise<PublicUser> {
  const data: Prisma.UserUpdateInput = {};

  if (input.name !== undefined) {
    data.name = input.name;
  }
  if (input.displayName !== undefined) {
    data.displayName = optionalStringToNull(input.displayName);
  }
  if (input.timezone !== undefined) {
    data.timezone = optionalStringToNull(input.timezone);
  }
  if (input.bio !== undefined) {
    data.bio = optionalStringToNull(input.bio);
  }
  if (input.phone !== undefined) {
    data.phone = optionalStringToNull(input.phone);
  }
  if (input.position !== undefined) {
    data.position = optionalStringToNull(input.position);
  }
  if (input.location !== undefined) {
    data.location = optionalStringToNull(input.location);
  }

  try {
    return await prisma.user.update({
      where: { id: userId },
      data,
      select: publicUserSelect,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new AuthError("Unauthorized", 401);
    }
    throw error;
  }
}

export async function updateUserAvatarUrl(userId: string, avatarUrl: string): Promise<PublicUser> {
  try {
    return await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: publicUserSelect,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new AuthError("Unauthorized", 401);
    }
    throw error;
  }
}

export async function removeUserAvatar(userId: string): Promise<PublicUser> {
  try {
    return await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
      select: publicUserSelect,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new AuthError("Unauthorized", 401);
    }
    throw error;
  }
}

/**
 * Clear uploaded-avatar references that point at a confirmed-missing file.
 * Matches relative `/uploads/avatars/:filename` and absolute URLs ending with that path.
 * Does not touch Google / external avatar URLs.
 */
export async function clearStaleUploadedAvatarReferences(filename: string): Promise<number> {
  const safe = filename.trim();
  if (
    !safe ||
    safe.includes("..") ||
    safe.includes("/") ||
    safe.includes("\\")
  ) {
    return 0;
  }

  const relativePath = `/uploads/avatars/${safe}`;
  const result = await prisma.user.updateMany({
    where: {
      OR: [
        { avatarUrl: relativePath },
        { avatarUrl: { endsWith: relativePath } },
      ],
    },
    data: { avatarUrl: null },
  });

  if (result.count > 0 && process.env.NODE_ENV !== "production") {
    console.log("[avatar] Cleared stale avatarUrl references", {
      filename: safe,
      count: result.count,
    });
  }

  return result.count;
}
