import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

const BCRYPT_ROUNDS = 10;

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type JwtPayload = {
  sub: string;
};

export class AuthError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
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
  let slug = slugify(base);
  let candidate = slug;
  let suffix = 0;

  while (await prisma.workspace.findUnique({ where: { slug: candidate } })) {
    suffix += 1;
    candidate = `${slug}-${suffix}`;
  }

  return candidate;
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

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ user: PublicUser; token: string }> {
  const email = input.email.toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const workspaceName = `${input.name}'s Workspace`;
  const workspaceSlug = await createUniqueWorkspaceSlug(input.name);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: input.name,
          email,
          passwordHash,
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

      return createdUser;
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
