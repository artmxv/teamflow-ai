import type { TKey } from "@/lib/i18n";

export type AiAssistantAsk = "summary" | "attention" | "deadlines";

export type AiAssistantSearch = {
  ask?: AiAssistantAsk;
};

const AI_ASK_VALUES = new Set<AiAssistantAsk>(["summary", "attention", "deadlines"]);

/** Maps Dashboard / deep-link ask keys to localized Copilot prompt strings. */
export const AI_ASK_SUGGESTION_KEYS = {
  summary: "ai.suggestionSummary",
  attention: "ai.suggestionAttention",
  deadlines: "ai.suggestionDeadlines",
} as const satisfies Record<AiAssistantAsk, TKey>;

export function parseAiAssistantAsk(value: unknown): AiAssistantAsk | undefined {
  return typeof value === "string" && AI_ASK_VALUES.has(value as AiAssistantAsk)
    ? (value as AiAssistantAsk)
    : undefined;
}
