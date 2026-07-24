import type { BillingPlan, Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { AuthError } from "./auth.service.js";

type DbClient = Prisma.TransactionClient | typeof prisma;

export const MEMBER_LIMIT_REACHED_CODE = "MEMBER_LIMIT_REACHED";

export type BillingPlanLimits = {
  maxMembers: number | null;
  maxWorkspaces: number | null;
};

export type BillingPlanConfig = {
  id: BillingPlan;
  label: string;
  limits: BillingPlanLimits;
};

const PLAN_CONFIG: Record<BillingPlan, BillingPlanConfig> = {
  FREE: {
    id: "FREE",
    label: "Free",
    limits: { maxMembers: 5, maxWorkspaces: 1 },
  },
  TEAM: {
    id: "TEAM",
    label: "Team",
    limits: { maxMembers: 10, maxWorkspaces: 2 },
  },
  BUSINESS: {
    id: "BUSINESS",
    label: "Business",
    limits: { maxMembers: 20, maxWorkspaces: 5 },
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    label: "Enterprise",
    limits: { maxMembers: null, maxWorkspaces: null },
  },
};

const PLAN_ORDER: BillingPlan[] = ["FREE", "TEAM", "BUSINESS", "ENTERPRISE"];

export function getBillingPlanConfig(plan: BillingPlan): BillingPlanConfig {
  return PLAN_CONFIG[plan];
}

export function getBillingPlans(): BillingPlanConfig[] {
  return PLAN_ORDER.map((plan) => PLAN_CONFIG[plan]);
}

export async function countActiveWorkspaceMembers(workspaceId: string): Promise<number> {
  return prisma.workspaceMember.count({
    where: {
      workspaceId,
      status: "ACTIVE",
    },
  });
}

export async function countValidPendingInvitations(workspaceId: string): Promise<number> {
  return prisma.workspaceInvitation.count({
    where: {
      workspaceId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
  });
}

export const WORKSPACE_LIMIT_REACHED_CODE = "WORKSPACE_LIMIT_REACHED";

export async function countUserWorkspaces(userId: string): Promise<number> {
  return prisma.workspaceMember.count({
    where: {
      userId,
      role: "OWNER",
      status: "ACTIVE",
    },
  });
}

export async function getWorkspaceMemberUsage(workspaceId: string): Promise<{
  members: number;
  pendingInvitations: number;
}> {
  const [members, pendingInvitations] = await Promise.all([
    countActiveWorkspaceMembers(workspaceId),
    countValidPendingInvitations(workspaceId),
  ]);

  return { members, pendingInvitations };
}

export async function assertCanInviteMember(input: {
  workspaceId: string;
  plan: BillingPlan;
  isReusingPendingInvite: boolean;
}): Promise<void> {
  const { limits } = getBillingPlanConfig(input.plan);
  if (limits.maxMembers === null) {
    return;
  }

  if (input.isReusingPendingInvite) {
    return;
  }

  const usage = await getWorkspaceMemberUsage(input.workspaceId);
  const seatsUsed = usage.members + usage.pendingInvitations;

  if (seatsUsed >= limits.maxMembers) {
    throw new AuthError(
      "Member limit reached for the current plan",
      409,
      MEMBER_LIMIT_REACHED_CODE,
    );
  }
}

/** Seat check for accepting an invite: only ACTIVE members count (pending is converting). */
export async function assertCanAcceptMember(input: {
  workspaceId: string;
  plan: BillingPlan;
  db?: DbClient;
}): Promise<void> {
  const { limits } = getBillingPlanConfig(input.plan);
  if (limits.maxMembers === null) {
    return;
  }

  const db = input.db ?? prisma;
  const members = await db.workspaceMember.count({
    where: {
      workspaceId: input.workspaceId,
      status: "ACTIVE",
    },
  });

  if (members >= limits.maxMembers) {
    throw new AuthError(
      "Member limit reached for the current plan",
      409,
      MEMBER_LIMIT_REACHED_CODE,
    );
  }
}
