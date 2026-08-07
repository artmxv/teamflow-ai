import type { BillingPlan } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { AuthError } from "./auth.service.js";
import {
  getBillingPlanConfig,
  getBillingPlans,
  getWorkspaceMemberUsage,
  getWorkspaceOwnerWorkspaceUsage,
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

function getUsageBlockReason(input: {
  targetPlan: BillingPlan;
  seatsUsed: number;
  workspacesUsed: number;
}): BillingPlanUnavailableReason | null {
  const { limits } = getBillingPlanConfig(input.targetPlan);

  if (limits.maxMembers !== null && input.seatsUsed > limits.maxMembers) {
    return "MEMBER_LIMIT_EXCEEDED";
  }
  if (limits.maxWorkspaces !== null && input.workspacesUsed > limits.maxWorkspaces) {
    return "WORKSPACE_LIMIT_EXCEEDED";
  }
  return null;
}

/** Plan action matrix for the billing summary UI. Enterprise is contact-only as a TARGET. */
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

  // Enterprise is never self-service as a destination. Leaving Enterprise is allowed.
  if (input.targetPlan === "ENTERPRISE") {
    return { action: "CONTACT", unavailableReason: null };
  }

  const usageBlock = getUsageBlockReason({
    targetPlan: input.targetPlan,
    seatsUsed: input.seatsUsed,
    workspacesUsed: input.workspacesUsed,
  });
  if (usageBlock) {
    return { action: "UNAVAILABLE", unavailableReason: usageBlock };
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

  const currentConfig = getBillingPlanConfig(workspace.plan);
  const billingConfigured = isYooKassaBillingConfigured();
  const canManageBilling = role === "OWNER";
  const [memberUsage, workspaces] = await Promise.all([
    getWorkspaceMemberUsage(workspaceId),
    getWorkspaceOwnerWorkspaceUsage(workspaceId),
  ]);
  const seatsUsed = memberUsage.members + memberUsage.pendingInvitations;

  return {
    currentPlan: workspace.plan,
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
        currentPlan: workspace.plan,
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
        isCurrent: plan.id === workspace.plan,
        monthlyPriceRub: plan.monthlyPriceRub,
        currency: "RUB" as const,
        action,
        unavailableReason,
      };
    }),
  };
}
