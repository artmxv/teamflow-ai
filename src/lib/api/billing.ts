import { apiRequest } from "./client";

export type BillingPlanId = "FREE" | "TEAM" | "BUSINESS" | "ENTERPRISE";

export interface BillingSummary {
  currentPlan: BillingPlanId;
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
    id: BillingPlanId;
    label: string;
    maxMembers: number | null;
    maxWorkspaces: number | null;
    isCurrent: boolean;
  }>;
}

export async function fetchBillingSummary(): Promise<BillingSummary> {
  const response = await apiRequest<{ data: BillingSummary }>("/api/billing/summary");
  return response.data;
}

export async function updateBillingPlan(plan: BillingPlanId): Promise<BillingSummary> {
  const response = await apiRequest<{ data: BillingSummary }>("/api/billing/plan", {
    method: "PATCH",
    body: { plan },
  });
  return response.data;
}
