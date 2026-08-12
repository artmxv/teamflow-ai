import { randomUUID } from "node:crypto";
import { Prisma, type BillingPlan, type BillingPaymentStatus } from "@prisma/client";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { AuthError } from "./auth.service.js";
import {
  compareBillingPlans,
  getPlanAmountValue,
  isPaidSelfServicePlan,
  lockUserWorkspaceUsage,
  lockWorkspaceBillingUsage,
  resolveOwnerBillingPlan,
  setOwnedWorkspacesPlan,
  syncOwnedWorkspacesToOwnerPlan,
  type PaidSelfServicePlan,
} from "./billing-plans.service.js";
import type { WorkspaceRole } from "./workspace-context.service.js";

const YOOKASSA_API = "https://api.yookassa.ru/v3";
/** Total provider-call deadline, shared by the initial attempt and one transient retry. */
export const YOOKASSA_REQUEST_TIMEOUT_MS = 15_000;
const YOOKASSA_MAX_ATTEMPTS = 2;

export type YooKassaAmount = {
  value: string;
  currency: string;
};

export type YooKassaPaymentObject = {
  id: string;
  status: string;
  paid?: boolean;
  amount: YooKassaAmount;
  test?: boolean;
  metadata?: Record<string, string>;
  confirmation?: {
    type?: string;
    confirmation_url?: string;
  };
};

export type YooKassaNotification = {
  type?: string;
  event?: string;
  object?: YooKassaPaymentObject;
};

export type BillingPlanChangeResult =
  | {
      flow: "PAYMENT";
      confirmationUrl: string;
      paymentId: string;
    }
  | {
      flow: "APPLIED";
      currentPlan: BillingPlan;
    };

export type BillingPaymentConfirmationResult = {
  paymentId: string;
  status: BillingPaymentStatus;
  currentPlan: BillingPlan;
};

type YooKassaRequestInput = {
  method: "GET" | "POST";
  path: string;
  body?: Record<string, unknown>;
  idempotenceKey?: string;
};

function throwPaymentProviderUnavailable(): never {
  throw new AuthError(
    "Payment provider is temporarily unavailable",
    503,
    "PAYMENT_PROVIDER_UNAVAILABLE",
  );
}

function assertYooKassaPaymentMode(providerPayment: YooKassaPaymentObject): void {
  const matchesMode =
    env.YOOKASSA_MODE === "test" ? providerPayment.test === true : providerPayment.test === false;
  if (!matchesMode) {
    throw new AuthError(
      "Payment mode does not match billing configuration",
      502,
      "YOOKASSA_MODE_MISMATCH",
    );
  }
}

async function yookassaRequest(input: YooKassaRequestInput): Promise<YooKassaPaymentObject> {
  if (!env.YOOKASSA_SHOP_ID || !env.YOOKASSA_SECRET_KEY) {
    throw new AuthError("YooKassa billing is not configured", 503, "BILLING_NOT_CONFIGURED");
  }

  const headers: Record<string, string> = {
    Authorization: `Basic ${Buffer.from(`${env.YOOKASSA_SHOP_ID}:${env.YOOKASSA_SECRET_KEY}`).toString("base64")}`,
    "Content-Type": "application/json",
  };
  if (input.method === "POST") {
    headers["Idempotence-Key"] = input.idempotenceKey ?? randomUUID();
  }

  const deadline = Date.now() + YOOKASSA_REQUEST_TIMEOUT_MS;
  for (let attempt = 1; attempt <= YOOKASSA_MAX_ATTEMPTS; attempt += 1) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throwPaymentProviderUnavailable();
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), remainingMs);

    let response: Response;
    try {
      try {
        response = await fetch(`${YOOKASSA_API}${input.path}`, {
          method: input.method,
          headers,
          body: input.body ? JSON.stringify(input.body) : undefined,
          signal: controller.signal,
        });
      } catch {
        if (attempt < YOOKASSA_MAX_ATTEMPTS && Date.now() < deadline) {
          continue;
        }
        throwPaymentProviderUnavailable();
      }

      let rawBody: string;
      try {
        rawBody = await response.text();
      } catch {
        if (attempt < YOOKASSA_MAX_ATTEMPTS && Date.now() < deadline) {
          continue;
        }
        throwPaymentProviderUnavailable();
      }

      if (!response.ok && response.status >= 500) {
        if (attempt < YOOKASSA_MAX_ATTEMPTS && Date.now() < deadline) {
          continue;
        }
        throwPaymentProviderUnavailable();
      }

      let payload: YooKassaPaymentObject & { code?: string };
      try {
        payload = (rawBody ? JSON.parse(rawBody) : {}) as YooKassaPaymentObject & {
          code?: string;
        };
      } catch {
        throw new AuthError(
          "Payment provider returned an invalid response",
          502,
          "PAYMENT_PROVIDER_UNAVAILABLE",
        );
      }

      if (!response.ok) {
        throw new AuthError("YooKassa request failed", 502, "YOOKASSA_ERROR");
      }
      return payload;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throwPaymentProviderUnavailable();
}

