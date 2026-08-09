import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { buildDirectIdentityKey, buildWorkspaceGeneralIdentityKey } from "../lib/chat-conversation-utils.js";
import { prisma } from "../lib/prisma.js";
import { AuthError } from "./auth.service.js";
import {
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
} from "./workspace-members.service.js";

const suffix = randomBytes(4).toString("hex");

function email(label: string) {
  return `${label}.${suffix}@members-test.teamflow.local`;
}

describe("workspace-members.service", () => {
  let workspaceId = "";
  let ownerId = "";
  let adminId = "";
  let memberId = "";
  let secondOwnerId = "";
  const userIds: string[] = [];

  before(async () => {
    const owner = await prisma.user.create({
      data: {
        name: "Members Owner",
        email: email("owner"),
        passwordHash: "test-hash",
      },
    });
    const admin = await prisma.user.create({
      data: {
        name: "Members Admin",
        email: email("admin"),
        passwordHash: "test-hash",
      },
    });
    const member = await prisma.user.create({
      data: {
        name: "Members Member",
        email: email("member"),
        passwordHash: "test-hash",
      },
    });
    const secondOwner = await prisma.user.create({
      data: {
        name: "Second Owner",
        email: email("second-owner"),
        passwordHash: "test-hash",
      },
    });

    ownerId = owner.id;
    adminId = admin.id;
    memberId = member.id;
    secondOwnerId = secondOwner.id;
    userIds.push(owner.id, admin.id, member.id, secondOwner.id);

    const workspace = await prisma.workspace.create({
      data: {
        name: `Members Test ${suffix}`,
        slug: `members-test-${suffix}`,
        plan: "TEAM",
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

  it("allows OWNER to change ADMIN and MEMBER roles", async () => {
    const demoted = await updateWorkspaceMemberRole({
      workspaceId,
      actorUserId: ownerId,
      actorRole: "OWNER",
      memberId: adminId,
      role: "MEMBER",
    });
    assert.equal(demoted.role, "MEMBER");

    const promoted = await updateWorkspaceMemberRole({
      workspaceId,
      actorUserId: ownerId,
      actorRole: "OWNER",
      memberId: adminId,
      role: "ADMIN",
    });
    assert.equal(promoted.role, "ADMIN");
  });

  it("rejects role changes from a regular MEMBER", async () => {
    await assert.rejects(
      () =>
        updateWorkspaceMemberRole({
          workspaceId,
          actorUserId: memberId,
          actorRole: "MEMBER",
          memberId: adminId,
          role: "MEMBER",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.statusCode, 403);
        return true;
      },
    );
  });

  it("rejects changing or removing yourself", async () => {
    await assert.rejects(
      () =>
        updateWorkspaceMemberRole({
          workspaceId,
          actorUserId: ownerId,
          actorRole: "OWNER",
          memberId: ownerId,
          role: "MEMBER",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.statusCode, 403);
        assert.match(error.message, /cannot change your own role/i);
        return true;
      },
    );

    await assert.rejects(
      () =>
        removeWorkspaceMember({
          workspaceId,
          actorUserId: ownerId,
          actorRole: "OWNER",
          memberId: ownerId,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.statusCode, 403);
        assert.match(error.message, /cannot remove yourself/i);
        return true;
      },
    );
  });

  it("rejects demoting or removing the last OWNER", async () => {
    await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: secondOwnerId,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    // With two owners, demoting one OWNER to MEMBER is allowed.
    const demoted = await updateWorkspaceMemberRole({
      workspaceId,
      actorUserId: ownerId,
      actorRole: "OWNER",
      memberId: secondOwnerId,
      role: "MEMBER",
    });
    assert.equal(demoted.role, "MEMBER");

    // Sole OWNER remains. Another OWNER-authorized call targeting that OWNER must fail.
    await assert.rejects(
      () =>
        updateWorkspaceMemberRole({
          workspaceId,
          actorUserId: adminId,
          actorRole: "OWNER",
          memberId: ownerId,
          role: "MEMBER",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.statusCode, 409);
        assert.match(error.message, /cannot demote the last owner/i);
        return true;
      },
    );

    await assert.rejects(
      () =>
        removeWorkspaceMember({
          workspaceId,
          actorUserId: adminId,
          actorRole: "OWNER",
          memberId: ownerId,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.statusCode, 409);
        assert.match(error.message, /cannot remove the last owner/i);
        return true;
      },
    );

    // Restore secondOwner as a regular member for later tests.
    await prisma.workspaceMember.update({
      where: {
        workspaceId_userId: { workspaceId, userId: secondOwnerId },
      },
      data: { role: "MEMBER" },
    });
  });

  it("removes project membership, task assignees, and chat membership while keeping messages and conversations", async () => {
    const removable = await prisma.user.create({
      data: {
        name: "Removable Member",
        email: email("removable"),
        passwordHash: "test-hash",
      },
    });
    userIds.push(removable.id);

    await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: removable.id,
        role: "MEMBER",
        status: "ACTIVE",
      },
    });

    const project = await prisma.project.create({
      data: {
        workspaceId,
        name: `Cleanup Project ${suffix}`,
        description: "Cleanup coverage",
        status: "ACTIVE",
        projectMembers: {
          create: [{ userId: removable.id, role: "MEMBER" }],
        },
      },
    });

    const task = await prisma.task.create({
      data: {
        key: `CLEANUP-${suffix}`,
        projectId: project.id,
        title: `Cleanup Task ${suffix}`,
        status: "BACKLOG",
        priority: "MEDIUM",
        assigneeId: removable.id,
        taskAssignees: {
          create: [{ userId: removable.id }],
        },
      },
    });

    const general = await prisma.chatConversation.create({
      data: {
        workspaceId,
        type: "WORKSPACE",
        identityKey: buildWorkspaceGeneralIdentityKey(`${workspaceId}-cleanup-${suffix}`),
        members: {
          create: [
            { userId: ownerId },
            { userId: removable.id },
          ],
        },
        messages: {
          create: [
            {
              senderId: removable.id,
              content: "Please keep this message after membership removal.",
            },
          ],
        },
      },
      include: { messages: true },
    });

    const direct = await prisma.chatConversation.create({
      data: {
        workspaceId,
        type: "DIRECT",
        identityKey: buildDirectIdentityKey(workspaceId, ownerId, removable.id),
        members: {
          create: [
            { userId: ownerId },
            { userId: removable.id },
          ],
        },
      },
    });

    const messageId = general.messages[0]!.id;

    await removeWorkspaceMember({
      workspaceId,
      actorUserId: ownerId,
      actorRole: "OWNER",
      memberId: removable.id,
    });

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: removable.id },
    });
    assert.equal(membership, null);

    const projectMembership = await prisma.projectMember.findFirst({
      where: { projectId: project.id, userId: removable.id },
    });
    assert.equal(projectMembership, null);

    const assigneeLink = await prisma.taskAssignee.findFirst({
      where: { taskId: task.id, userId: removable.id },
    });
    assert.equal(assigneeLink, null);

    const updatedTask = await prisma.task.findUniqueOrThrow({
      where: { id: task.id },
      select: { assigneeId: true },
    });
    assert.equal(updatedTask.assigneeId, null);

    const removableChatMemberships = await prisma.chatConversationMember.findMany({
      where: {
        userId: removable.id,
        conversation: { workspaceId },
      },
    });
    assert.equal(removableChatMemberships.length, 0);

    const ownerStillInGeneral = await prisma.chatConversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: general.id,
          userId: ownerId,
        },
      },
    });
    assert.ok(ownerStillInGeneral);

    const keptConversation = await prisma.chatConversation.findUnique({
      where: { id: general.id },
    });
    assert.ok(keptConversation);

    const keptDirect = await prisma.chatConversation.findUnique({
      where: { id: direct.id },
    });
    assert.ok(keptDirect);

    const keptMessage = await prisma.workspaceChatMessage.findUnique({
      where: { id: messageId },
    });
    assert.ok(keptMessage);
    assert.equal(keptMessage.senderId, removable.id);
    assert.equal(
      keptMessage.content,
      "Please keep this message after membership removal.",
    );
  });
});
