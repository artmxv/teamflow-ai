/**
 * After OAuth fast-path (token saved, active workspace cleared, auth cache emptied)
 * we must learn the user id before reading the user-scoped persisted workspace.
 */
export function shouldIdentifyUserBeforeWorkspaceRestore(input: {
  hasRestoreUser: boolean;
  hasActiveWorkspaceId: boolean;
}): boolean {
  return !input.hasRestoreUser && !input.hasActiveWorkspaceId;
}
