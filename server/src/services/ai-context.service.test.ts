import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { prisma } from "../lib/prisma.js";
import { buildAiWorkspaceContextFromData, getAiWorkspaceContext } from "./ai-context.service.js";

const suffix = randomBytes(4).toString("hex");
const FIXED_NOW = new Date("2026-08-09T12:00:00.000Z");

function email(label: string) {
  return `${label}.${suffix}@sensitive-ai-context.test`;
}

describe("getAiWorkspaceContext ACL and data minimization", () => {
  let workspaceAId = "";
  let workspaceBId = "";
  let ownerId = "";
  let adminId = "";
  let memberId = "";
  let otherOwnerId = "";
  const userIds: string[] = [];

  before(async () => {
    const [owner, admin, member, otherOwner] = await Promise.all([
      prisma.user.create({
        data: {
          name: "AI Owner",
          email: email("owner-private"),
          passwordHash: "owner-secret-hash",
        },
      }),
      prisma.user.create({
        data: {
          name: "AI Admin",
          email: email("admin-private"),
          passwordHash: "admin-secret-hash",
        },
      }),
      prisma.user.create({
        data: {
          name: "AI Member",
          email: email("member-private"),
          passwordHash: "member-secret-hash",
        },
      }),
      prisma.user.create({
        data: {
          name: "Other Owner",
          email: email("other-private"),
          passwordHash: "other-secret-hash",
        },
      }),
    ]);
    ownerId = owner.id;
    adminId = admin.id;
    memberId = member.id;
    otherOwnerId = otherOwner.id;
    userIds.push(owner.id, admin.id, member.id, otherOwner.id);

    const workspaceA = await prisma.workspace.create({
      data: {
        name: `Context Workspace A ${suffix}`,
        slug: `context-workspace-a-${suffix}`,
        members: {
          create: [
            { userId: owner.id, role: "OWNER", status: "ACTIVE" },
            { userId: admin.id, role: "ADMIN", status: "ACTIVE" },
            { userId: member.id, role: "MEMBER", status: "ACTIVE" },
          ],
        },
      },
    });
    const workspaceB = await prisma.workspace.create({
      data: {
        name: `Context Workspace B ${suffix}`,
        slug: `context-workspace-b-${suffix}`,
        members: { create: [{ userId: otherOwner.id, role: "OWNER", status: "ACTIVE" }] },
      },
    });
    workspaceAId = workspaceA.id;
    workspaceBId = workspaceB.id;

    const visibleProject = await prisma.project.create({
      data: {
        workspaceId: workspaceA.id,
        name: `Visible Project ${suffix}`,
        description: "Visible project description",
        status: "ACTIVE",
        projectMembers: { create: [{ userId: member.id, role: "MEMBER" }] },
      },
    });
    const hiddenProject = await prisma.project.create({
      data: {
        workspaceId: workspaceA.id,
        name: `Hidden Project ${suffix}`,
        description: "Hidden project description",
        status: "ACTIVE",
      },
    });
    const foreignProject = await prisma.project.create({
      data: {
        workspaceId: workspaceB.id,
        name: `Foreign Project ${suffix}`,
        description: "Foreign project description",
        status: "ACTIVE",
      },
    });

    const visibleTask = await prisma.task.create({
      data: {
        key: `CTX-VISIBLE-${suffix}`,
        projectId: visibleProject.id,
        title: "Visible task",
        description: "Visible task description",
        status: "IN_PROGRESS",
        priority: "URGENT",
        assigneeId: member.id,
        taskAssignees: { create: [{ userId: member.id }] },
      },
    });
    await prisma.task.create({
      data: {
        key: `CTX-HIDDEN-${suffix}`,
        projectId: hiddenProject.id,
        title: "Hidden task",
        description: "Hidden task description",
        status: "BACKLOG",
        priority: "MEDIUM",
      },
    });
    await prisma.task.create({
      data: {
        key: `CTX-FOREIGN-${suffix}`,
        projectId: foreignProject.id,
        title: "Foreign task",
        description: "Foreign task description",
        status: "BACKLOG",
        priority: "LOW",
      },
    });

    await prisma.taskComment.create({
      data: {
        taskId: visibleTask.id,
        authorId: member.id,
        body: `PRIVATE-COMMENT-${suffix}`,
      },
    });
    await prisma.taskAttachment.create({
      data: {
        taskId: visibleTask.id,
        uploaderId: member.id,
        filename: `private-file-${suffix}`,
        originalName: `PRIVATE-ATTACHMENT-${suffix}.txt`,
        mimeType: "text/plain",
        size: 10,
        url: `https://private.invalid/${suffix}`,
      },
    });
    await prisma.projectDocument.create({
      data: {
        projectId: visibleProject.id,
        uploaderId: member.id,
        filename: `private-document-${suffix}`,
        originalName: `PRIVATE-DOCUMENT-${suffix}.txt`,
        mimeType: "text/plain",
        size: 10,
        url: `https://private.invalid/document/${suffix}`,
      },
    });
  });

  after(async () => {
    for (const workspaceId of [workspaceAId, workspaceBId]) {
      if (workspaceId) {
        await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
      }
    }
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined);
    }
  });

  it("allows OWNER and ADMIN to see all projects in their workspace", async () => {
    for (const [userId, role] of [
      [ownerId, "OWNER"],
      [adminId, "ADMIN"],
    ] as const) {
      const context = await getAiWorkspaceContext(workspaceAId, userId, role, {}, FIXED_NOW);
      const serialized = JSON.stringify(context);
      assert.equal(context.projects.length, 2);
      assert.equal(context.tasks.length, 2);
      assert.ok(serialized.includes(`Visible Project ${suffix}`));
      assert.ok(serialized.includes(`Hidden Project ${suffix}`));
    }
  });

  it("keeps MEMBER context limited to explicit project membership", async () => {
    const context = await getAiWorkspaceContext(workspaceAId, memberId, "MEMBER", {}, FIXED_NOW);
    const serialized = JSON.stringify(context);
    assert.equal(context.projects.length, 1);
    assert.equal(context.tasks.length, 1);
    assert.ok(serialized.includes(`CTX-VISIBLE-${suffix}`));
    assert.equal(serialized.includes(`Hidden Project ${suffix}`), false);
    assert.equal(serialized.includes(`CTX-HIDDEN-${suffix}`), false);
  });

  it("never includes data from another workspace", async () => {
    const contextA = await getAiWorkspaceContext(workspaceAId, ownerId, "OWNER", {}, FIXED_NOW);
    const contextB = await getAiWorkspaceContext(
      workspaceBId,
      otherOwnerId,
      "OWNER",
      {},
      FIXED_NOW,
    );
    assert.equal(JSON.stringify(contextA).includes(`CTX-FOREIGN-${suffix}`), false);
    assert.equal(JSON.stringify(contextB).includes(`CTX-VISIBLE-${suffix}`), false);
    assert.ok(JSON.stringify(contextB).includes(`CTX-FOREIGN-${suffix}`));
  });

  it("omits emails, credentials, comments, documents, attachments, and storage URLs", async () => {
    const context = await getAiWorkspaceContext(workspaceAId, ownerId, "OWNER", {}, FIXED_NOW);
    const serialized = JSON.stringify(context);
    for (const sensitiveValue of [
      email("owner-private"),
      email("member-private"),
      "owner-secret-hash",
      `PRIVATE-COMMENT-${suffix}`,
      `PRIVATE-ATTACHMENT-${suffix}`,
      `PRIVATE-DOCUMENT-${suffix}`,
      "https://private.invalid",
    ]) {
      assert.equal(serialized.includes(sensitiveValue), false);
    }
    for (const forbiddenField of [
      "email",
      "passwordHash",
      "comments",
      "attachments",
      "documents",
      "billing",
    ]) {
      assert.equal(serialized.includes(`\"${forbiddenField}\"`), false);
    }
  });

  it("caps record counts and descriptions and reports truncation", async () => {
    const context = await getAiWorkspaceContext(
      workspaceAId,
      ownerId,
      "OWNER",
      { maxProjects: 1, maxTasks: 1, maxDescriptionCharacters: 8 },
      FIXED_NOW,
    );
    assert.equal(context.projects.length, 1);
    assert.equal(context.tasks.length, 1);
    assert.equal(context.metadata.contextTruncated, true);
    assert.ok(context.metadata.truncationReasons.includes("project-count"));
    assert.ok(context.metadata.truncationReasons.includes("task-count"));
    assert.ok(context.metadata.truncationReasons.includes("description-length"));
    assert.ok((context.projects[0]?.description.length ?? 0) <= 8);
    assert.ok((context.tasks[0]?.description?.length ?? 0) <= 8);
  });

  it("enforces the total serialized data cap", () => {
    const context = buildAiWorkspaceContextFromData(
      { id: "ws", name: "Workspace" },
      [
        {
          id: "project",
          name: "Project",
          description: "x".repeat(2_000),
          status: "ACTIVE",
          dueDate: null,
        },
      ],
      [],
      { maxDescriptionCharacters: 1_000, maxTotalCharacters: 1_000 },
      FIXED_NOW,
    );
    assert.ok(JSON.stringify(context).length <= 1_000);
    assert.equal(context.metadata.contextTruncated, true);
    assert.ok(context.metadata.truncationReasons.includes("total-size"));
  });
});
