import { apiRequest } from "./client";

export type BillingPlanId = "FREE" | "TEAM" | "BUSINESS" | "ENTERPRISE";
export type BillingPlanAction = "CURRENT" | "SELECT" | "CONTACT" | "UNAVAILABLE";
export type BillingPlanUnavailableReason =
  | "PAYMENT_PROVIDER_NOT_CONFIGURED"
  | "WORKSPACE_LIMIT_EXCEEDED"
  | "MEMBER_LIMIT_EXCEEDED"
  | "OWNER_ONLY";

export const BILLING_SUMMARY_QUERY_KEY = ["billing", "summary"] as const;

export interface BillingSummary {
  currentPlan: BillingPlanId;
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
    id: BillingPlanId;
    label: string;
    maxMembers: number | null;
    maxWorkspaces: number | null;
    isCurrent: boolean;
    monthlyPriceRub: number | null;
    currency: "RUB";
    action: BillingPlanAction;
    unavailableReason: BillingPlanUnavailableReason | null;
  }>;
}

export type BillingPlanChangeResult =
  | {
      flow: "PAYMENT";
      confirmationUrl: string;
      paymentId: string;
    }
  | {
      flow: "APPLIED";
      currentPlan: BillingPlanId;
    };

export type BillingPaymentConfirmation = {
  paymentId: string;
  status: "PENDING" | "SUCCEEDED" | "CANCELED";
  currentPlan: BillingPlanId;
};

export async function createBillingPlanChange(
  plan: BillingPlanId,
): Promise<BillingPlanChangeResult> {
  const response = await apiRequest<{ data: BillingPlanChangeResult }>("/api/billing/change-plan", {
    method: "POST",
    body: { plan },
  });
  return response.data;
}

export async function confirmBillingPayment(
  paymentId: string,
): Promise<BillingPaymentConfirmation> {
  const response = await apiRequest<{ data: BillingPaymentConfirmation }>(
    "/api/billing/confirm-payment",
    {
      method: "POST",
      body: { paymentId },
    },
  );
  return response.data;
}

export async function fetchBillingSummary(): Promise<BillingSummary> {
  const response = await apiRequest<{ data: BillingSummary }>("/api/billing/summary");
  return response.data;
}
