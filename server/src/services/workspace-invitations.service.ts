import { randomBytes } from "node:crypto";

import type { BillingPlan, WorkspaceInvitationStatus, WorkspaceRole } from "@prisma/client";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import type { PublicUser } from "./auth.service.js";
import { AuthError } from "./auth.service.js";
import { assertCanInviteMember } from "./billing-plans.service.js";
import { sendWorkspaceInviteEmail } from "./email.service.js";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const invitationSelect = {
  id: true,
  workspaceId: true,
  email: true,
  role: true,
  token: true,
  status: true,
  expiresAt: true,
  acceptedAt: true,
  createdAt: true,
  workspace: {
    select: {
      name: true,
    },
  },
} as const;

export type WorkspaceInvitationDto = {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  status: WorkspaceInvitationStatus;
  expiresAt: string;
  createdAt: string;
  acceptUrl: string;
};

export type InvitationPreviewDto = {
  id: string;
  workspaceName: string;
  email: string;
  role: WorkspaceRole;
  status: WorkspaceInvitationStatus;
  expiresAt: string;
  isExpired: boolean;
  canAccept: boolean;
  emailMatchesCurrentUser: boolean | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function assertOwner(actorRole: WorkspaceRole): void {
  if (actorRole !== "OWNER") {
    throw new AuthError("Only workspace owners can invite members", 403);
  }
}

function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function buildWorkspaceInviteAcceptUrl(token: string): string {
  return `${env.APP_URL}/invite/${token}`;
}

function isInviteExpired(invite: { expiresAt: Date; status: WorkspaceInvitationStatus }): boolean {
  return invite.status === "EXPIRED" || invite.expiresAt.getTime() <= Date.now();
}

async function markExpiredIfNeeded<
  T extends { id: string; status: WorkspaceInvitationStatus; expiresAt: Date },
>(invite: T): Promise<T> {
  if (invite.status !== "PENDING" || invite.expiresAt.getTime() > Date.now()) {
    return invite;
  }

  const updated = await prisma.workspaceInvitation.update({
    where: { id: invite.id },
    data: { status: "EXPIRED" },
    select: { status: true },
  });

  return { ...invite, status: updated.status };
}

function toInvitationDto(invite: {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  status: WorkspaceInvitationStatus;
  expiresAt: Date;
  createdAt: Date;
  token: string;
}): WorkspaceInvitationDto {
  return {
    id: invite.id,
    workspaceId: invite.workspaceId,
    email: invite.email,
    role: invite.role,
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
    acceptUrl: buildWorkspaceInviteAcceptUrl(invite.token),
  };
}

async function findActivePendingInvite(workspaceId: string, email: string) {
  return prisma.workspaceInvitation.findFirst({
    where: {
      workspaceId,
      email,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: invitationSelect,
  });
}

async function assertNotWorkspaceMember(workspaceId: string, email: string): Promise<void> {
  const existingMember = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      user: { email },
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (existingMember) {
    throw new AuthError("User is already a workspace member", 409);
  }
}

export async function listWorkspaceInvitations(
  workspaceId: string,
  actorRole: WorkspaceRole,
): Promise<WorkspaceInvitationDto[]> {
  assertOwner(actorRole);

  const invites = await prisma.workspaceInvitation.findMany({
    where: {
      workspaceId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: invitationSelect,
  });

  return invites.map((invite) => toInvitationDto(invite));
}

export async function createWorkspaceInvitation(input: {
  workspaceId: string;
  workspaceName: string;
  workspacePlan: BillingPlan;
  inviterUserId: string;
  inviterRole: WorkspaceRole;
  email: string;
  role: WorkspaceRole;
}): Promise<{
  invitation: WorkspaceInvitationDto;
  deliveryMode: string;
  emailSent: boolean;
  emailWarning?: string;
  reused: boolean;
}> {
  assertOwner(input.inviterRole);

  if (input.role === "OWNER") {
    throw new AuthError("Cannot invite users as workspace owner", 400);
  }

  if (input.role !== "ADMIN" && input.role !== "MEMBER") {
    throw new AuthError("Invite role must be admin or member", 400);
  }

  const email = normalizeEmail(input.email);
  if (!email) {
    throw new AuthError("Email is required", 400);
  }

  await assertNotWorkspaceMember(input.workspaceId, email);

  const existing = await findActivePendingInvite(input.workspaceId, email);
  if (existing) {
    return {
      invitation: toInvitationDto(existing),
      deliveryMode: "existing",
      emailSent: true,
      reused: true,
    };
  }

  await assertCanInviteMember({
    workspaceId: input.workspaceId,
    plan: input.workspacePlan,
    isReusingPendingInvite: false,
  });

  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const token = generateInviteToken();

  const invite = await prisma.workspaceInvitation.create({
    data: {
      workspaceId: input.workspaceId,
      email,
      role: input.role,
      token,
      invitedById: input.inviterUserId,
      expiresAt,
    },
    select: invitationSelect,
  });

  const acceptUrl = buildWorkspaceInviteAcceptUrl(token);

  const inviter = await prisma.user.findUnique({
    where: { id: input.inviterUserId },
    select: { name: true, displayName: true, email: true },
  });

  const emailResult = await sendWorkspaceInviteEmail({
    to: email,
    workspaceName: input.workspaceName,
    role: input.role,
    acceptUrl,
    expiresAt,
    inviterName: inviter?.displayName ?? inviter?.name ?? null,
    inviterEmail: inviter?.email ?? null,
  });

  return {
    invitation: toInvitationDto(invite),
    deliveryMode: emailResult.mode,
    emailSent: emailResult.sent,
    emailWarning: emailResult.warning,
    reused: false,
  };
}

export async function revokeWorkspaceInvitation(
  workspaceId: string,
  invitationId: string,
  actorRole: WorkspaceRole,
): Promise<WorkspaceInvitationDto> {
  assertOwner(actorRole);

  const invite = await prisma.workspaceInvitation.findFirst({
    where: { id: invitationId, workspaceId },
    select: invitationSelect,
  });

  if (!invite) {
    throw new AuthError("Invitation not found", 404);
  }

  if (invite.status !== "PENDING") {
    throw new AuthError("Only pending invitations can be revoked", 400);
  }

  const revoked = await prisma.workspaceInvitation.update({
    where: { id: invitationId },
    data: { status: "REVOKED" },
    select: invitationSelect,
  });

  return toInvitationDto(revoked);
}

export async function listPendingInvitationsForUser(
  userId: string,
  email: string,
): Promise<
  Array<{
    id: string;
    token: string;
    role: WorkspaceRole;
    createdAt: Date;
    workspaceId: string;
    workspaceName: string;
  }>
> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return [];
  }

  const [invites, activeMemberships] = await Promise.all([
    prisma.workspaceInvitation.findMany({
      where: {
        email: normalized,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        token: true,
        role: true,
        createdAt: true,
        workspaceId: true,
        workspace: { select: { name: true } },
      },
    }),
    prisma.workspaceMember.findMany({
      where: { userId, status: "ACTIVE" },
      select: { workspaceId: true },
    }),
  ]);

  const memberWorkspaceIds = new Set(activeMemberships.map((membership) => membership.workspaceId));

  return invites
    .filter((invite) => !memberWorkspaceIds.has(invite.workspaceId))
    .map((invite) => ({
      id: invite.id,
      token: invite.token,
      role: invite.role,
      createdAt: invite.createdAt,
      workspaceId: invite.workspaceId,
      workspaceName: invite.workspace.name,
    }));
}

export async function getInvitationByToken(
  token: string,
  currentUser?: Pick<PublicUser, "email"> | null,
): Promise<InvitationPreviewDto> {
  const invite = await prisma.workspaceInvitation.findUnique({
    where: { token },
    select: invitationSelect,
  });

  if (!invite) {
    throw new AuthError(
      "This invitation is no longer available.",
      404,
      "INVITATION_NO_LONGER_AVAILABLE",
    );
  }

  const resolved = await markExpiredIfNeeded(invite);
  const expired = isInviteExpired(resolved);
  const unavailable = resolved.status === "REVOKED" || resolved.status === "ACCEPTED";
  const currentEmail = currentUser?.email ? normalizeEmail(currentUser.email) : null;

  return {
    id: resolved.id,
    workspaceName: resolved.workspace.name,
    email: resolved.email,
    role: resolved.role,
    status: resolved.status,
    expiresAt: resolved.expiresAt.toISOString(),
    isExpired: expired || unavailable,
    canAccept: resolved.status === "PENDING" && !expired,
    emailMatchesCurrentUser: currentEmail === null ? null : currentEmail === resolved.email,
  };
}

export async function acceptWorkspaceInvitation(
  token: string,
  currentUser: PublicUser,
): Promise<{ workspaceId: string; role: WorkspaceRole }> {
  const invite = await prisma.workspaceInvitation.findUnique({
    where: { token },
    include: {
      workspace: { select: { id: true, name: true } },
    },
  });

  if (!invite) {
    throw new AuthError(
      "This invitation is no longer available.",
      404,
      "INVITATION_NO_LONGER_AVAILABLE",
    );
  }

  const resolved = await markExpiredIfNeeded(invite);

  if (resolved.status !== "PENDING" || isInviteExpired(resolved)) {
    throw new AuthError(
      "This invitation is no longer available.",
      404,
      "INVITATION_NO_LONGER_AVAILABLE",
    );
  }

  const userEmail = normalizeEmail(currentUser.email);
  if (userEmail !== resolved.email) {
    throw new AuthError(
      "Sign in with the email address this invitation was sent to.",
      403,
      "INVITATION_EMAIL_MISMATCH",
    );
  }

  const existingMembership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: resolved.workspaceId,
      userId: currentUser.id,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (existingMembership) {
    await prisma.workspaceInvitation.update({
      where: { id: resolved.id },
      data: {
        status: "ACCEPTED",
        acceptedById: currentUser.id,
        acceptedAt: new Date(),
      },
    });
    throw new AuthError("User is already a workspace member", 409);
  }

  await prisma.$transaction(async (tx) => {
    await tx.workspaceMember.create({
      data: {
        workspaceId: resolved.workspaceId,
        userId: currentUser.id,
        role: resolved.role,
        status: "ACTIVE",
      },
    });

    await tx.workspaceInvitation.update({
      where: { id: resolved.id },
      data: {
        status: "ACCEPTED",
        acceptedById: currentUser.id,
        acceptedAt: new Date(),
      },
    });
  });

  return {
    workspaceId: resolved.workspaceId,
    role: resolved.role,
  };
}
