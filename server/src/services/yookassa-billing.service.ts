import { randomUUID } from "node:crypto";
import { Prisma, type BillingPlan, type BillingPaymentStatus } from "@prisma/client";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { AuthError } from "./auth.service.js";
import {
  assertPlanUsageWithinLimits,
  getPlanAmountValue,
  isBillingPlanDowngrade,
  isPaidSelfServicePlan,
  lockWorkspaceBillingUsage,
  lockWorkspaceOwnerUsage,
  type PaidSelfServicePlan,
} from "./billing-plans.service.js";
import type { WorkspaceRole } from "./workspace-context.service.js";

const YOOKASSA_API = "https://api.yookassa.ru/v3";
/** Provider HTTP timeout for create/GET Payment calls (V1 test billing). */
export const YOOKASSA_REQUEST_TIMEOUT_MS = 15_000;

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

function assertYooKassaTestPayment(providerPayment: YooKassaPaymentObject): void {
  if (providerPayment.test !== true) {
    throw new AuthError(
      "Only YooKassa test payments are accepted in V1",
      502,
      "YOOKASSA_TEST_MODE_REQUIRED",
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), YOOKASSA_REQUEST_TIMEOUT_MS);

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
      // Network / DNS / connect timeout / AbortError — never leak credentials.
      throwPaymentProviderUnavailable();
    }

    let rawBody: string;
    try {
      rawBody = await response.text();
    } catch {
      throwPaymentProviderUnavailable();
    }

    let payload: YooKassaPaymentObject & { description?: string; code?: string };
    try {
      payload = (rawBody ? JSON.parse(rawBody) : {}) as YooKassaPaymentObject & {
        description?: string;
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
      const description =
        typeof payload.description === "string" && payload.description.trim()
          ? payload.description
          : "YooKassa request failed";
      throw new AuthError(description, 502, "YOOKASSA_ERROR");
    }
    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
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
  workspaceId: string;
  targetPlan: PaidSelfServicePlan;
  providerPaymentId: string;
}): Promise<BillingPaymentConfirmationResult> {
  return prisma.$transaction(async (tx) => {
    await lockWorkspaceBillingUsage(tx, input.workspaceId);

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
      },
    });
    if (!payment || payment.workspaceId !== input.workspaceId) {
      throw new AuthError("Billing payment not found", 404, "PAYMENT_NOT_FOUND");
    }
    if (payment.status === "SUCCEEDED") {
      const workspace = await tx.workspace.findUniqueOrThrow({
        where: { id: input.workspaceId },
        select: { plan: true },
      });
      return {
        paymentId: payment.id,
        status: "SUCCEEDED",
        currentPlan: workspace.plan,
      };
    }
    if (payment.status === "CANCELED") {
      throw new AuthError("Payment was canceled", 409, "PAYMENT_CANCELED");
    }
    if (payment.targetPlan !== input.targetPlan || !isPaidSelfServicePlan(payment.targetPlan)) {
      throw new AuthError("Payment metadata mismatch", 409, "PAYMENT_METADATA_MISMATCH");
    }

    const workspace = await tx.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { plan: true },
    });
    if (!workspace) {
      throw new AuthError("Workspace not found", 404);
    }

    if (
      payment.targetPlan !== workspace.plan &&
      isBillingPlanDowngrade(workspace.plan, payment.targetPlan)
    ) {
      await lockWorkspaceOwnerUsage(tx, input.workspaceId);
      await assertPlanUsageWithinLimits({
        workspaceId: input.workspaceId,
        targetPlan: payment.targetPlan,
        db: tx,
      });
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
    await tx.workspace.update({
      where: { id: input.workspaceId },
      data: { plan: payment.targetPlan },
    });

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
        workspaceId: true,
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
    const workspace = await tx.workspace.findUniqueOrThrow({
      where: { id: payment.workspaceId },
      select: { plan: true },
    });
    return {
      paymentId: payment.id,
      status: payment.status === "SUCCEEDED" ? "SUCCEEDED" : "CANCELED",
      currentPlan: workspace.plan,
    };
  });
}

/**
 * Confirms a payment using the authoritative YooKassa Payment object (never trust webhook body alone).
 */
export async function confirmProviderPayment(
  providerPayment: YooKassaPaymentObject,
): Promise<BillingPaymentConfirmationResult | null> {
  const metadataPaymentId = providerPayment.metadata?.paymentId;
  const metadataWorkspaceId = providerPayment.metadata?.workspaceId;
  const metadataTargetPlan = providerPayment.metadata?.targetPlan;

  const payment =
    (metadataPaymentId
      ? await prisma.billingPayment.findUnique({ where: { id: metadataPaymentId } })
      : null) ??
    (providerPayment.id
      ? await prisma.billingPayment.findFirst({
          where: { providerPaymentId: providerPayment.id },
        })
      : null);

  if (!payment) {
    return null;
  }

  if (payment.providerPaymentId && payment.providerPaymentId !== providerPayment.id) {
    throw new AuthError("Payment provider id mismatch", 409, "PAYMENT_METADATA_MISMATCH");
  }

  assertYooKassaTestPayment(providerPayment);

  if (metadataWorkspaceId && metadataWorkspaceId !== payment.workspaceId) {
    throw new AuthError("Payment metadata mismatch", 409, "PAYMENT_METADATA_MISMATCH");
  }
  if (metadataTargetPlan && metadataTargetPlan !== payment.targetPlan) {
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
  if (mapped === "SUCCEEDED") {
    if (!isPaidSelfServicePlan(payment.targetPlan)) {
      throw new AuthError("Payment target plan is invalid", 409, "PAYMENT_METADATA_MISMATCH");
    }
    return applySucceededPayment({
      paymentRecordId: payment.id,
      workspaceId: payment.workspaceId,
      targetPlan: payment.targetPlan,
      providerPaymentId: providerPayment.id,
    });
  }
  if (mapped === "CANCELED") {
    return markPaymentCanceled(payment.id);
  }

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: payment.workspaceId },
    select: { plan: true },
  });
  return {
    paymentId: payment.id,
    status: payment.status,
    currentPlan: workspace.plan,
  };
}

