import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { prisma } from "../lib/prisma.js";
import { AuthError } from "./auth.service.js";
import { MEMBER_LIMIT_REACHED_CODE } from "./billing-plans.service.js";
import {
  acceptWorkspaceInvitation,
  createWorkspaceInvitation,
  getInvitationByToken,
  INVITATION_RESEND_TOO_SOON_CODE,
  invitationEmailDelivery,
  resendWorkspaceInvitation,
  revokeWorkspaceInvitation,
} from "./workspace-invitations.service.js";

const suffix = randomBytes(4).toString("hex");

function email(label: string) {
  return `${label}.${suffix}@invite-test.teamflow.local`;
}

function publicUser(user: {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    displayName: null,
    timezone: null,
    bio: null,
    email: user.email,
    avatar: null,
    avatarUrl: null,
    phone: null,
    position: null,
    location: null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** Backdate updatedAt so the 60s resend cooldown does not block the test. */
async function clearResendCooldown(invitationId: string) {
  await prisma.workspaceInvitation.update({
    where: { id: invitationId },
    data: { updatedAt: new Date(Date.now() - 61_000) },
  });
}

describe("workspace-invitations.service", () => {
  let ownerId = "";
  let workspaceId = "";
  let workspaceName = "";
  const userIds: string[] = [];

  before(async () => {
    const owner = await prisma.user.create({
      data: {
        name: "Invite Owner",
        email: email("owner"),
        passwordHash: "test-hash",
      },
    });
    ownerId = owner.id;
    userIds.push(owner.id);

    const workspace = await prisma.workspace.create({
      data: {
        name: `Invite Test ${suffix}`,
        slug: `invite-test-${suffix}`,
        // Unlimited seats so accumulated PENDING invites in this suite do not collide.
        plan: "ENTERPRISE",
        members: {
          create: {
            userId: owner.id,
            role: "OWNER",
            status: "ACTIVE",
          },
        },
      },
    });
    workspaceId = workspace.id;
    workspaceName = workspace.name;
  });

  after(async () => {
    if (workspaceId) {
      await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
    }
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined);
    }
  });

  it("creates a new invitation with honest delivery fields", async () => {
    const result = await createWorkspaceInvitation({
      workspaceId,
      workspaceName,
      workspacePlan: "ENTERPRISE",
      inviterUserId: ownerId,
      inviterRole: "OWNER",
      email: email("new-member"),
      role: "MEMBER",
    });

    assert.equal(result.reused, false);
    assert.equal(result.emailSent, false);
    assert.ok(result.deliveryMode === "dev" || result.deliveryMode === "console");
    assert.equal(result.invitation.status, "PENDING");
    assert.equal(result.invitation.email, email("new-member"));
    assert.equal(result.invitation.role, "MEMBER");
    assert.match(result.invitation.acceptUrl, /\/invite\//);
  });

  it("reuses an active PENDING invitation without claiming email was sent", async () => {
    const inviteEmail = email("reuse-me");

    const first = await createWorkspaceInvitation({
      workspaceId,
      workspaceName,
      workspacePlan: "ENTERPRISE",
      inviterUserId: ownerId,
      inviterRole: "OWNER",
      email: inviteEmail,
      role: "ADMIN",
    });

    const second = await createWorkspaceInvitation({
      workspaceId,
      workspaceName,
      workspacePlan: "ENTERPRISE",
      inviterUserId: ownerId,
      inviterRole: "OWNER",
      email: inviteEmail,
      role: "MEMBER",
    });

    assert.equal(second.reused, true);
    assert.equal(second.emailSent, false);
    assert.equal(second.deliveryMode, "existing");
    assert.equal(second.invitation.id, first.invitation.id);
    assert.equal(second.invitation.role, "ADMIN");
  });

  it("revokes a pending invitation", async () => {
    const created = await createWorkspaceInvitation({
      workspaceId,
      workspaceName,
      workspacePlan: "ENTERPRISE",
      inviterUserId: ownerId,
      inviterRole: "OWNER",
      email: email("revoke-me"),
      role: "MEMBER",
    });

    const revoked = await revokeWorkspaceInvitation(
      workspaceId,
      created.invitation.id,
      "OWNER",
    );

    assert.equal(revoked.status, "REVOKED");

    const stored = await prisma.workspaceInvitation.findUniqueOrThrow({
      where: { id: created.invitation.id },
      select: { status: true },
    });
    assert.equal(stored.status, "REVOKED");
  });

  it("previews an active invitation by token", async () => {
    const created = await createWorkspaceInvitation({
      workspaceId,
      workspaceName,
      workspacePlan: "ENTERPRISE",
      inviterUserId: ownerId,
      inviterRole: "OWNER",
      email: email("preview-me"),
      role: "MEMBER",
    });

    const token = created.invitation.acceptUrl.split("/invite/")[1]!;
    const preview = await getInvitationByToken(token);

    assert.equal(preview.canAccept, true);
    assert.equal(preview.isExpired, false);
    assert.equal(preview.email, email("preview-me"));
    assert.equal(preview.workspaceName, workspaceName);
    assert.equal(preview.emailMatchesCurrentUser, null);
  });

  it("accepts an invitation when emails match", async () => {
    const inviteEmail = email("accept-ok");
    const created = await createWorkspaceInvitation({
      workspaceId,
      workspaceName,
      workspacePlan: "ENTERPRISE",
      inviterUserId: ownerId,
      inviterRole: "OWNER",
      email: inviteEmail,
      role: "MEMBER",
    });

    const invitee = await prisma.user.create({
      data: {
        name: "Accept Ok",
        email: inviteEmail,
        passwordHash: "test-hash",
      },
    });
    userIds.push(invitee.id);

    const token = created.invitation.acceptUrl.split("/invite/")[1]!;
    const accepted = await acceptWorkspaceInvitation(token, publicUser(invitee));

    assert.equal(accepted.workspaceId, workspaceId);
    assert.equal(accepted.role, "MEMBER");

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: invitee.id, status: "ACTIVE" },
    });
    assert.ok(membership);

    const invite = await prisma.workspaceInvitation.findUniqueOrThrow({
      where: { id: created.invitation.id },
      select: { status: true },
    });
    assert.equal(invite.status, "ACCEPTED");
  });

  it("rejects accept when the signed-in email does not match", async () => {
    const created = await createWorkspaceInvitation({
      workspaceId,
      workspaceName,
      workspacePlan: "ENTERPRISE",
      inviterUserId: ownerId,
      inviterRole: "OWNER",
      email: email("accept-mismatch-target"),
      role: "MEMBER",
    });

    const wrongUser = await prisma.user.create({
      data: {
        name: "Wrong Email",
        email: email("accept-mismatch-actor"),
        passwordHash: "test-hash",
      },
    });
    userIds.push(wrongUser.id);

    const token = created.invitation.acceptUrl.split("/invite/")[1]!;

    await assert.rejects(
      () => acceptWorkspaceInvitation(token, publicUser(wrongUser)),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.statusCode, 403);
        assert.equal(error.code, "INVITATION_EMAIL_MISMATCH");
        return true;
      },
    );

    const invite = await prisma.workspaceInvitation.findUniqueOrThrow({
      where: { id: created.invitation.id },
      select: { status: true },
    });
    assert.equal(invite.status, "PENDING");
  });

  it("rejects accept for revoked invitations", async () => {
    const inviteEmail = email("accept-revoked");
    const created = await createWorkspaceInvitation({
      workspaceId,
      workspaceName,
      workspacePlan: "ENTERPRISE",
      inviterUserId: ownerId,
      inviterRole: "OWNER",
      email: inviteEmail,
      role: "MEMBER",
    });

    await revokeWorkspaceInvitation(workspaceId, created.invitation.id, "OWNER");

    const invitee = await prisma.user.create({
      data: {
        name: "Revoked Invitee",
        email: inviteEmail,
        passwordHash: "test-hash",
      },
    });
    userIds.push(invitee.id);

    const token = created.invitation.acceptUrl.split("/invite/")[1]!;

    await assert.rejects(
      () => acceptWorkspaceInvitation(token, publicUser(invitee)),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.statusCode, 404);
        assert.equal(error.code, "INVITATION_NO_LONGER_AVAILABLE");
        return true;
      },
    );
  });

  it("rejects accept for expired invitations", async () => {
    const inviteEmail = email("accept-expired");
    const token = randomBytes(24).toString("base64url");

    const invite = await prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email: inviteEmail,
        role: "MEMBER",
        token,
        invitedById: ownerId,
        status: "PENDING",
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const invitee = await prisma.user.create({
      data: {
        name: "Expired Invitee",
        email: inviteEmail,
        passwordHash: "test-hash",
      },
    });
    userIds.push(invitee.id);

    await assert.rejects(
      () => acceptWorkspaceInvitation(token, publicUser(invitee)),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.statusCode, 404);
        assert.equal(error.code, "INVITATION_NO_LONGER_AVAILABLE");
        return true;
      },
    );

    const stored = await prisma.workspaceInvitation.findUniqueOrThrow({
      where: { id: invite.id },
      select: { status: true },
    });
    assert.equal(stored.status, "EXPIRED");
  });

  it("rejects accept when the seat limit is reached and keeps invitation PENDING", async () => {
    const seatWorkspace = await prisma.workspace.create({
      data: {
        name: `Seat Limit ${suffix}`,
        slug: `seat-limit-${suffix}`,
        plan: "FREE",
      },
    });

    const seatOwner = await prisma.user.create({
      data: {
        name: "Seat Owner",
        email: email("seat-owner"),
        passwordHash: "test-hash",
      },
    });
    userIds.push(seatOwner.id);

    await prisma.workspaceMember.create({
      data: {
        workspaceId: seatWorkspace.id,
        userId: seatOwner.id,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    const inviteEmail = email("seat-invitee");
    const created = await createWorkspaceInvitation({
      workspaceId: seatWorkspace.id,
      workspaceName: seatWorkspace.name,
      workspacePlan: "FREE",
      inviterUserId: seatOwner.id,
      inviterRole: "OWNER",
      email: inviteEmail,
      role: "MEMBER",
    });

    const fillers = [];
    for (let index = 0; index < 4; index += 1) {
      const filler = await prisma.user.create({
        data: {
          name: `Seat Filler ${index}`,
          email: email(`seat-filler-${index}`),
          passwordHash: "test-hash",
        },
      });
      userIds.push(filler.id);
      fillers.push(filler);
      await prisma.workspaceMember.create({
        data: {
          workspaceId: seatWorkspace.id,
          userId: filler.id,
          role: "MEMBER",
          status: "ACTIVE",
        },
      });
    }

    const invitee = await prisma.user.create({
      data: {
        name: "Seat Invitee",
        email: inviteEmail,
        passwordHash: "test-hash",
      },
    });
    userIds.push(invitee.id);

    const token = created.invitation.acceptUrl.split("/invite/")[1]!;

    await assert.rejects(
      () => acceptWorkspaceInvitation(token, publicUser(invitee)),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.statusCode, 409);
        assert.equal(error.code, MEMBER_LIMIT_REACHED_CODE);
        return true;
      },
    );

    const invite = await prisma.workspaceInvitation.findUniqueOrThrow({
      where: { id: created.invitation.id },
      select: { status: true },
    });
    assert.equal(invite.status, "PENDING");

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: seatWorkspace.id, userId: invitee.id },
    });
    assert.equal(membership, null);

    await prisma.workspace.delete({ where: { id: seatWorkspace.id } });
  });

  it("counts active members and PENDING invitations when creating an invite", async () => {
    const inviteWorkspace = await prisma.workspace.create({
      data: {
        name: `Invite Seat Limit ${suffix}`,
        slug: `invite-seat-limit-${suffix}`,
        plan: "FREE",
      },
    });
    const inviteOwner = await prisma.user.create({
      data: {
        name: "Invite Seat Owner",
        email: email("invite-seat-owner"),
        passwordHash: "test-hash",
      },
    });
    userIds.push(inviteOwner.id);
    await prisma.workspaceMember.create({
      data: {
        workspaceId: inviteWorkspace.id,
        userId: inviteOwner.id,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    for (let index = 0; index < 3; index += 1) {
      const filler = await prisma.user.create({
        data: {
          name: `Invite Seat Filler ${index}`,
          email: email(`invite-seat-filler-${index}`),
          passwordHash: "test-hash",
        },
      });
      userIds.push(filler.id);
      await prisma.workspaceMember.create({
        data: {
          workspaceId: inviteWorkspace.id,
          userId: filler.id,
          role: "MEMBER",
          status: "ACTIVE",
        },
      });
    }

    await createWorkspaceInvitation({
      workspaceId: inviteWorkspace.id,
      workspaceName: inviteWorkspace.name,
      workspacePlan: "FREE",
      inviterUserId: inviteOwner.id,
      inviterRole: "OWNER",
      email: email("invite-seat-pending"),
      role: "MEMBER",
    });

    await assert.rejects(
      () =>
        createWorkspaceInvitation({
          workspaceId: inviteWorkspace.id,
          workspaceName: inviteWorkspace.name,
          workspacePlan: "FREE",
          inviterUserId: inviteOwner.id,
          inviterRole: "OWNER",
          email: email("invite-seat-overflow"),
          role: "MEMBER",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.statusCode, 409);
        assert.equal(error.code, MEMBER_LIMIT_REACHED_CODE);
        return true;
      },
    );

    await prisma.workspace.delete({ where: { id: inviteWorkspace.id } });
  });

  it("OWNER can resend a pending invitation with a new token and extended expiry", async () => {
    const created = await createWorkspaceInvitation({
      workspaceId,
      workspaceName,
      workspacePlan: "ENTERPRISE",
      inviterUserId: ownerId,
      inviterRole: "OWNER",
      email: email("resend-ok"),
      role: "MEMBER",
    });

    const oldToken = created.invitation.acceptUrl.split("/invite/")[1]!;
    const nearExpiry = new Date(Date.now() + 60_000);

    await prisma.workspaceInvitation.update({
      where: { id: created.invitation.id },
      data: {
        expiresAt: nearExpiry,
        updatedAt: new Date(Date.now() - 61_000),
      },
    });

    const resent = await resendWorkspaceInvitation({
      workspaceId,
      workspaceName,
      invitationId: created.invitation.id,
      actorUserId: ownerId,
      actorRole: "OWNER",
    });

    const newToken = resent.invitation.acceptUrl.split("/invite/")[1]!;
    assert.notEqual(newToken, oldToken);
    assert.equal(resent.acceptUrl, resent.invitation.acceptUrl);
    assert.match(resent.acceptUrl, /\/invite\//);
    assert.ok(resultExpiresFarEnough(resent.invitation.expiresAt));
    assert.equal(resent.emailSent, false);
    assert.ok(resent.deliveryMode === "dev" || resent.deliveryMode === "console");

    const stored = await prisma.workspaceInvitation.findUniqueOrThrow({
      where: { id: created.invitation.id },
      select: { token: true, expiresAt: true, status: true },
    });
    assert.equal(stored.token, newToken);
    assert.equal(stored.status, "PENDING");
    assert.ok(stored.expiresAt.getTime() > nearExpiry.getTime());
  });

  it("MEMBER cannot resend invitations", async () => {
    const created = await createWorkspaceInvitation({
      workspaceId,
      workspaceName,
      workspacePlan: "ENTERPRISE",
      inviterUserId: ownerId,
      inviterRole: "OWNER",
      email: email("resend-member-blocked"),
      role: "MEMBER",
    });

    await clearResendCooldown(created.invitation.id);

    await assert.rejects(
      () =>
        resendWorkspaceInvitation({
          workspaceId,
          workspaceName,
          invitationId: created.invitation.id,
          actorUserId: ownerId,
          actorRole: "MEMBER",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.statusCode, 403);
        return true;
      },
    );
  });

  it("rejects resend for invitations from another workspace", async () => {
    const created = await createWorkspaceInvitation({
      workspaceId,
      workspaceName,
      workspacePlan: "ENTERPRISE",
      inviterUserId: ownerId,
      inviterRole: "OWNER",
      email: email("resend-other-ws"),
      role: "MEMBER",
    });

    await clearResendCooldown(created.invitation.id);

    const otherWorkspace = await prisma.workspace.create({
      data: {
        name: `Other Invite WS ${suffix}`,
        slug: `other-invite-ws-${suffix}`,
        plan: "ENTERPRISE",
      },
    });

    try {
      await assert.rejects(
        () =>
          resendWorkspaceInvitation({
            workspaceId: otherWorkspace.id,
            workspaceName: otherWorkspace.name,
            invitationId: created.invitation.id,
            actorUserId: ownerId,
            actorRole: "OWNER",
          }),
        (error: unknown) => {
          assert.ok(error instanceof AuthError);
          assert.equal(error.statusCode, 404);
          return true;
        },
      );
    } finally {
      await prisma.workspace.delete({ where: { id: otherWorkspace.id } });
    }
  });

  it("invalidates the old token and accepts the new token after resend", async () => {
    const inviteEmail = email("resend-token-swap");
    const created = await createWorkspaceInvitation({
      workspaceId,
      workspaceName,
      workspacePlan: "ENTERPRISE",
      inviterUserId: ownerId,
      inviterRole: "OWNER",
      email: inviteEmail,
      role: "MEMBER",
    });

    const oldToken = created.invitation.acceptUrl.split("/invite/")[1]!;
    await clearResendCooldown(created.invitation.id);

    const resent = await resendWorkspaceInvitation({
      workspaceId,
      workspaceName,
      invitationId: created.invitation.id,
      actorUserId: ownerId,
      actorRole: "OWNER",
    });

    const newToken = resent.acceptUrl.split("/invite/")[1]!;

    await assert.rejects(
      () => getInvitationByToken(oldToken),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.statusCode, 404);
        assert.equal(error.code, "INVITATION_NO_LONGER_AVAILABLE");
        return true;
      },
    );

    const preview = await getInvitationByToken(newToken);
    assert.equal(preview.canAccept, true);
    assert.equal(preview.email, inviteEmail);

    const invitee = await prisma.user.create({
      data: {
        name: "Resend Token Invitee",
        email: inviteEmail,
        passwordHash: "test-hash",
      },
    });
    userIds.push(invitee.id);

    const accepted = await acceptWorkspaceInvitation(newToken, publicUser(invitee));
    assert.equal(accepted.workspaceId, workspaceId);
  });

  it("rejects resend for revoked, accepted, and expired invitations", async () => {
    const revoked = await createWorkspaceInvitation({
      workspaceId,
      workspaceName,
      workspacePlan: "ENTERPRISE",
      inviterUserId: ownerId,
      inviterRole: "OWNER",
      email: email("resend-revoked"),
      role: "MEMBER",
    });
    await revokeWorkspaceInvitation(workspaceId, revoked.invitation.id, "OWNER");
    await clearResendCooldown(revoked.invitation.id);

    await assert.rejects(
      () =>
        resendWorkspaceInvitation({
          workspaceId,
          workspaceName,
          invitationId: revoked.invitation.id,
          actorUserId: ownerId,
          actorRole: "OWNER",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.statusCode, 400);
        return true;
      },
    );

    const acceptedInviteEmail = email("resend-accepted");
    const acceptedCreated = await createWorkspaceInvitation({
      workspaceId,
      workspaceName,
      workspacePlan: "ENTERPRISE",
      inviterUserId: ownerId,
      inviterRole: "OWNER",
      email: acceptedInviteEmail,
      role: "MEMBER",
    });
    const acceptedInvitee = await prisma.user.create({
      data: {
        name: "Resend Accepted Invitee",
        email: acceptedInviteEmail,
        passwordHash: "test-hash",
      },
    });
    userIds.push(acceptedInvitee.id);
    const acceptToken = acceptedCreated.invitation.acceptUrl.split("/invite/")[1]!;
    await acceptWorkspaceInvitation(acceptToken, publicUser(acceptedInvitee));
    await clearResendCooldown(acceptedCreated.invitation.id);

    await assert.rejects(
      () =>
        resendWorkspaceInvitation({
          workspaceId,
          workspaceName,
          invitationId: acceptedCreated.invitation.id,
          actorUserId: ownerId,
          actorRole: "OWNER",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.statusCode, 400);
        return true;
      },
    );

    const expired = await prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email: email("resend-expired"),
        role: "MEMBER",
        token: randomBytes(24).toString("base64url"),
        invitedById: ownerId,
        status: "PENDING",
        expiresAt: new Date(Date.now() - 60_000),
        updatedAt: new Date(Date.now() - 61_000),
      },
    });

    await assert.rejects(
      () =>
        resendWorkspaceInvitation({
          workspaceId,
          workspaceName,
          invitationId: expired.id,
          actorUserId: ownerId,
          actorRole: "OWNER",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.statusCode, 400);
        return true;
      },
    );
  });

  it("rejects resend earlier than 60 seconds and allows it after cooldown", async () => {
    const created = await createWorkspaceInvitation({
      workspaceId,
      workspaceName,
      workspacePlan: "ENTERPRISE",
      inviterUserId: ownerId,
      inviterRole: "OWNER",
      email: email("resend-cooldown"),
      role: "MEMBER",
    });

    await assert.rejects(
      () =>
        resendWorkspaceInvitation({
          workspaceId,
          workspaceName,
          invitationId: created.invitation.id,
          actorUserId: ownerId,
          actorRole: "OWNER",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.statusCode, 429);
        assert.equal(error.code, INVITATION_RESEND_TOO_SOON_CODE);
        return true;
      },
    );

    await clearResendCooldown(created.invitation.id);

    const resent = await resendWorkspaceInvitation({
      workspaceId,
      workspaceName,
      invitationId: created.invitation.id,
      actorUserId: ownerId,
      actorRole: "OWNER",
    });

    assert.equal(resent.invitation.id, created.invitation.id);
    assert.ok(resent.deliveryMode === "dev" || resent.deliveryMode === "console");
    assert.equal(typeof resent.emailSent, "boolean");

    await assert.rejects(
      () =>
        resendWorkspaceInvitation({
          workspaceId,
          workspaceName,
          invitationId: created.invitation.id,
          actorUserId: ownerId,
          actorRole: "OWNER",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.code, INVITATION_RESEND_TOO_SOON_CODE);
        return true;
      },
    );
  });

  it("allows only one concurrent resend to succeed", async () => {
    const created = await createWorkspaceInvitation({
      workspaceId,
      workspaceName,
      workspacePlan: "ENTERPRISE",
      inviterUserId: ownerId,
      inviterRole: "OWNER",
      email: email("resend-race"),
      role: "MEMBER",
    });

    await clearResendCooldown(created.invitation.id);

    let emailCalls = 0;
    const originalSend = invitationEmailDelivery.send;
    invitationEmailDelivery.send = async (input) => {
      emailCalls += 1;
      // Widen the window so the losing request still races on updateMany.
      await new Promise((resolve) => setTimeout(resolve, 30));
      return originalSend(input);
    };

    try {
      const payload = {
        workspaceId,
        workspaceName,
        invitationId: created.invitation.id,
        actorUserId: ownerId,
        actorRole: "OWNER" as const,
      };

      const results = await Promise.allSettled([
        resendWorkspaceInvitation(payload),
        resendWorkspaceInvitation(payload),
      ]);

      const fulfilled = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter((result) => result.status === "rejected");

      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 1);

      const winner = fulfilled[0];
      const loser = rejected[0];
      assert.ok(winner && winner.status === "fulfilled");
      assert.ok(loser && loser.status === "rejected");
      assert.ok(loser.reason instanceof AuthError);
      assert.equal(loser.reason.statusCode, 429);
      assert.equal(loser.reason.code, INVITATION_RESEND_TOO_SOON_CODE);
      assert.equal(emailCalls, 1);

      const winnerToken = winner.value.acceptUrl.split("/invite/")[1]!;
      const stored = await prisma.workspaceInvitation.findUniqueOrThrow({
        where: { id: created.invitation.id },
        select: { token: true, status: true },
      });
      assert.equal(stored.status, "PENDING");
      assert.equal(stored.token, winnerToken);
    } finally {
      invitationEmailDelivery.send = originalSend;
    }
  });
});

function resultExpiresFarEnough(expiresAtIso: string): boolean {
  const expiresAt = new Date(expiresAtIso).getTime();
  const sixDaysMs = 6 * 24 * 60 * 60 * 1000;
  return expiresAt > Date.now() + sixDaysMs;
}
