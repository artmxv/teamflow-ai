/**
 * Membership validation rules used by Socket.IO auth (pure, no DB).
 * Full DB checks live in resolveSocketWorkspaceMembership.
 */

export type MembershipRow = {
  userId: string;
  workspaceId: string;
  status: "ACTIVE" | "INVITED" | "REMOVED" | string;
};

export function validateActiveWorkspaceMembership(input: {
  userId: string;
  workspaceId: string | null | undefined;
  memberships: MembershipRow[];
}): "ok" | "missing_workspace" | "forbidden" {
  if (!input.workspaceId) {
    return "missing_workspace";
  }

  const match = input.memberships.find(
    (row) =>
      row.userId === input.userId &&
      row.workspaceId === input.workspaceId &&
      row.status === "ACTIVE",
  );

  return match ? "ok" : "forbidden";
}
