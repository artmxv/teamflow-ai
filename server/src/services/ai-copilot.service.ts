import { AiProviderError, type AiProvider } from "../providers/ai/ai-provider.js";
import { createConfiguredAiProvider } from "../providers/ai/ai-provider.factory.js";
import { getAiWorkspaceContext } from "./ai-context.service.js";
import { buildAiCopilotPrompt, type AiCopilotHistoryMessage } from "./ai-prompt.js";
import { parseAiLocale, type AiLocale } from "./ai-copy.js";
import { getWorkspaceAiSummary, type WorkspaceAiSummary } from "./ai.service.js";
import type { WorkspaceRole } from "./workspace-context.service.js";
import {
  logAiCopilotOperationalEvent,
  safelyLogAiCopilotOperationalEvent,
  type AiCopilotOperationalEvent,
  type AiCopilotOperationalLogger,
} from "./ai-copilot-operations.js";

export type AiCopilotChatInput = {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  message: string;
  locale: AiLocale;
  history: AiCopilotHistoryMessage[];
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

export type AiCopilotResponse = AiCopilotLlmResponse | AiCopilotFallbackResponse;

type AiCopilotDependencies = {
  createProvider: () => AiProvider | null;
  getSummary: typeof getWorkspaceAiSummary;
  getContext: typeof getAiWorkspaceContext;
  now: () => Date;
  clockMs: () => number;
  logEvent: AiCopilotOperationalLogger;
};

const defaultDependencies: AiCopilotDependencies = {
  createProvider: createConfiguredAiProvider,
  getSummary: getWorkspaceAiSummary,
  getContext: getAiWorkspaceContext,
  now: () => new Date(),
  clockMs: () => Date.now(),
  logEvent: logAiCopilotOperationalEvent,
};

function providerFallbackReason(error: unknown): string {
  return error instanceof AiProviderError ? error.code : "AI_PROVIDER_ERROR";
}

function buildFallbackAnswer(summary: WorkspaceAiSummary, locale: AiLocale): string {
  const risks = summary.risks.slice(0, 2).join(" ");
  const actions = summary.recommendedNextActions.slice(0, 2).join(" ");
  const parts = [summary.overview, risks, actions].filter((part) => part.trim().length > 0);
  const prefix =
    locale === "ru"
      ? "Сейчас доступна проверенная локальная сводка по вашему рабочему пространству."
      : "A verified local summary of your workspace is available right now.";
  return [prefix, ...parts].join("\n\n");
}

function fallbackResponse(
  summary: WorkspaceAiSummary,
  locale: AiLocale,
  asOf: string,
): AiCopilotFallbackResponse {
  return {
    answer: buildFallbackAnswer(summary, locale),
    mode: "fallback",
    asOf,
    fallbackSummary: summary,
  };
}

/** Read-only Copilot orchestration. Only provider failures degrade to deterministic output. */
export async function getAiCopilotChatResponse(
  input: AiCopilotChatInput,
  dependencyOverrides: Partial<AiCopilotDependencies> = {},
): Promise<AiCopilotResponse> {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const startedAtMs = dependencies.clockMs();
  const now = dependencies.now();
  const locale = parseAiLocale(input.locale);
  const asOf = now.toISOString();

  const logResult = (event: Omit<AiCopilotOperationalEvent, "event" | "latencyMs">) => {
    safelyLogAiCopilotOperationalEvent(dependencies.logEvent, {
      event: "ai_copilot_request",
      latencyMs: Math.max(0, Math.round(dependencies.clockMs() - startedAtMs)),
      ...event,
    });
  };

  const summary = await dependencies.getSummary(
    input.workspaceId,
    input.userId,
    input.role,
    locale,
    now,
  );

  let provider: AiProvider | null;
  try {
    provider = dependencies.createProvider();
  } catch {
    logResult({
      provider: "unknown",
      mode: "fallback",
      reasonCode: "AI_PROVIDER_FACTORY_ERROR",
    });
    return fallbackResponse(summary, locale, asOf);
  }

  if (!provider) {
    logResult({
      provider: "disabled",
      mode: "fallback",
      reasonCode: "AI_PROVIDER_DISABLED",
    });
    return fallbackResponse(summary, locale, asOf);
  }

  const context = await dependencies.getContext(
    input.workspaceId,
    input.userId,
    input.role,
    {},
    now,
  );

  const messages = buildAiCopilotPrompt({
    context,
    question: input.message,
    history: input.history,
    locale,
  });

  try {
    const completion = await provider.chat({ messages });
    const answer = completion.content.trim();
    if (!answer) {
      logResult({
        provider: provider.name,
        mode: "fallback",
        reasonCode: "AI_PROVIDER_EMPTY_COMPLETION",
        context: {
          projectsIncluded: context.metadata.projectsIncluded,
          tasksIncluded: context.metadata.tasksIncluded,
          truncated: context.metadata.contextTruncated,
        },
      });
      return fallbackResponse(summary, locale, asOf);
    }
    const responseContext = {
      projectsIncluded: context.metadata.projectsIncluded,
      tasksIncluded: context.metadata.tasksIncluded,
      truncated: context.metadata.contextTruncated,
    };
    logResult({
      provider: provider.name,
      mode: "llm",
      context: responseContext,
      ...(completion.usage ? { usage: completion.usage } : {}),
    });
    return {
      answer,
      mode: "llm",
      asOf,
      context: responseContext,
    };
  } catch (error) {
    logResult({
      provider: provider.name,
      mode: "fallback",
      reasonCode: providerFallbackReason(error),
      context: {
        projectsIncluded: context.metadata.projectsIncluded,
        tasksIncluded: context.metadata.tasksIncluded,
        truncated: context.metadata.contextTruncated,
      },
    });
    return fallbackResponse(summary, locale, asOf);
  }
}
