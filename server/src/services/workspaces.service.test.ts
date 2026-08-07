import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import { prisma } from "../lib/prisma.js";
import { AuthError } from "./auth.service.js";
import { WORKSPACE_LIMIT_REACHED_CODE } from "./billing-plans.service.js";
import { createWorkspaceForUser } from "./workspaces.service.js";

const suffix = randomBytes(4).toString("hex");

function email(label: string) {
  return `${label}.${suffix}@workspace-limit-test.teamflow.local`;
}

describe("workspaces.service billing limits", () => {
  let ownerId = "";
  let adminId = "";
  let currentWorkspaceId = "";

  before(async () => {
    const [owner, admin] = await Promise.all([
      prisma.user.create({
        data: { name: "Workspace Owner", email: email("owner"), passwordHash: "test-hash" },
      }),
      prisma.user.create({
        data: { name: "Workspace Admin", email: email("admin"), passwordHash: "test-hash" },
      }),
    ]);
    ownerId = owner.id;
    adminId = admin.id;

    const workspace = await prisma.workspace.create({
      data: {
        name: `Workspace Limit ${suffix}`,
        slug: `workspace-limit-${suffix}`,
        plan: "FREE",
        members: {
          create: [
            { userId: ownerId, role: "OWNER", status: "ACTIVE" },
            { userId: adminId, role: "ADMIN", status: "ACTIVE" },
          ],
        },
      },
    });
    currentWorkspaceId = workspace.id;
  });

  beforeEach(async () => {
    await prisma.workspace.deleteMany({
      where: { slug: { startsWith: `workspace-limit-extra-${suffix}-` } },
    });
    await prisma.workspace.update({
      where: { id: currentWorkspaceId },
      data: { plan: "FREE" },
    });
  });

  after(async () => {
    await prisma.workspace
      .deleteMany({
        where: {
          OR: [
            { id: currentWorkspaceId },
            { slug: { startsWith: `workspace-limit-extra-${suffix}-` } },
          ],
        },
      })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { email: { endsWith: `.${suffix}@workspace-limit-test.teamflow.local` } } })
      .catch(() => undefined);
  });

  it("blocks creating a second owned workspace on Free", async () => {
    await assert.rejects(
      () =>
        createWorkspaceForUser({
          userId: ownerId,
          selectedWorkspaceId: currentWorkspaceId,
          data: {
            name: "Free overflow",
            slug: `workspace-limit-extra-${suffix}-free`,
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.statusCode, 409);
        assert.equal(error.code, WORKSPACE_LIMIT_REACHED_CODE);
        return true;
      },
    );
  });

  it("allows two owned workspaces on Team and blocks the third", async () => {
    await prisma.workspace.update({
      where: { id: currentWorkspaceId },
      data: { plan: "TEAM" },
    });

    const created = await createWorkspaceForUser({
      userId: ownerId,
      selectedWorkspaceId: currentWorkspaceId,
      data: {
        name: "Team second",
        slug: `workspace-limit-extra-${suffix}-team-second`,
      },
    });
    assert.equal(created.role, "OWNER");

    await assert.rejects(
      () =>
        createWorkspaceForUser({
          userId: ownerId,
          selectedWorkspaceId: currentWorkspaceId,
          data: {
            name: "Team third",
            slug: `workspace-limit-extra-${suffix}-team-third`,
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.code, WORKSPACE_LIMIT_REACHED_CODE);
        return true;
      },
    );
  });

  it("serializes concurrent creates so Team cannot exceed two workspaces", async () => {
    await prisma.workspace.update({
      where: { id: currentWorkspaceId },
      data: { plan: "TEAM" },
    });

    const results = await Promise.allSettled([
      createWorkspaceForUser({
        userId: ownerId,
        selectedWorkspaceId: currentWorkspaceId,
        data: {
          name: "Concurrent A",
          slug: `workspace-limit-extra-${suffix}-concurrent-a`,
        },
      }),
      createWorkspaceForUser({
        userId: ownerId,
        selectedWorkspaceId: currentWorkspaceId,
        data: {
          name: "Concurrent B",
          slug: `workspace-limit-extra-${suffix}-concurrent-b`,
        },
      }),
    ]);

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  });

  it("keeps workspace creation OWNER-only", async () => {
    await assert.rejects(
      () =>
        createWorkspaceForUser({
          userId: adminId,
          selectedWorkspaceId: currentWorkspaceId,
          data: {
            name: "Admin workspace",
            slug: `workspace-limit-extra-${suffix}-admin`,
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.statusCode, 403);
        return true;
      },
    );
  });
});