/** Test seam: unit tests replace this boundary instead of calling YooKassa. */
export const yookassaBillingGateway = {
  request: yookassaRequest,
};

export function isYooKassaBillingConfigured(): boolean {
  return Boolean(env.YOOKASSA_SHOP_ID && env.YOOKASSA_SECRET_KEY);
}

function assertOwner(role: WorkspaceRole): void {
  if (role !== "OWNER") {
    throw new AuthError("Only workspace owners can manage billing", 403, "BILLING_OWNER_REQUIRED");
  }
}

function assertYooKassaBillingConfigured(): void {
  if (!isYooKassaBillingConfigured()) {
    throw new AuthError("YooKassa billing is not configured", 503, "BILLING_NOT_CONFIGURED");
  }
}

function billingReturnUrl(paymentId: string): string {
  const base = env.YOOKASSA_RETURN_URL?.trim() || `${env.APP_URL}/app/billing`;
  const url = new URL(base);
  url.searchParams.set("billing", "return");
  url.searchParams.set("paymentId", paymentId);
  return url.toString();
}

function mapProviderStatus(status: string): BillingPaymentStatus | null {
  if (status === "succeeded") return "SUCCEEDED";
  if (status === "canceled") return "CANCELED";
  if (status === "pending" || status === "waiting_for_capture") return "PENDING";
  return null;
}

function amountsMatch(expectedValue: string, actual: YooKassaAmount | undefined): boolean {
  if (!actual || actual.currency !== "RUB") {
    return false;
  }
  const expected = Number(expectedValue);
  const got = Number(actual.value);
  return Number.isFinite(expected) && Number.isFinite(got) && expected === got;
}

async function applySucceededPayment(input: {
  paymentRecordId: string;
  targetPlan: PaidSelfServicePlan;
  providerPaymentId: string;
  ownerUserId: string;
}): Promise<BillingPaymentConfirmationResult> {
  return prisma.$transaction(async (tx) => {
    const source = await tx.billingPayment.findUnique({
      where: { id: input.paymentRecordId },
      select: { workspaceId: true },
    });
    if (source?.workspaceId) {
      await lockWorkspaceBillingUsage(tx, source.workspaceId);
    }
    await lockUserWorkspaceUsage(tx, input.ownerUserId);

    const payment = await tx.billingPayment.findUnique({
      where: { id: input.paymentRecordId },
      select: {
        id: true,
        workspaceId: true,
        targetPlan: true,
        status: true,
        amount: true,
        currency: true,
        providerPaymentId: true,
        ownerUserId: true,
      },
    });
    if (!payment || payment.ownerUserId !== input.ownerUserId) {
      throw new AuthError("Billing payment not found", 404, "PAYMENT_NOT_FOUND");
    }
    if (payment.status === "SUCCEEDED") {
      return {
        paymentId: payment.id,
        status: "SUCCEEDED",
        currentPlan: await resolveOwnerBillingPlan(payment.ownerUserId, tx),
      };
    }
    if (payment.status === "CANCELED") {
      throw new AuthError("Payment was canceled", 409, "PAYMENT_CANCELED");
    }
    if (payment.targetPlan !== input.targetPlan || !isPaidSelfServicePlan(payment.targetPlan)) {
      throw new AuthError("Payment metadata mismatch", 409, "PAYMENT_METADATA_MISMATCH");
    }

    const completedAt = new Date();
    await tx.billingPayment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCEEDED",
        providerPaymentId: input.providerPaymentId,
        completedAt,
      },
    });

    await setOwnedWorkspacesPlan(payment.ownerUserId, payment.targetPlan, tx);

    return {
      paymentId: payment.id,
      status: "SUCCEEDED",
      currentPlan: payment.targetPlan,
    };
  });
}

