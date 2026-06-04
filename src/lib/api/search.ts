import { apiRequest } from "./client";

export type GlobalSearchResultType = "project" | "task" | "member";

export interface GlobalSearchResult {
  id: string;
  type: GlobalSearchResultType;
  title: string;
  subtitle: string | null;
  href: string;
  projectName?: string;
  avatar?: string | null;
}

export interface GlobalSearchResponse {
  projects: GlobalSearchResult[];
  tasks: GlobalSearchResult[];
  members: GlobalSearchResult[];
}

export async function searchWorkspace(query: string): Promise<GlobalSearchResponse> {
  const params = new URLSearchParams({ q: query });
  const response = await apiRequest<{ data: GlobalSearchResponse }>(`/api/search?${params}`);
  return response.data;
}
