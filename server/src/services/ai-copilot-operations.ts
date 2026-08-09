import type { AiProviderUsage } from "../providers/ai/ai-provider.js";

export type AiCopilotOperationalEvent = {
  event: "ai_copilot_request";
  provider: string;
  mode: "llm" | "fallback" | "rate_limited";
  latencyMs: number;
  reasonCode?: string;
  context?: {
    projectsIncluded: number;
    tasksIncluded: number;
    truncated: boolean;
  };
  usage?: AiProviderUsage;
};

export type AiCopilotOperationalLogger = (event: AiCopilotOperationalEvent) => void;

/** Logs only an allowlisted operational event; never pass prompts, answers, snapshots, or secrets. */
export const logAiCopilotOperationalEvent: AiCopilotOperationalLogger = (event) => {
  console.info("[ai-copilot]", event);
};

export function safelyLogAiCopilotOperationalEvent(
  logger: AiCopilotOperationalLogger,
  event: AiCopilotOperationalEvent,
): void {
  try {
    logger(event);
  } catch {
    // Observability must never break a Copilot request or its deterministic fallback.
  }
}