async function markPaymentCanceled(
  paymentRecordId: string,
): Promise<BillingPaymentConfirmationResult> {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.billingPayment.findUnique({
      where: { id: paymentRecordId },
      select: {
        id: true,
        ownerUserId: true,
        status: true,
      },
    });
    if (!payment) {
      throw new AuthError("Billing payment not found", 404, "PAYMENT_NOT_FOUND");
    }
    if (payment.status !== "SUCCEEDED") {
      await tx.billingPayment.update({
        where: { id: payment.id },
        data: {
          status: "CANCELED",
          completedAt: new Date(),
        },
      });
    }
    return {
      paymentId: payment.id,
      status: payment.status === "SUCCEEDED" ? "SUCCEEDED" : "CANCELED",
      currentPlan: await resolveOwnerBillingPlan(payment.ownerUserId, tx),
    };
  });
}

/**
 * Confirms a payment using the authoritative YooKassa Payment object (never trust webhook body alone).
 */
export async function confirmProviderPayment(
  providerPayment: YooKassaPaymentObject,
  expectedPaymentRecordId?: string,
): Promise<BillingPaymentConfirmationResult | null> {
  const metadataPaymentId = providerPayment.metadata?.paymentId;
  const metadataWorkspaceId = providerPayment.metadata?.workspaceId;
  const metadataTargetPlan = providerPayment.metadata?.targetPlan;
  const metadataOwnerUserId = providerPayment.metadata?.ownerUserId;

  const payment =
    (expectedPaymentRecordId
      ? await prisma.billingPayment.findUnique({ where: { id: expectedPaymentRecordId } })
      : null) ??
    (providerPayment.id
      ? await prisma.billingPayment.findFirst({
          where: { providerPaymentId: providerPayment.id },
        })
      : null) ??
    (metadataPaymentId
      ? await prisma.billingPayment.findUnique({ where: { id: metadataPaymentId } })
      : null);

  if (!payment) {
    return null;
  }

  if (payment.providerPaymentId && payment.providerPaymentId !== providerPayment.id) {
    throw new AuthError("Payment provider id mismatch", 409, "PAYMENT_METADATA_MISMATCH");
  }

  assertYooKassaPaymentMode(providerPayment);

  if (metadataPaymentId !== payment.id) {
    throw new AuthError("Payment metadata mismatch", 409, "PAYMENT_METADATA_MISMATCH");
  }
  if (payment.workspaceId && metadataWorkspaceId !== payment.workspaceId) {
    throw new AuthError("Payment metadata mismatch", 409, "PAYMENT_METADATA_MISMATCH");
  }
  if (metadataTargetPlan !== payment.targetPlan || metadataOwnerUserId !== payment.ownerUserId) {
    throw new AuthError("Payment metadata mismatch", 409, "PAYMENT_METADATA_MISMATCH");
  }

  const expectedAmount = isPaidSelfServicePlan(payment.targetPlan)
    ? getPlanAmountValue(payment.targetPlan)
    : null;
  if (
    !expectedAmount ||
    !amountsMatch(expectedAmount, providerPayment.amount) ||
    payment.currency !== "RUB" ||
    Number(payment.amount) !== Number(expectedAmount)
  ) {
    throw new AuthError("Payment amount mismatch", 409, "PAYMENT_AMOUNT_MISMATCH");
  }

  const mapped = mapProviderStatus(providerPayment.status);
  if (!mapped) {
    throw new AuthError("Payment provider returned an unsupported status", 502, "YOOKASSA_ERROR");
  }

  if (!payment.providerPaymentId) {
    await prisma.billingPayment.update({
      where: { id: payment.id },
      data: { providerPaymentId: providerPayment.id },
    });
  }

  if (mapped === "SUCCEEDED") {
    if (!isPaidSelfServicePlan(payment.targetPlan)) {
      throw new AuthError("Payment target plan is invalid", 409, "PAYMENT_METADATA_MISMATCH");
    }
    return applySucceededPayment({
      paymentRecordId: payment.id,
      targetPlan: payment.targetPlan,
      providerPaymentId: providerPayment.id,
      ownerUserId: payment.ownerUserId,
    });
  }
  if (mapped === "CANCELED") {
    return markPaymentCanceled(payment.id);
  }

  return {
    paymentId: payment.id,
    status: payment.status,
    currentPlan: await resolveOwnerBillingPlan(payment.ownerUserId),
  };
}

