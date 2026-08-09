import { apiRequest } from "./client";

export interface WorkspaceAiMetrics {
  totalProjects: number;
  activeProjects: number;
  totalTasks: number;
  openTasks: number;
  completedTasks: number;
  urgentTasks: number;
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

export type AiCopilotHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AiCopilotChatRequest = {
  message: string;
  locale: "ru" | "en";
  history?: AiCopilotHistoryMessage[];
};

export type AiCopilotLlmResponse = {
  answer: string;
  mode: "llm";
  asOf: string;
  context: {
    projectsIncluded: number;
    tasksIncluded: number;
    truncated: boolean;
  };
};

export type AiCopilotFallbackResponse = {
  answer: string;
  mode: "fallback";
  asOf: string;
  fallbackSummary: WorkspaceAiSummary;
};

export type AiCopilotChatResponse = AiCopilotLlmResponse | AiCopilotFallbackResponse;

/** Cache key scoped by workspace and UI language (separate RU/EN entries). */
export function workspaceAiSummaryQueryKey(workspaceId: string, lang: string) {
  return ["workspace-ai-summary", workspaceId, lang] as const;
}

export async function fetchWorkspaceAiSummary(locale?: string) {
  const response = await apiRequest<WorkspaceAiSummaryApiResponse>("/api/ai/workspace-summary", {
    method: "POST",
    body: locale ? { locale } : undefined,
  });
  return response.data;
}

export async function sendAiCopilotMessage(input: AiCopilotChatRequest) {
  const response = await apiRequest<{ data: AiCopilotChatResponse }>("/api/ai/copilot/chat", {
    method: "POST",
    body: input,
  });
  return response.data;
}
