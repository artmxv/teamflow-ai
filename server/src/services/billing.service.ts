import type { BillingPlan } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { AuthError } from "./auth.service.js";
import {
  getBillingPlanConfig,
  getBillingPlans,
  getWorkspaceMemberUsage,
  getWorkspaceOwnerWorkspaceUsage,
  resolveOwnerBillingPlan,
} from "./billing-plans.service.js";
import { isYooKassaBillingConfigured } from "./yookassa-billing.service.js";
import type { WorkspaceRole } from "./workspace-context.service.js";

export type BillingPlanAction = "CURRENT" | "SELECT" | "CONTACT" | "UNAVAILABLE";

export type BillingPlanUnavailableReason =
  | "PAYMENT_PROVIDER_NOT_CONFIGURED"
  | "WORKSPACE_LIMIT_EXCEEDED"
  | "MEMBER_LIMIT_EXCEEDED"
  | "OWNER_ONLY";

export type BillingSummaryDto = {
  currentPlan: BillingPlan;
  planLabel: string;
  currency: "RUB";
  limits: {
    maxMembers: number | null;
    maxWorkspaces: number | null;
  };
  usage: {
    members: number;
    pendingInvitations: number;
    workspaces: number;
  };
  billingConfigured: boolean;
  canManageBilling: boolean;
  testMode: boolean;
  plans: Array<{
    id: BillingPlan;
    label: string;
    maxMembers: number | null;
    maxWorkspaces: number | null;
    isCurrent: boolean;
    monthlyPriceRub: number | null;
    currency: "RUB";
    action: BillingPlanAction;
    unavailableReason: BillingPlanUnavailableReason | null;
  }>;
};

type PlanActionResult = {
  action: BillingPlanAction;
  unavailableReason: BillingPlanUnavailableReason | null;
};

/**
 * Plan action matrix for the billing summary UI.
 * V1 keeps this simple: no usage-based UNAVAILABLE / prepare-downgrade UX.
 * Limits still apply when creating workspaces or inviting members.
 */
export function getPlanAction(input: {
  currentPlan: BillingPlan;
  targetPlan: BillingPlan;
  billingConfigured: boolean;
  canManageBilling: boolean;
  seatsUsed: number;
  workspacesUsed: number;
}): PlanActionResult {
  if (input.targetPlan === input.currentPlan) {
    return { action: "CURRENT", unavailableReason: null };
  }

  // Free downgrade does not need YooKassa.
  if (input.targetPlan === "FREE") {
    if (!input.canManageBilling) {
      return { action: "UNAVAILABLE", unavailableReason: "OWNER_ONLY" };
    }
    return { action: "SELECT", unavailableReason: null };
  }

  if (!input.billingConfigured) {
    return { action: "UNAVAILABLE", unavailableReason: "PAYMENT_PROVIDER_NOT_CONFIGURED" };
  }

  if (!input.canManageBilling) {
    return { action: "UNAVAILABLE", unavailableReason: "OWNER_ONLY" };
  }

  return { action: "SELECT", unavailableReason: null };
}

export async function getBillingSummary(
  workspaceId: string,
  role: WorkspaceRole,
  userId?: string,
): Promise<BillingSummaryDto> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      plan: true,
    },
  });

  if (!workspace) {
    throw new AuthError("Workspace not found", 404);
  }

  const canManageBilling = role === "OWNER";
  // Owner-scoped + read-only: never write from GET. Resolve the owner's plan without healing DB.
  const currentPlan =
    canManageBilling && userId ? await resolveOwnerBillingPlan(userId) : workspace.plan;

  const currentConfig = getBillingPlanConfig(currentPlan);
  const billingConfigured = isYooKassaBillingConfigured();
  const [memberUsage, workspaces] = await Promise.all([
    getWorkspaceMemberUsage(workspaceId),
    getWorkspaceOwnerWorkspaceUsage(workspaceId),
  ]);
  const seatsUsed = memberUsage.members + memberUsage.pendingInvitations;

  return {
    currentPlan,
    planLabel: currentConfig.label,
    currency: "RUB",
    limits: currentConfig.limits,
    usage: {
      members: memberUsage.members,
      pendingInvitations: memberUsage.pendingInvitations,
      workspaces,
    },
    billingConfigured,
    canManageBilling,
    testMode: true,
    plans: getBillingPlans().map((plan) => {
      const { action, unavailableReason } = getPlanAction({
        currentPlan,
        targetPlan: plan.id,
        billingConfigured,
        canManageBilling,
        seatsUsed,
        workspacesUsed: workspaces,
      });

      return {
        id: plan.id,
        label: plan.label,
        maxMembers: plan.limits.maxMembers,
        maxWorkspaces: plan.limits.maxWorkspaces,
        isCurrent: plan.id === currentPlan,
        monthlyPriceRub: plan.monthlyPriceRub,
        currency: "RUB" as const,
        action,
        unavailableReason,
      };
    }),
  };
}
