import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import type { NextFunction, Request, Response } from "express";

import {
  getNotificationsController,
  markNotificationReadController,
} from "../controllers/notifications.controller.js";
import { prisma } from "../lib/prisma.js";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notifications.service.js";

describe("notifications workspace and project ACL", () => {
  const suffix = randomUUID().slice(0, 8);
  const ids = {
    owner: "",
    admin: "",
    member: "",
    otherUser: "",
    workspaceA: "",
    workspaceB: "",
    accessibleProject: "",
    hiddenProject: "",
    accessibleTask: "",
    hiddenTask: "",
  };
  const memberEmail = `notifications-member-${suffix}@example.com`;

  before(async () => {
    const [owner, admin, member, otherUser] = await Promise.all(
      ["owner", "admin", "member", "other"].map((label) =>
        prisma.user.create({
          data: {
            email: `notifications-${label}-${suffix}@example.com`,
            name: `Notifications ${label}`,
            passwordHash: "test-hash",
          },
        }),
      ),
    );
    ids.owner = owner.id;
    ids.admin = admin.id;
    ids.member = member.id;
    ids.otherUser = otherUser.id;

    await prisma.user.update({ where: { id: member.id }, data: { email: memberEmail } });

    const workspaceA = await prisma.workspace.create({
      data: {
        name: `Notifications A ${suffix}`,
        slug: `notifications-a-${suffix}`,
        members: {
          create: [
            { userId: owner.id, role: "OWNER", status: "ACTIVE" },
            { userId: admin.id, role: "ADMIN", status: "ACTIVE" },
            { userId: member.id, role: "MEMBER", status: "ACTIVE" },
            { userId: otherUser.id, role: "MEMBER", status: "ACTIVE" },
          ],
        },
      },
    });
    const workspaceB = await prisma.workspace.create({
      data: {
        name: `Notifications B ${suffix}`,
        slug: `notifications-b-${suffix}`,
        members: { create: [{ userId: member.id, role: "MEMBER", status: "ACTIVE" }] },
      },
    });
    ids.workspaceA = workspaceA.id;
    ids.workspaceB = workspaceB.id;

    const accessibleProject = await prisma.project.create({
      data: {
        workspaceId: workspaceA.id,
        name: `Accessible ${suffix}`,
        description: "",
        projectMembers: { create: [{ userId: member.id }] },
      },
    });
    const hiddenProject = await prisma.project.create({
      data: {
        workspaceId: workspaceA.id,
        name: `Hidden ${suffix}`,
        description: "",
      },
    });
    ids.accessibleProject = accessibleProject.id;
    ids.hiddenProject = hiddenProject.id;

    const accessibleTask = await prisma.task.create({
      data: {
        projectId: accessibleProject.id,
        key: `NTA-${suffix}`,
        title: "Accessible task",
      },
    });
    const hiddenTask = await prisma.task.create({
      data: {
        projectId: hiddenProject.id,
        key: `NTH-${suffix}`,
        title: "Hidden task",
      },
    });
    ids.accessibleTask = accessibleTask.id;
    ids.hiddenTask = hiddenTask.id;
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany({
      where: { workspaceId: { in: [ids.workspaceA, ids.workspaceB] } },
    });
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: { projectId: ids.accessibleProject, userId: ids.member },
      },
      create: { projectId: ids.accessibleProject, userId: ids.member },
      update: {},
    });
  });

  after(async () => {
    await prisma.workspace.deleteMany({
      where: { id: { in: [ids.workspaceA, ids.workspaceB] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [ids.owner, ids.admin, ids.member, ids.otherUser] } },
    });
  });

  async function createRow(params: {
    recipientId: string;
    workspaceId?: string;
    entityType?: string | null;
    entityId?: string | null;
    title: string;
  }) {
    return prisma.notification.create({
      data: {
        workspaceId: params.workspaceId ?? ids.workspaceA,
        recipientId: params.recipientId,
        type: "TEST_NOTIFICATION",
        title: params.title,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
      },
    });
  }

  function createResponse() {
    const state: { statusCode: number; body?: unknown } = { statusCode: 200 };
    const response = {
      status(code: number) {
        state.statusCode = code;
        return response;
      },
      json(body: unknown) {
        state.body = body;
        return response;
      },
    } as unknown as Response;
    return { response, state };
  }

  const next: NextFunction = (error?: unknown) => {
    if (error) throw error;
  };

  it("isolates the current workspace and authenticated recipient with ACL-correct unreadCount", async () => {
    await Promise.all([
      createRow({ recipientId: ids.member, title: "Generic current" }),
      createRow({
        recipientId: ids.member,
        entityType: "task",
        entityId: ids.accessibleTask,
        title: "Accessible current",
      }),
      createRow({
        recipientId: ids.member,
        entityType: "task",
        entityId: ids.hiddenTask,
        title: "Hidden current",
      }),
      createRow({
        recipientId: ids.member,
        workspaceId: ids.workspaceB,
        title: "Other workspace",
      }),
      createRow({ recipientId: ids.otherUser, title: "Other user" }),
    ]);

    const result = await getNotifications(ids.member, memberEmail, ids.workspaceA, "MEMBER");
    assert.deepEqual(result.notifications.map((notification) => notification.title).sort(), [
      "Accessible current",
      "Generic current",
    ]);
    assert.equal(result.unreadCount, 2);
  });

  it("keeps OWNER and ADMIN access to project notifications in their workspace", async () => {
    await Promise.all([
      createRow({
        recipientId: ids.owner,
        entityType: "task",
        entityId: ids.hiddenTask,
        title: "Owner task",
      }),
      createRow({
        recipientId: ids.admin,
        entityType: "project",
        entityId: ids.hiddenProject,
        title: "Admin project",
      }),
    ]);

    const [ownerResult, adminResult] = await Promise.all([
      getNotifications(
        ids.owner,
        `notifications-owner-${suffix}@example.com`,
        ids.workspaceA,
        "OWNER",
      ),
      getNotifications(
        ids.admin,
        `notifications-admin-${suffix}@example.com`,
        ids.workspaceA,
        "ADMIN",
      ),
    ]);
    assert.equal(ownerResult.notifications[0]?.title, "Owner task");
    assert.equal(adminResult.notifications[0]?.title, "Admin project");
  });

  it("hides a stale notification and blocks mark-read after MEMBER loses project access", async () => {
    const notification = await createRow({
      recipientId: ids.member,
      entityType: "task",
      entityId: ids.accessibleTask,
      title: "Revoked task",
    });
    await prisma.projectMember.delete({
      where: {
        projectId_userId: { projectId: ids.accessibleProject, userId: ids.member },
      },
    });

    const result = await getNotifications(ids.member, memberEmail, ids.workspaceA, "MEMBER");
    assert.equal(result.notifications.length, 0);
    assert.equal(result.unreadCount, 0);
    assert.equal(
      await markNotificationRead(ids.member, notification.id, ids.workspaceA, "MEMBER"),
      null,
    );
    const stored = await prisma.notification.findUnique({ where: { id: notification.id } });
    assert.equal(stored?.readAt, null);
  });

  it("read-all updates only accessible notifications in the current workspace", async () => {
    const [accessible, hidden, otherWorkspace, otherUser] = await Promise.all([
      createRow({
        recipientId: ids.member,
        entityType: "task",
        entityId: ids.accessibleTask,
        title: "Accessible",
      }),
      createRow({
        recipientId: ids.member,
        entityType: "task",
        entityId: ids.hiddenTask,
        title: "Hidden",
      }),
      createRow({ recipientId: ids.member, workspaceId: ids.workspaceB, title: "Workspace B" }),
      createRow({ recipientId: ids.otherUser, title: "Other recipient" }),
    ]);

    await markAllNotificationsRead(ids.member, ids.workspaceA, "MEMBER");
    const rows = await prisma.notification.findMany({
      where: { id: { in: [accessible.id, hidden.id, otherWorkspace.id, otherUser.id] } },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    assert.ok(byId.get(accessible.id)?.readAt);
    assert.equal(byId.get(hidden.id)?.readAt, null);
    assert.equal(byId.get(otherWorkspace.id)?.readAt, null);
    assert.equal(byId.get(otherUser.id)?.readAt, null);
  });

  it("controllers derive workspace and identity server-side despite spoofed body fields", async () => {
    const [current, otherWorkspace] = await Promise.all([
      createRow({ recipientId: ids.member, title: "Controller current" }),
      createRow({
        recipientId: ids.member,
        workspaceId: ids.workspaceB,
        title: "Controller other workspace",
      }),
    ]);
    const request = {
      userId: ids.member,
      headers: { "x-workspace-id": ids.workspaceA },
      body: { workspaceId: ids.workspaceB, userId: ids.otherUser, role: "OWNER" },
      params: {},
    } as unknown as Request;
    const getResult = createResponse();
    await getNotificationsController(request, getResult.response, next);
    assert.equal(getResult.state.statusCode, 200);
    const payload = getResult.state.body as {
      data: { notifications: { id: string }[] };
    };
    assert.deepEqual(
      payload.data.notifications.map((item) => item.id),
      [current.id],
    );

    const readRequest = {
      ...request,
      params: { id: otherWorkspace.id },
    } as unknown as Request;
    const readResult = createResponse();
    await markNotificationReadController(readRequest, readResult.response, next);
    assert.equal(readResult.state.statusCode, 404);
    assert.equal(
      (await prisma.notification.findUnique({ where: { id: otherWorkspace.id } }))?.readAt,
      null,
    );
  });
});
