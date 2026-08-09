import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AiProviderError, type AiProvider } from "../providers/ai/ai-provider.js";
import type { AiWorkspaceContext } from "./ai-context.service.js";
import { getAiCopilotChatResponse } from "./ai-copilot.service.js";
import type { WorkspaceAiSummary } from "./ai.service.js";
import type { AiCopilotOperationalEvent } from "./ai-copilot-operations.js";

const NOW = new Date("2026-08-09T12:00:00.000Z");
const summary: WorkspaceAiSummary = {
  overview: "2 projects and 3 open tasks.",
  highlights: ["One task completed."],
  risks: ["One task is overdue."],
  recommendedNextActions: ["Review the overdue task."],
  standupSummary: "Work is in progress.",
  metrics: {
    totalProjects: 2,
    activeProjects: 1,
    totalTasks: 4,
    openTasks: 3,
    completedTasks: 1,
    urgentTasks: 1,
    reviewTasks: 0,
    overdueTasks: 1,
  },
};

const context: AiWorkspaceContext = {
  workspace: { id: "workspace-allowed", name: "Allowed workspace" },
  projects: [
    {
      id: "project-allowed",
      name: "Allowed project",
      description: "Visible description",
      status: "ACTIVE",
      dueDate: null,
    },
  ],
  tasks: [
    {
      id: "task-allowed",
      key: "ALLOW-1",
      title: "Allowed task",
      description: null,
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueDate: null,
      updatedAt: NOW.toISOString(),
      project: { id: "project-allowed", name: "Allowed project" },
      assignees: ["Visible Person"],
    },
  ],
  metadata: {
    generatedAt: NOW.toISOString(),
    projectsIncluded: 1,
    tasksIncluded: 1,
    contextTruncated: true,
    truncationReasons: ["task-count"],
  },
};

function dependencies(provider: AiProvider | null) {
  return {
    createProvider: () => provider,
    getSummary: async () => summary,
    getContext: async () => context,
    now: () => NOW,
    clockMs: () => NOW.getTime(),
    logEvent: () => undefined,
  };
}

const baseInput = {
  workspaceId: "workspace-allowed",
  userId: "user-allowed",
  role: "MEMBER" as const,
  message: "What needs attention?",
  locale: "en" as const,
  history: [],
};