export async function fetchAndConfirmProviderPayment(
  providerPaymentId: string,
): Promise<BillingPaymentConfirmationResult | null> {
  const providerPayment = await yookassaBillingGateway.request({
    method: "GET",
    path: `/payments/${encodeURIComponent(providerPaymentId)}`,
  });
  return confirmProviderPayment(providerPayment);
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
      workspaceId: input.workspaceId,
    },
  });
  if (!payment) {
    throw new AuthError("Billing payment not found", 404, "PAYMENT_NOT_FOUND");
  }

  if (payment.status === "SUCCEEDED") {
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: input.workspaceId },
      select: { plan: true },
    });
    return {
      paymentId: payment.id,
      status: "SUCCEEDED",
      currentPlan: workspace.plan,
    };
  }

  if (!payment.providerPaymentId) {
    throw new AuthError("Payment is not linked to YooKassa yet", 409, "PAYMENT_NOT_READY");
  }

  const result = await fetchAndConfirmProviderPayment(payment.providerPaymentId);
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

  // Never trust notification body: re-fetch Payment from YooKassa with Basic Auth.
  await fetchAndConfirmProviderPayment(objectId);
}

export async function createBillingPlanChangeSession(input: {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  targetPlan: BillingPlan;
}): Promise<BillingPlanChangeResult> {
  assertOwner(input.role);
  if (input.targetPlan === "ENTERPRISE") {
    throw new AuthError(
      "Enterprise is not available through self-service billing",
      400,
      "PLAN_NOT_SELF_SERVICE",
    );
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { plan: true, name: true },
  });
  if (!workspace) {
    throw new AuthError("Workspace not found", 404);
  }

  if (workspace.plan === input.targetPlan) {
    throw new AuthError("This is already the current plan", 409, "PLAN_ALREADY_CURRENT");
  }

  // Leaving Enterprise via self-service is allowed (guards + payment still apply).
  // Entering Enterprise remains blocked above (targetPlan === ENTERPRISE).

  // Free does not require YooKassa in V1 (no recurring subscription to cancel).
  // Validate + apply inside one transaction so usage cannot race past the limits check.
  if (input.targetPlan === "FREE") {
    await prisma.$transaction(async (tx) => {
      await lockWorkspaceBillingUsage(tx, input.workspaceId);
      await lockWorkspaceOwnerUsage(tx, input.workspaceId);

      const current = await tx.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { plan: true },
      });
      if (!current) {
        throw new AuthError("Workspace not found", 404);
      }
      if (current.plan === "FREE") {
        throw new AuthError("This is already the current plan", 409, "PLAN_ALREADY_CURRENT");
      }

      await assertPlanUsageWithinLimits({
        workspaceId: input.workspaceId,
        targetPlan: "FREE",
        db: tx,
      });

      await tx.workspace.update({
        where: { id: input.workspaceId },
        data: { plan: "FREE" },
      });
    });
    return { flow: "APPLIED", currentPlan: "FREE" };
  }

  if (isBillingPlanDowngrade(workspace.plan, input.targetPlan)) {
    await prisma.$transaction(async (tx) => {
      await lockWorkspaceBillingUsage(tx, input.workspaceId);
      await lockWorkspaceOwnerUsage(tx, input.workspaceId);
      await assertPlanUsageWithinLimits({
        workspaceId: input.workspaceId,
        targetPlan: input.targetPlan,
        db: tx,
      });
    });
  }

  if (!isPaidSelfServicePlan(input.targetPlan)) {
    throw new AuthError(
      "Enterprise is not available through self-service billing",
      400,
      "PLAN_NOT_SELF_SERVICE",
    );
  }

  assertYooKassaBillingConfigured();

  const amountValue = getPlanAmountValue(input.targetPlan);
  const payment = await prisma.billingPayment.create({
    data: {
      workspaceId: input.workspaceId,
      provider: "YOOKASSA",
      targetPlan: input.targetPlan,
      amount: new Prisma.Decimal(amountValue),
      currency: "RUB",
      status: "PENDING",
    },
  });

  const idempotenceKey = randomUUID();
  const providerPayment = await yookassaBillingGateway.request({
    method: "POST",
    path: "/payments",
    idempotenceKey,
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
      },
    },
  });

  try {
    assertYooKassaTestPayment(providerPayment);
  } catch (error) {
    await prisma.billingPayment.update({
      where: { id: payment.id },
      data: { status: "CANCELED", completedAt: new Date() },
    });
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

  await prisma.billingPayment.update({
    where: { id: payment.id },
    data: { providerPaymentId: providerPayment.id },
  });

  return {
    flow: "PAYMENT",
    confirmationUrl,
    paymentId: payment.id,
  };
}
