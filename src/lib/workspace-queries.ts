import type { QueryClient } from "@tanstack/react-query";

import { AUTH_ME_QUERY_KEY } from "@/lib/auth/auth-cache";
import { getSelectedWorkspaceId, setSelectedWorkspaceId } from "@/lib/api/client";
import { NOTIFICATIONS_QUERY_KEY } from "@/lib/api/notifications";
import { switchWorkspace } from "@/lib/api/workspaces";

export const WORKSPACES_QUERY_KEY = ["workspaces"] as const;

export async function activateWorkspace(queryClient: QueryClient, workspaceId: string) {
  if (getSelectedWorkspaceId() === workspaceId) {
    return;
  }

  setSelectedWorkspaceId(workspaceId);
  await switchWorkspace(workspaceId);
  await invalidateWorkspaceScopedQueries(queryClient);
}

/**
 * Marks AI briefing stale for one workspace (all locales).
 * Does not force refetch unless the AI page is currently observing the query.
 */
export function invalidateWorkspaceAiSummaryQueries(queryClient: QueryClient, workspaceId: string) {
  return queryClient.invalidateQueries({
    queryKey: ["workspace-ai-summary", workspaceId],
  });
}

/**
 * After project/task mutations that affect workspace-derived views.
 * Invalidates lists + AI summary; React Query refetches only active observers.
 * AI summary is scoped only when workspaceId is provided.
 */
export async function invalidateWorkspaceContentQueries(
  queryClient: QueryClient,
  workspaceId: string | null | undefined,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["projects"] }),
    queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
    workspaceId ? invalidateWorkspaceAiSummaryQueries(queryClient, workspaceId) : Promise.resolve(),
  ]);
}

export async function invalidateWorkspaceScopedQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: ["projects"] }),
    queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["workspace-members"] }),
    queryClient.invalidateQueries({ queryKey: ["workspace-member-profile"] }),
    queryClient.invalidateQueries({ queryKey: ["project-members"] }),
    queryClient.invalidateQueries({ queryKey: ["workspace"] }),
    queryClient.invalidateQueries({ queryKey: ["billing"] }),
    queryClient.invalidateQueries({ queryKey: ["billing", "summary"] }),
    queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: ["workspace-ai-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["global-search"] }),
    queryClient.invalidateQueries({ queryKey: ["chat-conversations"] }),
    queryClient.invalidateQueries({ queryKey: ["chat-messages"] }),
    queryClient.invalidateQueries({ queryKey: ["chat-unread-count"] }),
  ]);
}
