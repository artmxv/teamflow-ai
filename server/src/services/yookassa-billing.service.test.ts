import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { Prisma } from "@prisma/client";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { AuthError } from "./auth.service.js";
import { assertPlanUsageWithinLimits, getPlanAmountValue } from "./billing-plans.service.js";
import {
  confirmBillingPayment,
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
  mode: env.YOOKASSA_MODE,
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
    env.YOOKASSA_MODE = "test";
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
    env.YOOKASSA_MODE = "test";
    await prisma.workspace.deleteMany({
      where: {
        slug: { startsWith: `yookassa-extra-${suffix}-` },
      },
    });
    await prisma.billingPayment.deleteMany({ where: { ownerUserId: ownerId } });
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
    env.YOOKASSA_MODE = originalYooKassaConfig.mode;

    await prisma.billingPayment.deleteMany({
      where: {
        ownerUserId: ownerId,
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
    assert.equal(payment.ownerUserId, ownerId);
    assert.equal(yookassaRequests[0]?.idempotenceKey, payment.id);

    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { plan: true },
    });
    assert.equal(workspace.plan, "FREE");
  });

  it("does not activate a paid plan from create even when provider returns succeeded", async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: "FREE" },
    });
    yookassaBillingGateway.request = async (input) => {
      yookassaRequests.push(input);
      const metadata = (input.body?.metadata ?? {}) as Record<string, string>;
      return {
        id: `yk_${suffix}_immediate_success`,
        status: "succeeded",
        paid: true,
        amount: { value: "990.00", currency: "RUB" },
        test: true,
        metadata,
        confirmation: {
          type: "redirect",
          confirmation_url: `https://yoomoney.ru/checkout/payments/v2/contract?orderId=yk_${suffix}_immediate_success`,
        },
      };
    };

    const result = await createBillingPlanChangeSession({
      userId: ownerId,
      workspaceId,
      role: "OWNER",
      targetPlan: "TEAM",
    });

    assert.equal(result.flow, "PAYMENT");
    if (result.flow !== "PAYMENT") return;
    assert.match(result.confirmationUrl, /yoomoney\.ru/);
    const payment = await prisma.billingPayment.findFirstOrThrow({
      where: { ownerUserId: ownerId },
      orderBy: { createdAt: "desc" },
    });
    assert.equal(payment.status, "PENDING");
    assert.equal(payment.providerPaymentId, `yk_${suffix}_immediate_success`);
    assert.equal(
      (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).plan,
      "FREE",
    );
    assert.equal(yookassaRequests.length, 1);
  });

  it("rejects paid create without confirmation URL and leaves plan unchanged", async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: "FREE" },
    });
    yookassaBillingGateway.request = async (input) => {
      yookassaRequests.push(input);
      const metadata = (input.body?.metadata ?? {}) as Record<string, string>;
      return {
        id: `yk_${suffix}_no_redirect`,
        status: "succeeded",
        paid: true,
        amount: { value: "990.00", currency: "RUB" },
        test: true,
        metadata,
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
        assert.equal(error.code, "YOOKASSA_ERROR");
        return true;
      },
    );

    assert.equal(
      (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).plan,
      "FREE",
    );
    const payment = await prisma.billingPayment.findFirstOrThrow({
      where: { ownerUserId: ownerId },
      orderBy: { createdAt: "desc" },
    });
    assert.equal(payment.status, "CANCELED");
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

  it("rejects the current plan without creating a payment", async () => {
    await assert.rejects(
      () =>
        createBillingPlanChangeSession({
          userId: ownerId,
          workspaceId,
          role: "OWNER",
          targetPlan: "BUSINESS",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.code, "PLAN_ALREADY_CURRENT");
        return true;
      },
    );
    assert.equal(yookassaRequests.length, 0);
    assert.equal(await prisma.billingPayment.count({ where: { ownerUserId: ownerId } }), 0);
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

  it("requires YooKassa payment for Enterprise -> Business (paid target)", async () => {
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
    assert.equal(yookassaRequests.length, 1);
    assert.deepEqual(yookassaRequests[0]?.body?.amount, {
      value: "2490.00",
      currency: "RUB",
    });
    assert.equal(
      (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).plan,
      "ENTERPRISE",
    );
  });

  it("requires YooKassa payment for Enterprise -> Team (paid target)", async () => {
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
    assert.equal(yookassaRequests.length, 1);
    assert.equal(
      (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).plan,
      "ENTERPRISE",
    );
  });

  it("allows Enterprise -> Free even when owner has more than one workspace", async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: "ENTERPRISE" },
    });
    await addOwnedWorkspaces(1);

    const result = await createBillingPlanChangeSession({
      userId: ownerId,
      workspaceId,
      role: "OWNER",
      targetPlan: "FREE",
    });

    assert.deepEqual(result, { flow: "APPLIED", currentPlan: "FREE" });
    assert.equal(yookassaRequests.length, 0);

    const owned = await prisma.workspaceMember.findMany({
      where: { userId: ownerId, role: "OWNER", status: "ACTIVE" },
      select: { workspace: { select: { plan: true } } },
    });
    assert.ok(owned.length >= 2);
    assert.ok(owned.every((row) => row.workspace.plan === "FREE"));
  });

  it("creates an Enterprise payment for Business -> Enterprise", async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: "BUSINESS" },
    });

    const result = await createBillingPlanChangeSession({
      userId: ownerId,
      workspaceId,
      role: "OWNER",
      targetPlan: "ENTERPRISE",
    });

    assert.equal(result.flow, "PAYMENT");
    assert.deepEqual(yookassaRequests[0]?.body?.amount, {
      value: "4990.00",
      currency: "RUB",
    });
  });

  it("requires YooKassa for Business -> Team and does not activate on create", async () => {
    await addActiveMembers(8);

    const result = await createBillingPlanChangeSession({
      userId: ownerId,
      workspaceId,
      role: "OWNER",
      targetPlan: "TEAM",
    });

    assert.equal(result.flow, "PAYMENT");
    assert.equal(yookassaRequests.length, 1);
    assert.equal(
      (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).plan,
      "BUSINESS",
    );
  });

  it("applies Free even when active members exceed Free seat limit", async () => {
    await addActiveMembers(4);

    const result = await createBillingPlanChangeSession({
      userId: ownerId,
      workspaceId,
      role: "OWNER",
      targetPlan: "FREE",
    });

    assert.deepEqual(result, { flow: "APPLIED", currentPlan: "FREE" });
    assert.equal(yookassaRequests.length, 0);
  });

  it("applies Free even when pending invitations exceed Free seat limit", async () => {
    await addPendingInvitations(3);

    const result = await createBillingPlanChangeSession({
      userId: ownerId,
      workspaceId,
      role: "OWNER",
      targetPlan: "FREE",
    });

    assert.deepEqual(result, { flow: "APPLIED", currentPlan: "FREE" });
  });

  it("applies Free across all owned workspaces when owner exceeds Free workspace limit", async () => {
    await addOwnedWorkspaces(1);

    const result = await createBillingPlanChangeSession({
      userId: ownerId,
      workspaceId,
      role: "OWNER",
      targetPlan: "FREE",
    });

    assert.deepEqual(result, { flow: "APPLIED", currentPlan: "FREE" });
    const owned = await prisma.workspaceMember.findMany({
      where: { userId: ownerId, role: "OWNER", status: "ACTIVE" },
      select: { workspace: { select: { plan: true } } },
    });
    assert.ok(owned.every((row) => row.workspace.plan === "FREE"));
  });

  it("serializes Free downgrade and workspace create with billing locks", async () => {
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

    // Locks still serialize both paths; Free may already own multiple workspaces in V1.
    assert.equal(results.filter((result) => result.status === "fulfilled").length >= 1, true);
    assert.ok(plan === "FREE" || plan === "BUSINESS");
    if (plan === "BUSINESS") {
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
        assert.equal(error.code, "YOOKASSA_MODE_MISMATCH");
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
        ownerUserId: ownerId,
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
            ownerUserId: ownerId,
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.code, "YOOKASSA_MODE_MISMATCH");
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

  it("accepts live payments only when YOOKASSA_MODE=live", async () => {
    env.YOOKASSA_MODE = "live";
    await prisma.workspace.update({ where: { id: workspaceId }, data: { plan: "FREE" } });
    yookassaBillingGateway.request = async (input) => {
      yookassaRequests.push(input);
      const metadata = (input.body?.metadata ?? {}) as Record<string, string>;
      return {
        id: `yk_live_enabled_${suffix}`,
        status: "pending",
        amount: { value: "990.00", currency: "RUB" },
        test: false,
        metadata,
        confirmation: {
          type: "redirect",
          confirmation_url: "https://yoomoney.ru/checkout/live",
        },
      };
    };

    const result = await createBillingPlanChangeSession({
      userId: ownerId,
      workspaceId,
      role: "OWNER",
      targetPlan: "TEAM",
    });
    assert.equal(result.flow, "PAYMENT");
  });

  it("rejects test payments when YOOKASSA_MODE=live", async () => {
    env.YOOKASSA_MODE = "live";
    await prisma.workspace.update({ where: { id: workspaceId }, data: { plan: "FREE" } });

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
        assert.equal(error.code, "YOOKASSA_MODE_MISMATCH");
        return true;
      },
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
        ownerUserId: ownerId,
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
            ownerUserId: ownerId,
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

  it("activates the plan after a succeeded payment across all owned workspaces", async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: "FREE" },
    });
    await addOwnedWorkspaces(1);

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
        ownerUserId: ownerId,
      },
    });

    await handleYooKassaNotification({
      event: "payment.succeeded",
      object: { id: providerId, status: "succeeded", amount: { value: "1.00", currency: "RUB" } },
    });

    const owned = await prisma.workspaceMember.findMany({
      where: { userId: ownerId, role: "OWNER", status: "ACTIVE" },
      select: { workspace: { select: { plan: true } } },
    });
    assert.ok(owned.length >= 2);
    assert.ok(owned.every((row) => row.workspace.plan === "TEAM"));

    const first = await prisma.billingPayment.findUniqueOrThrow({ where: { id: payment.id } });
    assert.equal(first.status, "SUCCEEDED");

    await handleYooKassaNotification({
      event: "payment.succeeded",
      object: { id: providerId, status: "succeeded", amount: { value: "990.00", currency: "RUB" } },
    });
    const second = await prisma.billingPayment.findUniqueOrThrow({ where: { id: payment.id } });
    assert.equal(second.status, "SUCCEEDED");
    assert.ok(
      (
        await prisma.workspaceMember.findMany({
          where: { userId: ownerId, role: "OWNER", status: "ACTIVE" },
          select: { workspace: { select: { plan: true } } },
        })
      ).every((row) => row.workspace.plan === "TEAM"),
    );
  });

  it("does not let a forged return or another owner activate a pending payment", async () => {
    await prisma.workspace.update({ where: { id: workspaceId }, data: { plan: "FREE" } });
    const created = await createBillingPlanChangeSession({
      userId: ownerId,
      workspaceId,
      role: "OWNER",
      targetPlan: "TEAM",
    });
    assert.equal(created.flow, "PAYMENT");
    if (created.flow !== "PAYMENT") return;

    const pending = await confirmBillingPayment({
      userId: ownerId,
      workspaceId,
      role: "OWNER",
      paymentId: created.paymentId,
    });
    assert.equal(pending.status, "PENDING");
    assert.equal(
      (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).plan,
      "FREE",
    );

    await assert.rejects(
      () =>
        confirmBillingPayment({
          userId: adminId,
          workspaceId,
          role: "OWNER",
          paymentId: created.paymentId,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.code, "PAYMENT_NOT_FOUND");
        return true;
      },
    );
  });

  it("ignores an unrelated webhook without a provider request", async () => {
    await handleYooKassaNotification({
      event: "payment.succeeded",
      object: {
        id: `unknown_${suffix}`,
        status: "succeeded",
        amount: { value: "990.00", currency: "RUB" },
        metadata: { paymentId: `missing_${suffix}` },
      },
    });
    assert.equal(yookassaRequests.length, 0);
  });

  it("recovers an unknown provider id through verified pending-payment metadata", async () => {
    await prisma.workspace.update({ where: { id: workspaceId }, data: { plan: "FREE" } });
    const local = await prisma.billingPayment.create({
      data: {
        workspaceId,
        ownerUserId: ownerId,
        targetPlan: "TEAM",
        amount: new Prisma.Decimal("990.00"),
        currency: "RUB",
      },
    });
    const providerId = `yk_recovered_${suffix}`;
    const metadata = {
      paymentId: local.id,
      workspaceId,
      ownerUserId: ownerId,
      targetPlan: "TEAM",
    };
    providerPayments.set(providerId, {
      id: providerId,
      status: "succeeded",
      amount: { value: "990.00", currency: "RUB" },
      test: true,
      metadata,
    });

    await handleYooKassaNotification({
      event: "payment.succeeded",
      object: {
        id: providerId,
        status: "succeeded",
        amount: { value: "1.00", currency: "RUB" },
        metadata,
      },
    });

    const recovered = await prisma.billingPayment.findUniqueOrThrow({ where: { id: local.id } });
    assert.equal(recovered.providerPaymentId, providerId);
    assert.equal(recovered.status, "SUCCEEDED");
    assert.equal(yookassaRequests.filter((request) => request.method === "GET").length, 1);
  });

  it("preserves a payment after source workspace deletion and completes for its stored owner", async () => {
    await prisma.workspace.update({ where: { id: workspaceId }, data: { plan: "FREE" } });
    const source = await prisma.workspace.create({
      data: {
        name: "Disposable billing source",
        slug: `yookassa-extra-${suffix}-disposable-source`,
        plan: "FREE",
        members: { create: { userId: ownerId, role: "OWNER", status: "ACTIVE" } },
      },
    });
    const local = await prisma.billingPayment.create({
      data: {
        workspaceId: source.id,
        ownerUserId: ownerId,
        providerPaymentId: `yk_deleted_source_${suffix}`,
        targetPlan: "TEAM",
        amount: new Prisma.Decimal("990.00"),
        currency: "RUB",
      },
    });
    await prisma.workspace.delete({ where: { id: source.id } });
    assert.equal(
      (await prisma.billingPayment.findUniqueOrThrow({ where: { id: local.id } })).workspaceId,
      null,
    );

    await confirmProviderPayment({
      id: local.providerPaymentId!,
      status: "succeeded",
      amount: { value: "990.00", currency: "RUB" },
      test: true,
      metadata: {
        paymentId: local.id,
        workspaceId: source.id,
        ownerUserId: ownerId,
        targetPlan: "TEAM",
      },
    });
    assert.equal(
      (await prisma.billingPayment.findUniqueOrThrow({ where: { id: local.id } })).status,
      "SUCCEEDED",
    );
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
        ownerUserId: ownerId,
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
            ownerUserId: ownerId,
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

  it("rejects currency and entitlement-owner metadata mismatches", async () => {
    const local = await prisma.billingPayment.create({
      data: {
        workspaceId,
        ownerUserId: ownerId,
        providerPaymentId: `yk_currency_${suffix}`,
        targetPlan: "TEAM",
        amount: new Prisma.Decimal("990.00"),
        currency: "RUB",
      },
    });
    const base = {
      id: local.providerPaymentId!,
      status: "succeeded",
      test: true,
      metadata: {
        workspaceId,
        targetPlan: "TEAM",
        paymentId: local.id,
        ownerUserId: ownerId,
      },
    };

    await assert.rejects(
      () => confirmProviderPayment({ ...base, amount: { value: "990.00", currency: "USD" } }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.code, "PAYMENT_AMOUNT_MISMATCH");
        return true;
      },
    );
    await assert.rejects(
      () =>
        confirmProviderPayment({
          ...base,
          amount: { value: "990.00", currency: "RUB" },
          metadata: { ...base.metadata, ownerUserId: adminId },
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.code, "PAYMENT_METADATA_MISMATCH");
        return true;
      },
    );
    assert.equal(
      (await prisma.billingPayment.findUniqueOrThrow({ where: { id: local.id } })).status,
      "PENDING",
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
        ownerUserId: ownerId,
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
            ownerUserId: ownerId,
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
        ownerUserId: ownerId,
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

  it("keeps plan unchanged while payment stays PENDING", async () => {
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

    const pending = await confirmBillingPayment({
      userId: ownerId,
      workspaceId,
      role: "OWNER",
      paymentId: created.paymentId,
    });
    assert.equal(pending.status, "PENDING");
    assert.equal(pending.currentPlan, "FREE");
    assert.equal(
      (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).plan,
      "FREE",
    );
  });

  it("activates a paid plan exactly once on SUCCEEDED and stays idempotent on reconfirm", async () => {
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
        ownerUserId: ownerId,
      },
    });

    const first = await confirmBillingPayment({
      userId: ownerId,
      workspaceId,
      role: "OWNER",
      paymentId: created.paymentId,
    });
    assert.equal(first.status, "SUCCEEDED");
    assert.equal(first.currentPlan, "TEAM");
    assert.equal(
      (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).plan,
      "TEAM",
    );

    const second = await confirmBillingPayment({
      userId: ownerId,
      workspaceId,
      role: "OWNER",
      paymentId: created.paymentId,
    });
    assert.equal(second.status, "SUCCEEDED");
    assert.equal(second.currentPlan, "TEAM");
    assert.equal(await prisma.billingPayment.count({ where: { id: payment.id } }), 1);
    assert.equal(
      (await prisma.billingPayment.findUniqueOrThrow({ where: { id: payment.id } })).status,
      "SUCCEEDED",
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
    let attempts = 0;
    globalThis.fetch = (async () => {
      attempts += 1;
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
    assert.equal(attempts, 2);
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
        assert.equal(error.message, "YooKassa request failed");
        assert.ok(!String(error.message).includes("Invalid request"));
        assert.ok(!String(error.message).includes("secret_test"));
        return true;
      },
    );
  });

  it("retries a 5xx once with the exact same Idempotence-Key", async () => {
    const keys: Array<string | null> = [];
    globalThis.fetch = (async (_url, init) => {
      keys.push(new Headers(init?.headers).get("Idempotence-Key"));
      if (keys.length === 1) {
        return new Response(JSON.stringify({ description: "temporary" }), { status: 503 });
      }
      return new Response(
        JSON.stringify({
          id: "yk_retry_success",
          status: "pending",
          amount: { value: "990.00", currency: "RUB" },
          test: true,
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    await yookassaBillingGateway.request({
      method: "POST",
      path: "/payments",
      idempotenceKey: "local-payment-id",
      body: { amount: { value: "990.00", currency: "RUB" } },
    });
    assert.deepEqual(keys, ["local-payment-id", "local-payment-id"]);
  });
});
