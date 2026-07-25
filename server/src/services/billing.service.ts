import type { BillingPlan } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { AuthError } from "./auth.service.js";
import {
  countUserWorkspaces,
  getBillingPlanConfig,
  getBillingPlans,
  getWorkspaceMemberUsage,
} from "./billing-plans.service.js";
import type { WorkspaceRole } from "./workspace-context.service.js";

export const BILLING_NOT_AVAILABLE_CODE = "BILLING_NOT_AVAILABLE";
export const BILLING_NOT_AVAILABLE_MESSAGE =
  "Online billing and plan changes are not available yet.";

export type BillingSummaryDto = {
  currentPlan: BillingPlan;
  planLabel: string;
  limits: {
    maxMembers: number | null;
    maxWorkspaces: number | null;
  };
  usage: {
    members: number;
    pendingInvitations: number;
    workspaces: number;
  };
  plans: Array<{
    id: BillingPlan;
    label: string;
    maxMembers: number | null;
    maxWorkspaces: number | null;
    isCurrent: boolean;
  }>;
};

export async function getBillingSummary(
  userId: string,
  workspaceId: string,
): Promise<BillingSummaryDto> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true },
  });

  if (!workspace) {
    throw new AuthError("Workspace not found", 404);
  }

  const currentConfig = getBillingPlanConfig(workspace.plan);
  const [memberUsage, workspaces] = await Promise.all([
    getWorkspaceMemberUsage(workspaceId),
    countUserWorkspaces(userId),
  ]);

  return {
    currentPlan: workspace.plan,
    planLabel: currentConfig.label,
    limits: currentConfig.limits,
    usage: {
      members: memberUsage.members,
      pendingInvitations: memberUsage.pendingInvitations,
      workspaces,
    },
    plans: getBillingPlans().map((plan) => ({
      id: plan.id,
      label: plan.label,
      maxMembers: plan.limits.maxMembers,
      maxWorkspaces: plan.limits.maxWorkspaces,
      isCurrent: plan.id === workspace.plan,
    })),
  };
}

export async function updateWorkspaceBillingPlan(input: {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  plan: BillingPlan;
}): Promise<BillingSummaryDto> {
  if (input.role !== "OWNER") {
    throw new AuthError("Only workspace owners can change the billing plan", 403);
  }

  // Keep endpoint for API compatibility; do not accept paid plan switches yet.
  void input.plan;
  throw new AuthError(BILLING_NOT_AVAILABLE_MESSAGE, 503, BILLING_NOT_AVAILABLE_CODE);
}
