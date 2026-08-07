import type { BillingPlan, Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { AuthError } from "./auth.service.js";

export type BillingDbClient = Prisma.TransactionClient | typeof prisma;

export const MEMBER_LIMIT_REACHED_CODE = "MEMBER_LIMIT_REACHED";
export const PLAN_MEMBER_LIMIT_EXCEEDED_CODE = "PLAN_MEMBER_LIMIT_EXCEEDED";
export const PLAN_WORKSPACE_LIMIT_EXCEEDED_CODE = "PLAN_WORKSPACE_LIMIT_EXCEEDED";
export const WORKSPACE_LIMIT_REACHED_CODE = "WORKSPACE_LIMIT_REACHED";

export type BillingPlanUsageErrorDetails = {
  targetPlan: BillingPlan;
  used: number;
  limit: number;
};

export class BillingPlanUsageError extends AuthError {
  constructor(
    message: string,
    code: typeof PLAN_MEMBER_LIMIT_EXCEEDED_CODE | typeof PLAN_WORKSPACE_LIMIT_EXCEEDED_CODE,
    readonly details: BillingPlanUsageErrorDetails,
  ) {
    super(message, 409, code);
    this.name = "BillingPlanUsageError";
  }
}

export type BillingPlanLimits = {
  maxMembers: number | null;
  maxWorkspaces: number | null;
};

export type BillingPlanConfig = {
  id: BillingPlan;
  label: string;
  /** Monthly price in RUB. `null` means contact sales. */
  monthlyPriceRub: number | null;
  currency: "RUB";
  limits: BillingPlanLimits;
};

const PLAN_CONFIG: Record<BillingPlan, BillingPlanConfig> = {
  FREE: {
    id: "FREE",
    label: "Free",
    monthlyPriceRub: 0,
    currency: "RUB",
    limits: { maxMembers: 5, maxWorkspaces: 1 },
  },
  TEAM: {
    id: "TEAM",
    label: "Team",
    monthlyPriceRub: 990,
    currency: "RUB",
    limits: { maxMembers: 10, maxWorkspaces: 2 },
  },
  BUSINESS: {
    id: "BUSINESS",
    label: "Business",
    monthlyPriceRub: 2490,
    currency: "RUB",
    limits: { maxMembers: 20, maxWorkspaces: 5 },
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    label: "Enterprise",
    monthlyPriceRub: null,
    currency: "RUB",
    limits: { maxMembers: null, maxWorkspaces: null },
  },
};

/** Paid self-service plans that require a one-time YooKassa payment in V1. */
export type PaidSelfServicePlan = Extract<BillingPlan, "TEAM" | "BUSINESS">;

export function isPaidSelfServicePlan(plan: BillingPlan): plan is PaidSelfServicePlan {
  return plan === "TEAM" || plan === "BUSINESS";
}

/** YooKassa amount.value format, e.g. "990.00". */
export function getPlanAmountValue(plan: PaidSelfServicePlan): string {
  const rub = PLAN_CONFIG[plan].monthlyPriceRub;
  if (rub === null) {
    throw new Error(`Plan ${plan} has no self-service price`);
  }
  return `${rub.toFixed(2)}`;
}

const PLAN_ORDER: BillingPlan[] = ["FREE", "TEAM", "BUSINESS", "ENTERPRISE"];

export function getBillingPlanConfig(plan: BillingPlan): BillingPlanConfig {
  return PLAN_CONFIG[plan];
}

export function getBillingPlans(): BillingPlanConfig[] {
  return PLAN_ORDER.map((plan) => PLAN_CONFIG[plan]);
}

export function isBillingPlanDowngrade(currentPlan: BillingPlan, targetPlan: BillingPlan): boolean {
  return PLAN_ORDER.indexOf(targetPlan) < PLAN_ORDER.indexOf(currentPlan);
}

export async function lockWorkspaceBillingUsage(
  db: BillingDbClient,
  workspaceId: string,
): Promise<void> {
  await db.$queryRaw`
    SELECT 1 AS "locked"
    FROM pg_advisory_xact_lock(hashtext(${`billing:workspace:${workspaceId}`}))
  `;
}

export async function lockUserWorkspaceUsage(db: BillingDbClient, userId: string): Promise<void> {
  await db.$queryRaw`
    SELECT 1 AS "locked"
    FROM pg_advisory_xact_lock(hashtext(${`billing:user:${userId}`}))
  `;
}

export async function lockWorkspaceOwnerUsage(
  db: BillingDbClient,
  workspaceId: string,
): Promise<void> {
  const owners = await db.workspaceMember.findMany({
    where: {
      workspaceId,
      role: "OWNER",
      status: "ACTIVE",
    },
    select: { userId: true },
    orderBy: { userId: "asc" },
  });
  for (const owner of owners) {
    await lockUserWorkspaceUsage(db, owner.userId);
  }
}

export async function countActiveWorkspaceMembers(
  workspaceId: string,
  db: BillingDbClient = prisma,
): Promise<number> {
  return db.workspaceMember.count({
    where: {
      workspaceId,
      status: "ACTIVE",
    },
  });
}

export async function countValidPendingInvitations(
  workspaceId: string,
  db: BillingDbClient = prisma,
): Promise<number> {
  return db.workspaceInvitation.count({
    where: {
      workspaceId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
  });
}

export async function countUserWorkspaces(
  userId: string,
  db: BillingDbClient = prisma,
): Promise<number> {
  return db.workspaceMember.count({
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
}>;
export async function getWorkspaceMemberUsage(
  workspaceId: string,
  db: BillingDbClient,
): Promise<{
  members: number;
  pendingInvitations: number;
}>;
export async function getWorkspaceMemberUsage(
  workspaceId: string,
  db: BillingDbClient = prisma,
): Promise<{
  members: number;
  pendingInvitations: number;
}> {
  const [members, pendingInvitations] = await Promise.all([
    countActiveWorkspaceMembers(workspaceId, db),
    countValidPendingInvitations(workspaceId, db),
  ]);

  return { members, pendingInvitations };
}

export async function getWorkspaceOwnerWorkspaceUsage(
  workspaceId: string,
  db: BillingDbClient = prisma,
): Promise<number> {
  const owners = await db.workspaceMember.findMany({
    where: {
      workspaceId,
      role: "OWNER",
      status: "ACTIVE",
    },
    select: { userId: true },
  });

  if (owners.length === 0) {
    return 0;
  }

  const ownedCounts = await Promise.all(
    owners.map((owner) => countUserWorkspaces(owner.userId, db)),
  );
  return Math.max(...ownedCounts);
}

export async function assertPlanUsageWithinLimits(input: {
  workspaceId: string;
  targetPlan: BillingPlan;
  ownerUserId?: string;
  db?: BillingDbClient;
}): Promise<void> {
  const db = input.db ?? prisma;
  const { limits } = getBillingPlanConfig(input.targetPlan);

  if (limits.maxMembers !== null) {
    const usage = await getWorkspaceMemberUsage(input.workspaceId, db);
    const seatsUsed = usage.members + usage.pendingInvitations;
    if (seatsUsed > limits.maxMembers) {
      throw new BillingPlanUsageError(
        `Cannot change to ${input.targetPlan}: ${seatsUsed} of ${limits.maxMembers} seats are used`,
        PLAN_MEMBER_LIMIT_EXCEEDED_CODE,
        {
          targetPlan: input.targetPlan,
          used: seatsUsed,
          limit: limits.maxMembers,
        },
      );
    }
  }

  if (limits.maxWorkspaces !== null) {
    const workspacesUsed = input.ownerUserId
      ? await countUserWorkspaces(input.ownerUserId, db)
      : await getWorkspaceOwnerWorkspaceUsage(input.workspaceId, db);
    if (workspacesUsed > limits.maxWorkspaces) {
      throw new BillingPlanUsageError(
        `Cannot change to ${input.targetPlan}: ${workspacesUsed} of ${limits.maxWorkspaces} workspaces are used`,
        PLAN_WORKSPACE_LIMIT_EXCEEDED_CODE,
        {
          targetPlan: input.targetPlan,
          used: workspacesUsed,
          limit: limits.maxWorkspaces,
        },
      );
    }
  }
}

export async function assertCanInviteMember(input: {
  workspaceId: string;
  plan: BillingPlan;
  isReusingPendingInvite: boolean;
  db?: BillingDbClient;
}): Promise<void> {
  const { limits } = getBillingPlanConfig(input.plan);
  if (limits.maxMembers === null) {
    return;
  }

  if (input.isReusingPendingInvite) {
    return;
  }

  const usage = await getWorkspaceMemberUsage(input.workspaceId, input.db ?? prisma);
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
  db?: BillingDbClient;
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
