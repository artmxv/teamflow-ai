import { apiRequest } from "./client";

export interface WorkspaceAiMetrics {
  totalProjects: number;
  activeProjects: number;
  totalTasks: number;
  openTasks: number;
  completedTasks: number;
  urgentTasks: number;
  highPriorityTasks: number;
  reviewTasks: number;
  overdueTasks: number;
}

export interface WorkspaceAiSummary {
  overview: string;
  highlights: string[];
  risks: string[];
  recommendedNextActions: string[];
  standupSummary: string;
  metrics: WorkspaceAiMetrics;
}

export interface WorkspaceAiSummaryApiResponse {
  data: WorkspaceAiSummary;
}

export async function fetchWorkspaceAiSummary(locale?: string) {
  const response = await apiRequest<WorkspaceAiSummaryApiResponse>("/api/ai/workspace-summary", {
    method: "POST",
    body: locale ? { locale } : undefined,
  });
  return response.data;
}