describe("getAiCopilotChatResponse", () => {
  it("returns a normalized LLM response and sends ACL-safe context plus history", async () => {
    let receivedMessages: Parameters<AiProvider["chat"]>[0]["messages"] = [];
    const provider: AiProvider = {
      name: "test",
      async chat(input) {
        receivedMessages = input.messages;
        return { content: " Review ALLOW-1 first. ", model: "test-model" };
      },
    };
    let contextArgs: unknown[] = [];

    const result = await getAiCopilotChatResponse(
      {
        ...baseInput,
        history: [{ role: "assistant", content: "Previous answer" }],
      },
      {
        ...dependencies(provider),
        getContext: async (...args) => {
          contextArgs = args;
          return context;
        },
      },
    );

    assert.deepEqual(contextArgs.slice(0, 3), ["workspace-allowed", "user-allowed", "MEMBER"]);
    assert.deepEqual(result, {
      answer: "Review ALLOW-1 first.",
      mode: "llm",
      asOf: NOW.toISOString(),
      context: { projectsIncluded: 1, tasksIncluded: 1, truncated: true },
    });
    const serializedPrompt = JSON.stringify(receivedMessages);
    assert.ok(serializedPrompt.includes("workspace-allowed"));
    assert.ok(serializedPrompt.includes("Previous answer"));
    assert.equal(serializedPrompt.includes("workspace-foreign"), false);
  });

  it("uses deterministic fallback when the provider is disabled", async () => {
    let contextRequested = false;
    const result = await getAiCopilotChatResponse(baseInput, {
      ...dependencies(null),
      getContext: async () => {
        contextRequested = true;
        return context;
      },
    });
    assert.equal(result.mode, "fallback");
    assert.equal(result.asOf, NOW.toISOString());
    assert.deepEqual(result.fallbackSummary, summary);
    assert.match(result.answer, /verified local summary/i);
    assert.equal(contextRequested, false);
  });

  for (const [label, error] of [
    ["timeout", new AiProviderError("AI_PROVIDER_TIMEOUT", "AI provider request timed out", false)],
    [
      "429",
      new AiProviderError(
        "AI_PROVIDER_RATE_LIMITED",
        "AI provider rate limit exceeded",
        false,
        429,
      ),
    ],
    ["unexpected provider error", new Error("provider transport failed")],
  ] as const) {
    it(`uses deterministic fallback on provider ${label}`, async () => {
      const provider: AiProvider = {
        name: "test",
        async chat() {
          throw error;
        },
      };
      const result = await getAiCopilotChatResponse(baseInput, dependencies(provider));
      assert.equal(result.mode, "fallback");
      assert.deepEqual(result.fallbackSummary, summary);
    });
  }

  it("keeps RU and EN fallback copy localized", async () => {
    const en = await getAiCopilotChatResponse(baseInput, dependencies(null));
    const ru = await getAiCopilotChatResponse(
      { ...baseInput, locale: "ru", message: "Что важно?" },
      {
        ...dependencies(null),
        getSummary: async () => ({ ...summary, overview: "Есть срочная задача." }),
      },
    );
    assert.match(en.answer, /^A verified local summary/);
    assert.match(ru.answer, /^Сейчас доступна проверенная локальная сводка/);
  });

  it("does not hide workspace/context failures behind fallback", async () => {
    const provider: AiProvider = {
      name: "test",
      async chat() {
        return { content: "Unused", model: "test" };
      },
    };
    await assert.rejects(
      getAiCopilotChatResponse(baseInput, {
        ...dependencies(provider),
        getContext: async () => {
          throw new Error("database unavailable");
        },
      }),
      /database unavailable/,
    );
  });

  it("logs only allowlisted operational metadata, never request or workspace content", async () => {
    const events: AiCopilotOperationalEvent[] = [];
    const sensitiveContext: AiWorkspaceContext = {
      ...context,
      workspace: { ...context.workspace, name: "PRIVATE WORKSPACE SNAPSHOT" },
      projects: [
        {
          ...context.projects[0]!,
          description: "PRIVATE PROJECT DESCRIPTION",
        },
      ],
    };
    const provider: AiProvider = {
      name: "groq",
      async chat() {
        return {
          content: "PRIVATE FULL AI ANSWER",
          model: "configured-model",
          usage: { promptTokens: 120, completionTokens: 25, totalTokens: 145 },
        };
      },
    };

    await getAiCopilotChatResponse(
      {
        ...baseInput,
        message: "PRIVATE USER MESSAGE",
        history: [{ role: "user", content: "PRIVATE HISTORY CONTENT" }],
      },
      {
        ...dependencies(provider),
        getContext: async () => sensitiveContext,
        clockMs: (() => {
          const values = [1_000, 1_025];
          return () => values.shift() ?? 1_025;
        })(),
        logEvent: (event) => events.push(event),
      },
    );

    assert.deepEqual(events, [
      {
        event: "ai_copilot_request",
        provider: "groq",
        mode: "llm",
        latencyMs: 25,
        context: { projectsIncluded: 1, tasksIncluded: 1, truncated: true },
        usage: { promptTokens: 120, completionTokens: 25, totalTokens: 145 },
      },
    ]);
    const serialized = JSON.stringify(events);
    for (const forbidden of [
      "PRIVATE USER MESSAGE",
      "PRIVATE HISTORY CONTENT",
      "PRIVATE WORKSPACE SNAPSHOT",
      "PRIVATE PROJECT DESCRIPTION",
      "PRIVATE FULL AI ANSWER",
      "GROQ_API_KEY",
      "Authorization",
    ]) {
      assert.equal(serialized.includes(forbidden), false);
    }
  });

  it("logs a safe provider reason code when upstream 429 falls back", async () => {
    const events: AiCopilotOperationalEvent[] = [];
    const provider: AiProvider = {
      name: "groq",
      async chat() {
        throw new AiProviderError(
          "AI_PROVIDER_RATE_LIMITED",
          "upstream detail must not be logged",
          false,
          429,
        );
      },
    };
    const result = await getAiCopilotChatResponse(baseInput, {
      ...dependencies(provider),
      logEvent: (event) => events.push(event),
    });
    assert.equal(result.mode, "fallback");
    assert.equal(events[0]?.reasonCode, "AI_PROVIDER_RATE_LIMITED");
    assert.equal(JSON.stringify(events).includes("upstream detail"), false);
  });
});
