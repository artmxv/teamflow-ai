import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { getAiCopilotChatResponse } from "../services/ai-copilot.service.js";
import { getWorkspaceAiSummary } from "../services/ai.service.js";
import { resolveRequestWorkspaceContext } from "../lib/workspace-request.js";
import {
  aiCopilotRateLimiter,
  type InMemoryAiCopilotRateLimiter,
} from "../services/ai-copilot-rate-limit.service.js";
import {
  logAiCopilotOperationalEvent,
  safelyLogAiCopilotOperationalEvent,
  type AiCopilotOperationalLogger,
} from "../services/ai-copilot-operations.js";

export const AI_COPILOT_MESSAGE_MAX_CHARS = 2_000;
export const AI_COPILOT_HISTORY_MAX_MESSAGES = 8;
export const AI_COPILOT_HISTORY_CONTENT_MAX_CHARS = 4_000;

const aiCopilotHistoryMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(AI_COPILOT_HISTORY_CONTENT_MAX_CHARS),
  })
  .strict();

const aiCopilotChatBodySchema = z
  .object({
    message: z.string().trim().min(1).max(AI_COPILOT_MESSAGE_MAX_CHARS),
    locale: z.enum(["ru", "en"]),
    history: z.array(aiCopilotHistoryMessageSchema).max(AI_COPILOT_HISTORY_MAX_MESSAGES).optional(),
  })
  .strict();

export function parseAiCopilotChatBody(body: unknown) {
  return aiCopilotChatBodySchema.safeParse(body);
}

function normalizeAiResponseText(value: string): string {
  return value
    .replace(/(\d+)(completed tasks?)/g, "$1 $2")
    .replace(/\.(?=[A-Z])/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getWorkspaceAiSummaryController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const context = await resolveRequestWorkspaceContext(req.userId!, req);
    if (!context) {
      res.status(403).json({ message: "Workspace not found" });
      return;
    }

    const locale = req.body?.locale ?? req.query.locale;
    const summary = await getWorkspaceAiSummary(
      context.workspaceId,
      req.userId!,
      context.role,
      locale,
    );
    res.json({
      data: {
        ...summary,
        overview: normalizeAiResponseText(summary.overview),
        highlights: summary.highlights.map(normalizeAiResponseText),
        risks: summary.risks.map(normalizeAiResponseText),
        recommendedNextActions: summary.recommendedNextActions.map(normalizeAiResponseText),
        standupSummary: normalizeAiResponseText(summary.standupSummary),
      },
    });
  } catch (error) {
    next(error);
  }
}

type AiCopilotControllerDependencies = {
  resolveWorkspaceContext: typeof resolveRequestWorkspaceContext;
  getChatResponse: typeof getAiCopilotChatResponse;
  rateLimiter: InMemoryAiCopilotRateLimiter;
  logEvent: AiCopilotOperationalLogger;
  clockMs: () => number;
};

const defaultAiCopilotControllerDependencies: AiCopilotControllerDependencies = {
  resolveWorkspaceContext: resolveRequestWorkspaceContext,
  getChatResponse: getAiCopilotChatResponse,
  rateLimiter: aiCopilotRateLimiter,
  logEvent: logAiCopilotOperationalEvent,
  clockMs: () => Date.now(),
};

export function createPostAiCopilotChatController(
  overrides: Partial<AiCopilotControllerDependencies> = {},
) {
  const dependencies = { ...defaultAiCopilotControllerDependencies, ...overrides };
  return async function postAiCopilotChat(req: Request, res: Response, next: NextFunction) {
    const startedAtMs = dependencies.clockMs();
    const parsed = parseAiCopilotChatBody(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid AI Copilot payload", issues: parsed.error.issues });
      return;
    }

    try {
      const context = await dependencies.resolveWorkspaceContext(req.userId!, req);
      if (!context) {
        res.status(403).json({ message: "Workspace not found" });
        return;
      }

      const decision = dependencies.rateLimiter.consume(
        req.userId!,
        context.workspaceId,
        dependencies.clockMs(),
      );
      if (!decision.allowed) {
        safelyLogAiCopilotOperationalEvent(dependencies.logEvent, {
          event: "ai_copilot_request",
          provider: "not_called",
          mode: "rate_limited",
          latencyMs: Math.max(0, Math.round(dependencies.clockMs() - startedAtMs)),
          reasonCode: "AI_COPILOT_RATE_LIMITED",
        });
        res.setHeader("Retry-After", String(decision.retryAfterSeconds));
        res.status(429).json({
          message:
            parsed.data.locale === "ru"
              ? "Слишком много запросов к Copilot. Повторите попытку позже."
              : "Too many Copilot requests. Please try again later.",
          code: "AI_COPILOT_RATE_LIMITED",
          retryAfterSeconds: decision.retryAfterSeconds,
        });
        return;
      }

      const result = await dependencies.getChatResponse({
        workspaceId: context.workspaceId,
        userId: req.userId!,
        role: context.role,
        message: parsed.data.message,
        locale: parsed.data.locale,
        history: parsed.data.history ?? [],
      });
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  };
}

export const postAiCopilotChatController = createPostAiCopilotChatController();
