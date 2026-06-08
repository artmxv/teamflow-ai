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
  ]);
}
