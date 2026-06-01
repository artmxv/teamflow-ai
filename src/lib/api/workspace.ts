import { apiRequest } from "./client";
import type { AuthWorkspace } from "./auth";

export interface UpdateWorkspaceInput {
  name?: string;
  industry?: string;
  teamSize?: string;
}

interface UpdateWorkspaceResponse {
  data: {
    workspace: AuthWorkspace;
  };
}

export async function updateWorkspace(input: UpdateWorkspaceInput): Promise<AuthWorkspace> {
  const response = await apiRequest<UpdateWorkspaceResponse>("/api/workspace", {
    method: "PATCH",
    body: input,
  });
  return response.data.workspace;
}
