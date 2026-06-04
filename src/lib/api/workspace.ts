import { apiRequest } from "./client";
import type { AuthWorkspace } from "./auth";

export interface UpdateWorkspaceInput {
  name: string;
  slug: string;
  industry?: string;
  teamSize?: string;
}

interface WorkspaceSettingsResponse {
  data: {
    workspace: AuthWorkspace;
  };
}

export async function fetchWorkspaceSettings(): Promise<AuthWorkspace> {
  const response = await apiRequest<WorkspaceSettingsResponse>("/api/workspace/settings");
  return response.data.workspace;
}

export async function updateWorkspace(input: UpdateWorkspaceInput): Promise<AuthWorkspace> {
  const response = await apiRequest<WorkspaceSettingsResponse>("/api/workspace/settings", {
    method: "PATCH",
    body: input,
  });
  return response.data.workspace;
}
