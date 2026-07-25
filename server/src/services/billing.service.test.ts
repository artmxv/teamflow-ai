import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { prisma } from "../lib/prisma.js";
import { updatePlanSchema } from "../controllers/billing.controller.js";
import { AuthError } from "./auth.service.js";
import { getBillingPlanConfig, getBillingPlans } from "./billing-plans.service.js";
import {
  BILLING_NOT_AVAILABLE_CODE,
  BILLING_NOT_AVAILABLE_MESSAGE,
  getBillingSummary,
  updateWorkspaceBillingPlan,
} from "./billing.service.js";

const suffix = randomBytes(4).toString("hex");

function email(label: string) {
  return `${label}.${suffix}@billing-test.teamflow.local`;
}

describe("billing.service", () => {
  let workspaceId = "";
  let ownerId = "";
  let adminId = "";
  let memberId = "";
  const userIds: string[] = [];

  before(async () => {
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
    adminId = admin.id;
    memberId = member.id;
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
    if (workspaceId) {
      await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
    }
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined);
    }
  });

  it("returns billing summary with real plan limits and usage", async () => {
    const summary = await getBillingSummary(ownerId, workspaceId);
    const freeConfig = getBillingPlanConfig("FREE");

    assert.equal(summary.currentPlan, "FREE");
    assert.equal(summary.limits.maxMembers, freeConfig.limits.maxMembers);
    assert.equal(summary.limits.maxWorkspaces, freeConfig.limits.maxWorkspaces);
    assert.equal(summary.usage.members, 3);
    assert.equal(summary.usage.pendingInvitations, 0);
    assert.equal(summary.usage.workspaces, 1);
    assert.equal(summary.plans.length, getBillingPlans().length);
    assert.ok(summary.plans.every((plan) => plan.id === "FREE" ? plan.isCurrent : !plan.isCurrent));
  });

  it("rejects OWNER plan changes with BILLING_NOT_AVAILABLE and does not update plan", async () => {
    await assert.rejects(
      () =>
        updateWorkspaceBillingPlan({
          userId: ownerId,
          workspaceId,
          role: "OWNER",
          plan: "TEAM",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.statusCode, 503);
        assert.equal(error.code, BILLING_NOT_AVAILABLE_CODE);
        assert.equal(error.message, BILLING_NOT_AVAILABLE_MESSAGE);
        return true;
      },
    );

    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { plan: true },
    });
    assert.equal(workspace.plan, "FREE");
  });

  it("rejects MEMBER plan changes with 403", async () => {
    await assert.rejects(
      () =>
        updateWorkspaceBillingPlan({
          userId: memberId,
          workspaceId,
          role: "MEMBER",
          plan: "BUSINESS",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.statusCode, 403);
        return true;
      },
    );

    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { plan: true },
    });
    assert.equal(workspace.plan, "FREE");
  });

  it("rejects ADMIN plan changes with 403", async () => {
    await assert.rejects(
      () =>
        updateWorkspaceBillingPlan({
          userId: adminId,
          workspaceId,
          role: "ADMIN",
          plan: "ENTERPRISE",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.statusCode, 403);
        return true;
      },
    );

    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { plan: true },
    });
    assert.equal(workspace.plan, "FREE");
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
  });

  it("rejects invalid plan payloads via updatePlanSchema", () => {
    assert.equal(updatePlanSchema.safeParse({ plan: "FREE" }).success, true);
    assert.equal(updatePlanSchema.safeParse({ plan: "GOLD" }).success, false);
    assert.equal(updatePlanSchema.safeParse({}).success, false);
    assert.equal(updatePlanSchema.safeParse({ plan: 1 }).success, false);
  });
});