export async function fetchAndConfirmProviderPayment(
  providerPaymentId: string,
  expectedPaymentRecordId?: string,
): Promise<BillingPaymentConfirmationResult | null> {
  const providerPayment = await yookassaBillingGateway.request({
    method: "GET",
    path: `/payments/${encodeURIComponent(providerPaymentId)}`,
  });
  return confirmProviderPayment(providerPayment, expectedPaymentRecordId);
}

export async function confirmBillingPayment(input: {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  paymentId: string;
}): Promise<BillingPaymentConfirmationResult> {
  assertOwner(input.role);

  const payment = await prisma.billingPayment.findFirst({
    where: {
      id: input.paymentId,
      ownerUserId: input.userId,
    },
  });
  if (!payment) {
    throw new AuthError("Billing payment not found", 404, "PAYMENT_NOT_FOUND");
  }

  if (payment.status === "SUCCEEDED") {
    return {
      paymentId: payment.id,
      status: "SUCCEEDED",
      currentPlan: await resolveOwnerBillingPlan(payment.ownerUserId),
    };
  }

  if (payment.status === "CANCELED") {
    return {
      paymentId: payment.id,
      status: "CANCELED",
      currentPlan: await resolveOwnerBillingPlan(payment.ownerUserId),
    };
  }

  if (!payment.providerPaymentId) {
    throw new AuthError("Payment is not linked to YooKassa yet", 409, "PAYMENT_NOT_READY");
  }

  const result = await fetchAndConfirmProviderPayment(payment.providerPaymentId, payment.id);
  if (!result) {
    throw new AuthError("Billing payment not found", 404, "PAYMENT_NOT_FOUND");
  }
  return result;
}

export async function handleYooKassaNotification(
  notification: YooKassaNotification,
): Promise<void> {
  const event = notification.event;
  if (event !== "payment.succeeded" && event !== "payment.canceled") {
    return;
  }

  const objectId = notification.object?.id;
  if (!objectId) {
    return;
  }

  let payment = await prisma.billingPayment.findUnique({
    where: { providerPaymentId: objectId },
  });

  if (!payment) {
    const metadata = notification.object?.metadata;
    const metadataPaymentId = metadata?.paymentId;
    if (!metadataPaymentId) {
      return;
    }
    const candidate = await prisma.billingPayment.findFirst({
      where: {
        id: metadataPaymentId,
        status: "PENDING",
      },
    });
    if (
      !candidate ||
      metadata?.ownerUserId !== candidate.ownerUserId ||
      metadata?.targetPlan !== candidate.targetPlan ||
      (candidate.workspaceId && metadata?.workspaceId !== candidate.workspaceId)
    ) {
      return;
    }
    payment = candidate;
  }

  // The body only selects an existing local record. All payment data is verified after GET.
  await fetchAndConfirmProviderPayment(objectId, payment.id);
}

