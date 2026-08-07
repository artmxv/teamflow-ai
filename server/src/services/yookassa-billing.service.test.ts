import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { Prisma } from "@prisma/client";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { AuthError } from "./auth.service.js";
import {
  assertPlanUsageWithinLimits,
  BillingPlanUsageError,
  getPlanAmountValue,
  PLAN_MEMBER_LIMIT_EXCEEDED_CODE,
  PLAN_WORKSPACE_LIMIT_EXCEEDED_CODE,
} from "./billing-plans.service.js";
import {
  confirmProviderPayment,
  createBillingPlanChangeSession,
  handleYooKassaNotification,
  yookassaBillingGateway,
  type YooKassaPaymentObject,
} from "./yookassa-billing.service.js";
import { createWorkspaceForUser } from "./workspaces.service.js";

const suffix = randomBytes(4).toString("hex");
const testEmailSuffix = `.${suffix}@yookassa-billing-test.teamflow.local`;
const originalYooKassaConfig = {
  shopId: env.YOOKASSA_SHOP_ID,
  secretKey: env.YOOKASSA_SECRET_KEY,
  returnUrl: env.YOOKASSA_RETURN_URL,
};
const originalYooKassaRequest = yookassaBillingGateway.request;

type RecordedYooKassaRequest = {
  method: "GET" | "POST";
  path: string;
  body?: Record<string, unknown>;
  idempotenceKey?: string;
};

function email(label: string) {
  return `${label}${testEmailSuffix}`;
}

