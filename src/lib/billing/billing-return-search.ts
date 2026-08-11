export type BillingReturnSearch =
  | { kind: "none" }
  | { kind: "cancelled" }
  | { kind: "return"; paymentId: string | null }
  | { kind: "other"; billing: string };

type ConfirmablePayment = {
  status: "PENDING" | "SUCCEEDED" | "CANCELED";
  currentPlan: "FREE" | "TEAM" | "BUSINESS" | "ENTERPRISE";
};

export type ConfirmPaymentPollDecision =
  | { action: "succeeded"; currentPlan: ConfirmablePayment["currentPlan"] }
  | { action: "canceled" }
  | { action: "retry" };

export function parseBillingReturnSearch(
  search: string | URLSearchParams,
): BillingReturnSearch {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const billing = params.get("billing");
  if (!billing) {
    return { kind: "none" };
  }
  if (billing === "cancelled") {
    return { kind: "cancelled" };
  }
  if (billing === "return") {
    const paymentId = params.get("paymentId");
    return { kind: "return", paymentId: paymentId && paymentId.length > 0 ? paymentId : null };
  }
  return { kind: "other", billing };
}

/** Pure URL cleanup used by the billing return flow (no window side effects). */
export function stripBillingReturnSearchParams(href: string, base = "http://local"): string {
  const url = new URL(href, base);
  url.searchParams.delete("billing");
  url.searchParams.delete("paymentId");
  url.searchParams.delete("plan");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function decideConfirmPaymentPoll(
  confirmation: ConfirmablePayment,
): ConfirmPaymentPollDecision {
  if (confirmation.status === "SUCCEEDED") {
    return { action: "succeeded", currentPlan: confirmation.currentPlan };
  }
  if (confirmation.status === "CANCELED") {
    return { action: "canceled" };
  }
  return { action: "retry" };
}