export async function createBillingPlanChangeSession(input: {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  targetPlan: BillingPlan;
}): Promise<BillingPlanChangeResult> {
  assertOwner(input.role);

  // Keep owner workspaces aligned before comparing / applying a plan change.
  const currentPlan = await syncOwnedWorkspacesToOwnerPlan(input.userId);

  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { plan: true, name: true },
  });
  if (!workspace) {
    throw new AuthError("Workspace not found", 404);
  }

  if (currentPlan === input.targetPlan || workspace.plan === input.targetPlan) {
    throw new AuthError("This is already the current plan", 409, "PLAN_ALREADY_CURRENT");
  }

  // Free downgrade is an entitlement change, not a purchase. Existing data is preserved;
  // plan limits only block subsequent workspace/member growth.
  // Any paid target (upgrade or paid→paid change) requires YooKassa SUCCEEDED first.
  if (input.targetPlan === "FREE") {
    if (compareBillingPlans(input.targetPlan, currentPlan) >= 0) {
      throw new AuthError("This is already the current plan", 409, "PLAN_ALREADY_CURRENT");
    }

    await prisma.$transaction(async (tx) => {
      await lockWorkspaceBillingUsage(tx, input.workspaceId);
      await lockUserWorkspaceUsage(tx, input.userId);

      const ownerPlan = await resolveOwnerBillingPlan(input.userId, tx);
      if (ownerPlan === "FREE") {
        throw new AuthError("This is already the current plan", 409, "PLAN_ALREADY_CURRENT");
      }

      await setOwnedWorkspacesPlan(input.userId, "FREE", tx);
    });
    return { flow: "APPLIED", currentPlan: "FREE" };
  }

  if (!isPaidSelfServicePlan(input.targetPlan)) {
    throw new AuthError(
      "This plan is not available through self-service billing",
      400,
      "PLAN_NOT_SELF_SERVICE",
    );
  }

  assertYooKassaBillingConfigured();

  const amountValue = getPlanAmountValue(input.targetPlan);
  const payment = await prisma.billingPayment.create({
    data: {
      workspaceId: input.workspaceId,
      ownerUserId: input.userId,
      provider: "YOOKASSA",
      targetPlan: input.targetPlan,
      amount: new Prisma.Decimal(amountValue),
      currency: "RUB",
      status: "PENDING",
    },
  });

  let providerPayment: YooKassaPaymentObject;
  try {
    providerPayment = await yookassaBillingGateway.request({
      method: "POST",
      path: "/payments",
      idempotenceKey: payment.id,
      body: {
        amount: {
          value: amountValue,
          currency: "RUB",
        },
        capture: true,
        confirmation: {
          type: "redirect",
          return_url: billingReturnUrl(payment.id),
        },
        description: `TeamFlow ${input.targetPlan} plan · ${workspace.name}`,
        metadata: {
          workspaceId: input.workspaceId,
          targetPlan: input.targetPlan,
          paymentId: payment.id,
          ownerUserId: input.userId,
        },
      },
    });

    // Link provider id only. Never activate a paid plan from create-session alone —
    // even if the POST body claims "succeeded". Activation is confirm-payment / webhook
    // after authoritative provider verification.
    assertYooKassaPaymentMode(providerPayment);
    if (providerPayment.id) {
      await prisma.billingPayment.update({
        where: { id: payment.id },
        data: { providerPaymentId: providerPayment.id },
      });
    }
  } catch (error) {
    if (error instanceof AuthError && error.code !== "PAYMENT_PROVIDER_UNAVAILABLE") {
      await prisma.billingPayment.update({
        where: { id: payment.id },
        data: { status: "CANCELED", completedAt: new Date() },
      });
    }
    throw error;
  }

  const confirmationUrl = providerPayment.confirmation?.confirmation_url;
  if (!confirmationUrl || !providerPayment.id) {
    await prisma.billingPayment.update({
      where: { id: payment.id },
      data: { status: "CANCELED", completedAt: new Date() },
    });
    throw new AuthError("YooKassa confirmation URL was not returned", 502, "YOOKASSA_ERROR");
  }

  return {
    flow: "PAYMENT",
    confirmationUrl,
    paymentId: payment.id,
  };
}
