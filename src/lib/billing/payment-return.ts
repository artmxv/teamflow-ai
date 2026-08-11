import { ApiError } from "@/lib/api/client";
import { isTransientApiError } from "@/lib/api-error";
import {
  parseBillingReturnSearch,
  stripBillingReturnSearchParams,
} from "@/lib/billing/billing-return-search";

export {
  decideConfirmPaymentPoll,
  parseBillingReturnSearch,
  stripBillingReturnSearchParams,
  type BillingReturnSearch,
  type ConfirmPaymentPollDecision,
} from "@/lib/billing/billing-return-search";

/** Survives AppShell remounts and early query-param cleanup after YooKassa return. */
export const BILLING_RETURN_PAYMENT_ID_KEY = "teamflow.billing.returnPaymentId";

export const BILLING_CONFIRM_POLL_INTERVAL_MS = 2_000;
export const BILLING_CONFIRM_POLL_TIMEOUT_MS = 60_000;

export function getPendingBillingPaymentId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const value = window.sessionStorage.getItem(BILLING_RETURN_PAYMENT_ID_KEY);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function persistPendingBillingPaymentId(paymentId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(BILLING_RETURN_PAYMENT_ID_KEY, paymentId);
  } catch {
    // Private mode / quota — confirm flow can still use in-memory state on this mount.
  }
}

export function clearPendingBillingPaymentId(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.removeItem(BILLING_RETURN_PAYMENT_ID_KEY);
  } catch {
    // ignore
  }
}

/**
 * Read paymentId from the YooKassa return URL and stash it before anything clears search params.
 * Returns the paymentId to confirm, or null when this is not an active return.
 */
export function syncBillingReturnPaymentIdFromUrl(
  search: string | URLSearchParams = typeof window !== "undefined" ? window.location.search : "",
): string | null {
  const parsed = parseBillingReturnSearch(search);
  if (parsed.kind === "cancelled") {
    clearPendingBillingPaymentId();
    return null;
  }
  if (parsed.kind === "return" && parsed.paymentId) {
    persistPendingBillingPaymentId(parsed.paymentId);
    return parsed.paymentId;
  }
  if (parsed.kind === "return") {
    return getPendingBillingPaymentId();
  }
  // Normal billing visits can resume a stashed return (idempotent confirm).
  return getPendingBillingPaymentId();
}

/** True while returning from YooKassa (URL and/or stashed paymentId). */
export function hasBillingPaymentReturn(
  search: string | URLSearchParams = typeof window !== "undefined" ? window.location.search : "",
): boolean {
  const parsed = parseBillingReturnSearch(search);
  if (parsed.kind === "return") {
    return Boolean(parsed.paymentId || getPendingBillingPaymentId());
  }
  return Boolean(getPendingBillingPaymentId());
}

/** Strip billing/paymentId/plan from the URL without a full reload. */
export function clearBillingReturnQueryParams(
  href: string = typeof window !== "undefined" ? window.location.href : "",
): string {
  const next = stripBillingReturnSearchParams(
    href,
    typeof window !== "undefined" ? window.location.origin : "http://local",
  );
  if (typeof window !== "undefined") {
    window.history.replaceState(window.history.state, "", next);
  }
  return next;
}

/** Soft failures while YooKassa/webhook may still be catching up. */
export function shouldRetryConfirmPaymentError(error: unknown): boolean {
  if (isTransientApiError(error)) {
    return true;
  }
  return error instanceof ApiError && error.code === "PAYMENT_NOT_READY";
}
