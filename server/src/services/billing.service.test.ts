import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { prisma } from "../lib/prisma.js";
import { planChangeSchema } from "../controllers/billing.controller.js";
import { env } from "../config/env.js";
import { getBillingPlanConfig, getBillingPlans } from "./billing-plans.service.js";
import { getBillingSummary, getPlanAction } from "./billing.service.js";

const suffix = randomBytes(4).toString("hex");

function email(label: string) {
  return `${label}.${suffix}@billing-test.teamflow.local`;
}

describe("billing.service", () => {
  let workspaceId = "";
  let ownerId = "";
  const userIds: string[] = [];
  const originalYooKassa = {
    shopId: env.YOOKASSA_SHOP_ID,
    secretKey: env.YOOKASSA_SECRET_KEY,
  };

  before(async () => {
    env.YOOKASSA_SHOP_ID = "shop_test_billing_summary";
    env.YOOKASSA_SECRET_KEY = "secret_test_billing_summary";

    const owner = await prisma.user.create({
      data: {
        name: "Billing Owner",
        email: email("owner"),
        passwordHash: "test-hash",
      },
    });
    const admin = await prisma.user.create({
      data: {
        name: "Billing Admin",
        email: email("admin"),
        passwordHash: "test-hash",
      },
    });
    const member = await prisma.user.create({
      data: {
        name: "Billing Member",
        email: email("member"),
        passwordHash: "test-hash",
      },
    });

    ownerId = owner.id;
    userIds.push(owner.id, admin.id, member.id);

    const workspace = await prisma.workspace.create({
      data: {
        name: `Billing Test ${suffix}`,
        slug: `billing-test-${suffix}`,
        plan: "FREE",
        members: {
          create: [
            { userId: owner.id, role: "OWNER", status: "ACTIVE" },
            { userId: admin.id, role: "ADMIN", status: "ACTIVE" },
            { userId: member.id, role: "MEMBER", status: "ACTIVE" },
          ],
        },
      },
    });
    workspaceId = workspace.id;
  });

  after(async () => {
    env.YOOKASSA_SHOP_ID = originalYooKassa.shopId;
    env.YOOKASSA_SECRET_KEY = originalYooKassa.secretKey;

    if (workspaceId) {
      await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
    }
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined);
    }
  });

  it("returns billing summary with real plan limits and usage", async () => {
    const summary = await getBillingSummary(workspaceId, "OWNER", ownerId);
    const freeConfig = getBillingPlanConfig("FREE");

    assert.equal(summary.currentPlan, "FREE");
    assert.equal(summary.limits.maxMembers, freeConfig.limits.maxMembers);
    assert.equal(summary.limits.maxWorkspaces, freeConfig.limits.maxWorkspaces);
    assert.equal(summary.usage.members, 3);
    assert.equal(summary.usage.pendingInvitations, 0);
    assert.equal(summary.usage.workspaces, 1);
    assert.equal(summary.canManageBilling, true);
    assert.equal(summary.billingConfigured, true);
    assert.equal(summary.plans.length, getBillingPlans().length);
    assert.ok(
      summary.plans.every((plan) => (plan.id === "FREE" ? plan.isCurrent : !plan.isCurrent)),
    );
    assert.deepEqual(
      summary.plans.map((plan) => ({
        id: plan.id,
        action: plan.action,
        reason: plan.unavailableReason,
      })),
      [
        { id: "FREE", action: "CURRENT", reason: null },
        { id: "TEAM", action: "SELECT", reason: null },
        { id: "BUSINESS", action: "SELECT", reason: null },
        { id: "ENTERPRISE", action: "SELECT", reason: null },
      ],
    );
  });

  it("returns the same plan catalog and usage to read-only roles", async () => {
    const invitation = await prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email: email("pending"),
        role: "MEMBER",
        token: randomBytes(24).toString("base64url"),
        invitedById: ownerId,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const summary = await getBillingSummary(workspaceId, "ADMIN");
    assert.equal(summary.canManageBilling, false);
    assert.equal(summary.usage.members, 3);
    assert.equal(summary.usage.pendingInvitations, 1);
    assert.deepEqual(
      summary.plans.map((plan) => ({
        id: plan.id,
        members: plan.maxMembers,
        workspaces: plan.maxWorkspaces,
        price: plan.monthlyPriceRub,
        currency: plan.currency,
      })),
      [
        { id: "FREE", members: 5, workspaces: 1, price: 0, currency: "RUB" },
        { id: "TEAM", members: 10, workspaces: 2, price: 990, currency: "RUB" },
        { id: "BUSINESS", members: 20, workspaces: 5, price: 2490, currency: "RUB" },
        { id: "ENTERPRISE", members: null, workspaces: null, price: 4990, currency: "RUB" },
      ],
    );
    assert.deepEqual(
      summary.plans.map((plan) => ({
        id: plan.id,
        action: plan.action,
        reason: plan.unavailableReason,
      })),
      [
        { id: "FREE", action: "CURRENT", reason: null },
        { id: "TEAM", action: "UNAVAILABLE", reason: "OWNER_ONLY" },
        { id: "BUSINESS", action: "UNAVAILABLE", reason: "OWNER_ONLY" },
        { id: "ENTERPRISE", action: "UNAVAILABLE", reason: "OWNER_ONLY" },
      ],
    );

    await prisma.workspaceInvitation.delete({ where: { id: invitation.id } });
  });

  it("keeps PLAN_CONFIG member and workspace limits unchanged", () => {
    assert.deepEqual(getBillingPlanConfig("FREE").limits, {
      maxMembers: 5,
      maxWorkspaces: 1,
    });
    assert.deepEqual(getBillingPlanConfig("TEAM").limits, {
      maxMembers: 10,
      maxWorkspaces: 2,
    });
    assert.deepEqual(getBillingPlanConfig("BUSINESS").limits, {
      maxMembers: 20,
      maxWorkspaces: 5,
    });
    assert.deepEqual(getBillingPlanConfig("ENTERPRISE").limits, {
      maxMembers: null,
      maxWorkspaces: null,
    });
    assert.equal(getBillingPlanConfig("ENTERPRISE").monthlyPriceRub, 4990);
  });

  it("accepts self-service plan-change payloads including Enterprise", () => {
    assert.equal(planChangeSchema.safeParse({ plan: "TEAM" }).success, true);
    assert.equal(planChangeSchema.safeParse({ plan: "BUSINESS" }).success, true);
    assert.equal(planChangeSchema.safeParse({ plan: "FREE" }).success, true);
    assert.equal(planChangeSchema.safeParse({ plan: "ENTERPRISE" }).success, true);
    assert.equal(planChangeSchema.safeParse({ plan: "GOLD" }).success, false);
    assert.equal(planChangeSchema.safeParse({}).success, false);
    assert.equal(planChangeSchema.safeParse({ plan: 1 }).success, false);
  });

  it("allows Free and paid targets without usage-based UNAVAILABLE actions", () => {
    const base = {
      currentPlan: "ENTERPRISE" as const,
      billingConfigured: true,
      canManageBilling: true,
      seatsUsed: 5,
      workspacesUsed: 2,
    };

    assert.deepEqual(getPlanAction({ ...base, targetPlan: "ENTERPRISE" }), {
      action: "CURRENT",
      unavailableReason: null,
    });
    assert.deepEqual(getPlanAction({ ...base, targetPlan: "BUSINESS" }), {
      action: "SELECT",
      unavailableReason: null,
    });
    assert.deepEqual(getPlanAction({ ...base, targetPlan: "TEAM" }), {
      action: "SELECT",
      unavailableReason: null,
    });
    assert.deepEqual(getPlanAction({ ...base, targetPlan: "FREE" }), {
      action: "SELECT",
      unavailableReason: null,
    });
  });

  it("marks Enterprise as SELECT when it is the target plan", () => {
    assert.deepEqual(
      getPlanAction({
        currentPlan: "BUSINESS",
        targetPlan: "ENTERPRISE",
        billingConfigured: true,
        canManageBilling: true,
        seatsUsed: 3,
        workspacesUsed: 1,
      }),
      { action: "SELECT", unavailableReason: null },
    );
  });

  it("marks paid targets unavailable when YooKassa is not configured", () => {
    assert.deepEqual(
      getPlanAction({
        currentPlan: "ENTERPRISE",
        targetPlan: "TEAM",
        billingConfigured: false,
        canManageBilling: true,
        seatsUsed: 5,
        workspacesUsed: 2,
      }),
      { action: "UNAVAILABLE", unavailableReason: "PAYMENT_PROVIDER_NOT_CONFIGURED" },
    );
    assert.deepEqual(
      getPlanAction({
        currentPlan: "ENTERPRISE",
        targetPlan: "FREE",
        billingConfigured: false,
        canManageBilling: true,
        seatsUsed: 3,
        workspacesUsed: 1,
      }),
      { action: "SELECT", unavailableReason: null },
    );
  });

  it("resolves owner plan across owned workspaces without writing from billing summary", async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: "ENTERPRISE" },
    });

    const extraWorkspace = await prisma.workspace.create({
      data: {
        name: `Billing Extra ${suffix}`,
        slug: `billing-extra-${suffix}`,
        plan: "FREE",
        members: {
          create: [{ userId: ownerId, role: "OWNER", status: "ACTIVE" }],
        },
      },
    });

    try {
      const summaryA = await getBillingSummary(workspaceId, "OWNER", ownerId);
      const summaryB = await getBillingSummary(extraWorkspace.id, "OWNER", ownerId);

      assert.equal(summaryA.currentPlan, "ENTERPRISE");
      assert.equal(summaryB.currentPlan, "ENTERPRISE");
      assert.equal(summaryA.usage.workspaces, 2);
      assert.equal(summaryB.usage.workspaces, 2);
      assert.deepEqual(
        summaryA.plans.map((plan) => ({
          id: plan.id,
          action: plan.action,
          reason: plan.unavailableReason,
        })),
        [
          { id: "FREE", action: "SELECT", reason: null },
          { id: "TEAM", action: "SELECT", reason: null },
          { id: "BUSINESS", action: "SELECT", reason: null },
          { id: "ENTERPRISE", action: "CURRENT", reason: null },
        ],
      );

      // GET must stay read-only: drifted row is not healed by summary.
      const drifted = await prisma.workspace.findUniqueOrThrow({
        where: { id: extraWorkspace.id },
        select: { plan: true },
      });
      assert.equal(drifted.plan, "FREE");
    } finally {
      await prisma.workspace.delete({ where: { id: extraWorkspace.id } });
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { plan: "FREE" },
      });
    }
  });

  it("keeps the same owner plan when switching between owned workspaces", async () => {
    const workspaceB = await prisma.workspace.create({
      data: {
        name: `Billing Switch ${suffix}`,
        slug: `billing-switch-${suffix}`,
        plan: "ENTERPRISE",
        members: {
          create: [{ userId: ownerId, role: "OWNER", status: "ACTIVE" }],
        },
      },
    });

    try {
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { plan: "ENTERPRISE" },
      });

      for (const plan of ["ENTERPRISE", "BUSINESS", "TEAM", "FREE"] as const) {
        await prisma.workspace.updateMany({
          where: { id: { in: [workspaceId, workspaceB.id] } },
          data: { plan },
        });

        const summaryA = await getBillingSummary(workspaceId, "OWNER", ownerId);
        const summaryB = await getBillingSummary(workspaceB.id, "OWNER", ownerId);
        assert.equal(summaryA.currentPlan, plan);
        assert.equal(summaryB.currentPlan, plan);
      }
    } finally {
      await prisma.workspace.delete({ where: { id: workspaceB.id } });
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { plan: "FREE" },
      });
    }
  });
});