describe("yookassa-billing.service", () => {
  let workspaceId = "";
  let ownerId = "";
  let adminId = "";
  let memberId = "";
  let yookassaRequests: RecordedYooKassaRequest[] = [];
  let providerPayments = new Map<string, YooKassaPaymentObject>();

  before(async () => {
    env.YOOKASSA_SHOP_ID = "shop_test_teamflow";
    env.YOOKASSA_SECRET_KEY = "secret_test_teamflow";
    env.YOOKASSA_RETURN_URL = "http://localhost:5173/app/billing";

    const [owner, admin, member] = await Promise.all([
      prisma.user.create({
        data: { name: "YooKassa Owner", email: email("owner"), passwordHash: "test-hash" },
      }),
      prisma.user.create({
        data: { name: "YooKassa Admin", email: email("admin"), passwordHash: "test-hash" },
      }),
      prisma.user.create({
        data: { name: "YooKassa Member", email: email("member"), passwordHash: "test-hash" },
      }),
    ]);
    ownerId = owner.id;
    adminId = admin.id;
    memberId = member.id;

    const workspace = await prisma.workspace.create({
      data: {
        name: `YooKassa Billing ${suffix}`,
        slug: `yookassa-billing-${suffix}`,
        plan: "BUSINESS",
        members: {
          create: [
            { userId: ownerId, role: "OWNER", status: "ACTIVE" },
            { userId: adminId, role: "ADMIN", status: "ACTIVE" },
            { userId: memberId, role: "MEMBER", status: "ACTIVE" },
          ],
        },
      },
    });
    workspaceId = workspace.id;
  });

  beforeEach(async () => {
    await prisma.workspace.deleteMany({
      where: {
        slug: { startsWith: `yookassa-extra-${suffix}-` },
      },
    });
    await prisma.billingPayment.deleteMany({ where: { workspaceId } });
    await prisma.workspaceInvitation.deleteMany({ where: { workspaceId } });
    await prisma.workspaceMember.deleteMany({
      where: {
        workspaceId,
        userId: { notIn: [ownerId, adminId, memberId] },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: { endsWith: testEmailSuffix },
        id: { notIn: [ownerId, adminId, memberId] },
      },
    });
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: "BUSINESS" },
    });

    yookassaRequests = [];
    providerPayments = new Map();
    yookassaBillingGateway.request = async (input) => {
      yookassaRequests.push(input);
      if (input.method === "GET") {
        const id = input.path.replace("/payments/", "");
        const payment = providerPayments.get(id);
        if (!payment) {
          throw new AuthError("YooKassa payment not found", 502, "YOOKASSA_ERROR");
        }
        return payment;
      }

      const providerId = `yk_${suffix}_${yookassaRequests.length}`;
      const metadata = (input.body?.metadata ?? {}) as Record<string, string>;
      const amount = input.body?.amount as { value: string; currency: string };
      const payment: YooKassaPaymentObject = {
        id: providerId,
        status: "pending",
        amount,
        test: true,
        metadata,
        confirmation: {
          type: "redirect",
          confirmation_url: `https://yoomoney.ru/checkout/payments/v2/contract?orderId=${providerId}`,
        },
      };
      providerPayments.set(providerId, payment);
      return payment;
    };
  });

  after(async () => {
    yookassaBillingGateway.request = originalYooKassaRequest;
    env.YOOKASSA_SHOP_ID = originalYooKassaConfig.shopId;
    env.YOOKASSA_SECRET_KEY = originalYooKassaConfig.secretKey;
    env.YOOKASSA_RETURN_URL = originalYooKassaConfig.returnUrl;

    await prisma.billingPayment.deleteMany({
      where: {
        workspace: {
          OR: [{ id: workspaceId }, { slug: { startsWith: `yookassa-extra-${suffix}-` } }],
        },
      },
    });
    await prisma.workspace.deleteMany({
      where: {
        OR: [{ id: workspaceId }, { slug: { startsWith: `yookassa-extra-${suffix}-` } }],
      },
    });
    await prisma.user.deleteMany({
      where: { email: { endsWith: testEmailSuffix } },
    });
  });

  async function addActiveMembers(count: number) {
    for (let index = 0; index < count; index += 1) {
      const user = await prisma.user.create({
        data: {
          name: `YooKassa Filler ${index}`,
          email: email(`filler-${index}`),
          passwordHash: "test-hash",
        },
      });
      await prisma.workspaceMember.create({
        data: {
          workspaceId,
          userId: user.id,
          role: "MEMBER",
          status: "ACTIVE",
        },
      });
    }
  }

  async function addPendingInvitations(count: number) {
    for (let index = 0; index < count; index += 1) {
      await prisma.workspaceInvitation.create({
        data: {
          workspaceId,
          email: email(`pending-${index}`),
          role: "MEMBER",
          token: randomBytes(24).toString("base64url"),
          invitedById: ownerId,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
    }
  }

  async function addOwnedWorkspaces(count: number) {
    for (let index = 0; index < count; index += 1) {
      await prisma.workspace.create({
        data: {
          name: `YooKassa Extra ${index}`,
          slug: `yookassa-extra-${suffix}-${index}`,
          members: {
            create: {
              userId: ownerId,
              role: "OWNER",
              status: "ACTIVE",
            },
          },
        },
      });
    }
  }

  it("allows OWNER to create a Team payment with correct amount and Idempotence-Key", async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: "FREE" },
    });

    const result = await createBillingPlanChangeSession({
      userId: ownerId,
      workspaceId,
      role: "OWNER",
      targetPlan: "TEAM",
    });

    assert.equal(result.flow, "PAYMENT");
    if (result.flow !== "PAYMENT") return;
    assert.match(result.confirmationUrl, /yoomoney\.ru/);
    assert.equal(yookassaRequests.length, 1);
    assert.equal(yookassaRequests[0]?.method, "POST");
    assert.equal(yookassaRequests[0]?.path, "/payments");
    assert.ok(yookassaRequests[0]?.idempotenceKey);
    assert.deepEqual(yookassaRequests[0]?.body?.amount, {
      value: "990.00",
      currency: "RUB",
    });
    assert.equal(getPlanAmountValue("TEAM"), "990.00");
    assert.equal(getPlanAmountValue("BUSINESS"), "2490.00");

    const payment = await prisma.billingPayment.findUniqueOrThrow({
      where: { id: result.paymentId },
    });
    assert.equal(payment.status, "PENDING");
    assert.equal(payment.targetPlan, "TEAM");
    assert.equal(payment.currency, "RUB");
    assert.equal(Number(payment.amount), 990);
    assert.ok(payment.providerPaymentId);

    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { plan: true },
    });
    assert.equal(workspace.plan, "FREE");
  });

  it("rejects ADMIN plan changes before contacting YooKassa", async () => {
    await assert.rejects(
      () =>
        createBillingPlanChangeSession({
          userId: adminId,
          workspaceId,
          role: "ADMIN",
          targetPlan: "TEAM",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.statusCode, 403);
        assert.equal(error.code, "BILLING_OWNER_REQUIRED");
        return true;
      },
    );
    assert.equal(yookassaRequests.length, 0);
  });

  it("rejects MEMBER plan changes before contacting YooKassa", async () => {
    await assert.rejects(
      () =>
        createBillingPlanChangeSession({
          userId: memberId,
          workspaceId,
          role: "MEMBER",
          targetPlan: "TEAM",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.statusCode, 403);
        assert.equal(error.code, "BILLING_OWNER_REQUIRED");
        return true;
      },
    );
    assert.equal(yookassaRequests.length, 0);
  });

  it("applies paid -> Free without contacting YooKassa", async () => {
    const result = await createBillingPlanChangeSession({
      userId: ownerId,
      workspaceId,
      role: "OWNER",
      targetPlan: "FREE",
    });

    assert.deepEqual(result, { flow: "APPLIED", currentPlan: "FREE" });
    assert.equal(yookassaRequests.length, 0);
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { plan: true },
    });
    assert.equal(workspace.plan, "FREE");
  });

  it("creates a Business payment for Team -> Business", async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: "TEAM" },
    });

    const result = await createBillingPlanChangeSession({
      userId: ownerId,
      workspaceId,
      role: "OWNER",
      targetPlan: "BUSINESS",
    });

    assert.equal(result.flow, "PAYMENT");
    assert.deepEqual(yookassaRequests[0]?.body?.amount, {
      value: "2490.00",
      currency: "RUB",
    });
  });

  it("allows Enterprise -> Business via YooKassa self-service payment", async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: "ENTERPRISE" },
    });

    const result = await createBillingPlanChangeSession({
      userId: ownerId,
      workspaceId,
      role: "OWNER",
      targetPlan: "BUSINESS",
    });

    assert.equal(result.flow, "PAYMENT");
    assert.deepEqual(yookassaRequests[0]?.body?.amount, {
      value: "2490.00",
      currency: "RUB",
    });
    assert.equal(
      (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).plan,
      "ENTERPRISE",
    );
  });

  it("allows Enterprise -> Team when usage fits Team limits", async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: "ENTERPRISE" },
    });

    const result = await createBillingPlanChangeSession({
      userId: ownerId,
      workspaceId,
      role: "OWNER",
      targetPlan: "TEAM",
    });

    assert.equal(result.flow, "PAYMENT");
    assert.deepEqual(yookassaRequests[0]?.body?.amount, {
      value: "990.00",
      currency: "RUB",
    });
  });

  it("blocks Enterprise -> Free when owner workspace usage exceeds Free limit", async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: "ENTERPRISE" },
    });
    await addOwnedWorkspaces(1);

    await assert.rejects(
      () =>
        createBillingPlanChangeSession({
          userId: ownerId,
          workspaceId,
          role: "OWNER",
          targetPlan: "FREE",
        }),
      (error: unknown) => {
        assert.ok(error instanceof BillingPlanUsageError);
        assert.equal(error.code, PLAN_WORKSPACE_LIMIT_EXCEEDED_CODE);
        assert.deepEqual(error.details, { targetPlan: "FREE", used: 2, limit: 1 });
        return true;
      },
    );
    assert.equal(yookassaRequests.length, 0);
  });

  it("still rejects self-service transitions that target Enterprise", async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: "BUSINESS" },
    });

    await assert.rejects(
      () =>
        createBillingPlanChangeSession({
          userId: ownerId,
          workspaceId,
          role: "OWNER",
          targetPlan: "ENTERPRISE",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.code, "PLAN_NOT_SELF_SERVICE");
        return true;
      },
    );
    assert.equal(yookassaRequests.length, 0);
  });

  it("blocks Business -> Team when seats exceed Team limits before opening YooKassa", async () => {
    await addActiveMembers(8);

    await assert.rejects(
      () =>
        createBillingPlanChangeSession({
          userId: ownerId,
          workspaceId,
          role: "OWNER",
          targetPlan: "TEAM",
        }),
      (error: unknown) => {
        assert.ok(error instanceof BillingPlanUsageError);
        assert.equal(error.code, PLAN_MEMBER_LIMIT_EXCEEDED_CODE);
        assert.deepEqual(error.details, { targetPlan: "TEAM", used: 11, limit: 10 });
        return true;
      },
    );
    assert.equal(yookassaRequests.length, 0);
  });

  it("blocks downgrade when active members exceed the target seat limit", async () => {
    await addActiveMembers(4);

    await assert.rejects(
      () =>
        createBillingPlanChangeSession({
          userId: ownerId,
          workspaceId,
          role: "OWNER",
          targetPlan: "FREE",
        }),
      (error: unknown) => {
        assert.ok(error instanceof BillingPlanUsageError);
        assert.equal(error.code, PLAN_MEMBER_LIMIT_EXCEEDED_CODE);
        assert.deepEqual(error.details, { targetPlan: "FREE", used: 7, limit: 5 });
        return true;
      },
    );
    assert.equal(yookassaRequests.length, 0);
  });

  it("counts valid PENDING invitations as occupied seats during downgrade", async () => {
    await addPendingInvitations(3);

    await assert.rejects(
      () =>
        createBillingPlanChangeSession({
          userId: ownerId,
          workspaceId,
          role: "OWNER",
          targetPlan: "FREE",
        }),
      (error: unknown) => {
        assert.ok(error instanceof BillingPlanUsageError);
        assert.equal(error.code, PLAN_MEMBER_LIMIT_EXCEEDED_CODE);
        assert.deepEqual(error.details, { targetPlan: "FREE", used: 6, limit: 5 });
        return true;
      },
    );
  });

  it("blocks downgrade when the owner exceeds the target workspace limit", async () => {
    await addOwnedWorkspaces(1);

    await assert.rejects(
      () =>
        createBillingPlanChangeSession({
          userId: ownerId,
          workspaceId,
          role: "OWNER",
          targetPlan: "FREE",
        }),
      (error: unknown) => {
        assert.ok(error instanceof BillingPlanUsageError);
        assert.equal(error.code, PLAN_WORKSPACE_LIMIT_EXCEEDED_CODE);
        assert.deepEqual(error.details, { targetPlan: "FREE", used: 2, limit: 1 });
        return true;
      },
    );
  });

  it("applies Free downgrade atomically so concurrent usage cannot bypass Free limits", async () => {
    const results = await Promise.allSettled([
      createBillingPlanChangeSession({
        userId: ownerId,
        workspaceId,
        role: "OWNER",
        targetPlan: "FREE",
      }),
      createWorkspaceForUser({
        userId: ownerId,
        selectedWorkspaceId: workspaceId,
        data: {
          name: "Race Extra",
          slug: `yookassa-extra-${suffix}-race`,
        },
      }),
    ]);

    const ownedCount = await prisma.workspaceMember.count({
      where: { userId: ownerId, role: "OWNER", status: "ACTIVE" },
    });
    const plan = (
      await prisma.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: { plan: true },
      })
    ).plan;

    // Locks serialize the two billing paths: never Free with >1 owned workspace.
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    assert.ok(!(plan === "FREE" && ownedCount > 1));
    if (plan === "FREE") {
      assert.equal(ownedCount, 1);
    } else {
      assert.equal(plan, "BUSINESS");
      assert.equal(ownedCount, 2);
    }
  });

  it("rejects non-test YooKassa payments on create and does not return a confirmation URL", async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: "FREE" },
    });

    yookassaBillingGateway.request = async (input) => {
      yookassaRequests.push(input);
      return {
        id: `yk_live_${suffix}`,
        status: "pending",
        amount: { value: "990.00", currency: "RUB" },
        test: false,
        confirmation: {
          type: "redirect",
          confirmation_url: "https://yoomoney.ru/checkout/payments/v2/contract?orderId=live",
        },
        metadata: {},
      };
    };

    await assert.rejects(
      () =>
        createBillingPlanChangeSession({
          userId: ownerId,
          workspaceId,
          role: "OWNER",
          targetPlan: "TEAM",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.code, "YOOKASSA_TEST_MODE_REQUIRED");
        assert.equal(error.statusCode, 502);
        return true;
      },
    );

    const payments = await prisma.billingPayment.findMany({ where: { workspaceId } });
    assert.equal(payments.length, 1);
    assert.equal(payments[0]?.status, "CANCELED");
    assert.equal(payments[0]?.providerPaymentId, null);
    assert.equal(
      (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).plan,
      "FREE",
    );
  });

  it("rejects non-test YooKassa payments on confirmation and does not change the plan", async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: "FREE" },
    });
    const payment = await prisma.billingPayment.create({
      data: {
        workspaceId,
        provider: "YOOKASSA",
        providerPaymentId: `yk_live_confirm_${suffix}`,
        targetPlan: "TEAM",
        amount: new Prisma.Decimal("990.00"),
        currency: "RUB",
        status: "PENDING",
      },
    });

    await assert.rejects(
      () =>
        confirmProviderPayment({
          id: payment.providerPaymentId!,
          status: "succeeded",
          amount: { value: "990.00", currency: "RUB" },
          test: false,
          metadata: {
            workspaceId,
            targetPlan: "TEAM",
            paymentId: payment.id,
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.code, "YOOKASSA_TEST_MODE_REQUIRED");
        return true;
      },
    );

    assert.equal(
      (await prisma.billingPayment.findUniqueOrThrow({ where: { id: payment.id } })).status,
      "PENDING",
    );
    assert.equal(
      (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).plan,
      "FREE",
    );
  });

  it("rejects confirmation when providerPaymentId does not match the provider payment id", async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: "FREE" },
    });
    const payment = await prisma.billingPayment.create({
      data: {
        workspaceId,
        provider: "YOOKASSA",
        providerPaymentId: `yk_linked_${suffix}`,
        targetPlan: "TEAM",
        amount: new Prisma.Decimal("990.00"),
        currency: "RUB",
        status: "PENDING",
      },
    });

    await assert.rejects(
      () =>
        confirmProviderPayment({
          id: `yk_other_${suffix}`,
          status: "succeeded",
          amount: { value: "990.00", currency: "RUB" },
          test: true,
          metadata: {
            workspaceId,
            targetPlan: "TEAM",
            paymentId: payment.id,
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.code, "PAYMENT_METADATA_MISMATCH");
        assert.equal(error.statusCode, 409);
        return true;
      },
    );

    assert.equal(
      (await prisma.billingPayment.findUniqueOrThrow({ where: { id: payment.id } })).status,
      "PENDING",
    );
    assert.equal(
      (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).plan,
      "FREE",
    );
  });

  it("keeps Enterprise member and workspace usage unlimited", async () => {
    await addActiveMembers(4);
    await addPendingInvitations(3);
    await addOwnedWorkspaces(2);

    await assert.doesNotReject(() =>
      assertPlanUsageWithinLimits({
        workspaceId,
        targetPlan: "ENTERPRISE",
        ownerUserId: ownerId,
      }),
    );
  });

  it("activates the plan after a succeeded payment and stays idempotent", async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: "FREE" },
    });

    const created = await createBillingPlanChangeSession({
      userId: ownerId,
      workspaceId,
      role: "OWNER",
      targetPlan: "TEAM",
    });
    assert.equal(created.flow, "PAYMENT");
    if (created.flow !== "PAYMENT") return;

    const payment = await prisma.billingPayment.findUniqueOrThrow({
      where: { id: created.paymentId },
    });
    const providerId = payment.providerPaymentId!;
    providerPayments.set(providerId, {
      id: providerId,
      status: "succeeded",
      amount: { value: "990.00", currency: "RUB" },
      test: true,
      metadata: {
        workspaceId,
        targetPlan: "TEAM",
        paymentId: payment.id,
      },
    });

    await handleYooKassaNotification({
      event: "payment.succeeded",
      object: { id: providerId, status: "succeeded", amount: { value: "1.00", currency: "RUB" } },
    });

    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { plan: true },
    });
    assert.equal(workspace.plan, "TEAM");

    const first = await prisma.billingPayment.findUniqueOrThrow({ where: { id: payment.id } });
    assert.equal(first.status, "SUCCEEDED");

    await handleYooKassaNotification({
      event: "payment.succeeded",
      object: { id: providerId, status: "succeeded", amount: { value: "990.00", currency: "RUB" } },
    });
    const second = await prisma.billingPayment.findUniqueOrThrow({ where: { id: payment.id } });
    assert.equal(second.status, "SUCCEEDED");
    assert.equal(
      (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).plan,
      "TEAM",
    );
  });

  it("rejects forged mismatched amount and does not change the plan", async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: "FREE" },
    });
    const payment = await prisma.billingPayment.create({
      data: {
        workspaceId,
        provider: "YOOKASSA",
        providerPaymentId: `yk_forged_${suffix}`,
        targetPlan: "TEAM",
        amount: new Prisma.Decimal("990.00"),
        currency: "RUB",
        status: "PENDING",
      },
    });

    await assert.rejects(
      () =>
        confirmProviderPayment({
          id: payment.providerPaymentId!,
          status: "succeeded",
          amount: { value: "1.00", currency: "RUB" },
          test: true,
          metadata: {
            workspaceId,
            targetPlan: "TEAM",
            paymentId: payment.id,
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.code, "PAYMENT_AMOUNT_MISMATCH");
        return true;
      },
    );

    assert.equal(
      (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).plan,
      "FREE",
    );
  });

  it("rejects wrong workspace metadata and does not change the plan", async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: "FREE" },
    });
    const payment = await prisma.billingPayment.create({
      data: {
        workspaceId,
        provider: "YOOKASSA",
        providerPaymentId: `yk_meta_${suffix}`,
        targetPlan: "TEAM",
        amount: new Prisma.Decimal("990.00"),
        currency: "RUB",
        status: "PENDING",
      },
    });

    await assert.rejects(
      () =>
        confirmProviderPayment({
          id: payment.providerPaymentId!,
          status: "succeeded",
          amount: { value: "990.00", currency: "RUB" },
          test: true,
          metadata: {
            workspaceId: "other-workspace",
            targetPlan: "TEAM",
            paymentId: payment.id,
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.code, "PAYMENT_METADATA_MISMATCH");
        return true;
      },
    );
    assert.equal(
      (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).plan,
      "FREE",
    );
  });

  it("does not change the plan for a canceled payment", async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: "FREE" },
    });
    const created = await createBillingPlanChangeSession({
      userId: ownerId,
      workspaceId,
      role: "OWNER",
      targetPlan: "BUSINESS",
    });
    assert.equal(created.flow, "PAYMENT");
    if (created.flow !== "PAYMENT") return;

    const payment = await prisma.billingPayment.findUniqueOrThrow({
      where: { id: created.paymentId },
    });
    const providerId = payment.providerPaymentId!;
    providerPayments.set(providerId, {
      id: providerId,
      status: "canceled",
      amount: { value: "2490.00", currency: "RUB" },
      test: true,
      metadata: {
        workspaceId,
        targetPlan: "BUSINESS",
        paymentId: payment.id,
      },
    });

    await handleYooKassaNotification({
      event: "payment.canceled",
      object: { id: providerId, status: "canceled", amount: { value: "2490.00", currency: "RUB" } },
    });

    const updated = await prisma.billingPayment.findUniqueOrThrow({ where: { id: payment.id } });
    assert.equal(updated.status, "CANCELED");
    assert.equal(
      (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).plan,
      "FREE",
    );
  });
});

