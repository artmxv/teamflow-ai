/** Stable Socket.IO room names for chat realtime (single-instance). */

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function workspaceRoom(workspaceId: string): string {
  return `workspace:${workspaceId}`;
}