describe("yookassaRequest transport boundary", () => {
  const originalFetch = globalThis.fetch;

  before(() => {
    env.YOOKASSA_SHOP_ID = "shop_test_teamflow";
    env.YOOKASSA_SECRET_KEY = "secret_test_teamflow";
    yookassaBillingGateway.request = originalYooKassaRequest;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  after(() => {
    globalThis.fetch = originalFetch;
    yookassaBillingGateway.request = originalYooKassaRequest;
    env.YOOKASSA_SHOP_ID = originalYooKassaConfig.shopId;
    env.YOOKASSA_SECRET_KEY = originalYooKassaConfig.secretKey;
    env.YOOKASSA_RETURN_URL = originalYooKassaConfig.returnUrl;
  });

  it("maps network failures to PAYMENT_PROVIDER_UNAVAILABLE", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;

    await assert.rejects(
      () => yookassaBillingGateway.request({ method: "GET", path: "/payments/x" }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.code, "PAYMENT_PROVIDER_UNAVAILABLE");
        assert.equal(error.statusCode, 503);
        assert.ok(!String(error.message).includes("shop_test"));
        assert.ok(!String(error.message).includes("secret_test"));
        assert.ok(!String(error.message).toLowerCase().includes("authorization"));
        return true;
      },
    );
  });

  it("maps AbortError / timeout to PAYMENT_PROVIDER_UNAVAILABLE", async () => {
    globalThis.fetch = (async () => {
      const error = new Error("This operation was aborted");
      error.name = "AbortError";
      throw error;
    }) as typeof fetch;

    await assert.rejects(
      () => yookassaBillingGateway.request({ method: "GET", path: "/payments/x" }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.code, "PAYMENT_PROVIDER_UNAVAILABLE");
        assert.equal(error.statusCode, 503);
        return true;
      },
    );
  });

  it("maps invalid non-JSON provider responses to PAYMENT_PROVIDER_UNAVAILABLE", async () => {
    globalThis.fetch = (async () =>
      new Response("not-json-at-all", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      })) as typeof fetch;

    await assert.rejects(
      () => yookassaBillingGateway.request({ method: "GET", path: "/payments/x" }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.code, "PAYMENT_PROVIDER_UNAVAILABLE");
        assert.equal(error.statusCode, 502);
        return true;
      },
    );
  });

  it("keeps HTTP API failures as YOOKASSA_ERROR without leaking credentials", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ description: "Invalid request", code: "invalid_request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    await assert.rejects(
      () =>
        yookassaBillingGateway.request({
          method: "POST",
          path: "/payments",
          body: { amount: { value: "990.00", currency: "RUB" } },
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.code, "YOOKASSA_ERROR");
        assert.equal(error.statusCode, 502);
        assert.equal(error.message, "Invalid request");
        assert.ok(!String(error.message).includes("secret_test"));
        return true;
      },
    );
  });
});
