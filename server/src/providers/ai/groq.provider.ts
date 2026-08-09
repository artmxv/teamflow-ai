import {
  AiProviderError,
  type AiProvider,
  type AiProviderChatInput,
  type AiProviderChatResult,
} from "./ai-provider.js";

const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MAX_COMPLETION_TOKENS_CAP = 4_096;

type FetchImplementation = typeof fetch;

export type GroqProviderConfig = {
  apiKey?: string;
  model?: string;
  requestTimeoutMs: number;
  maxOutputTokens: number;
  fetchImpl?: FetchImplementation;
};

type GroqChatCompletionResponse = {
  model?: unknown;
  choices?: unknown;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    total_tokens?: unknown;
  };
};

function safePositiveInteger(value: number, fallback: number, cap: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(value), cap);
}

function optionalTokenCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function providerHttpError(status: number): AiProviderError {
  if (status === 401 || status === 403) {
    return new AiProviderError(
      "AI_PROVIDER_AUTHENTICATION_FAILED",
      "AI provider authentication failed",
      false,
      status,
    );
  }
  if (status === 429) {
    return new AiProviderError(
      "AI_PROVIDER_RATE_LIMITED",
      "AI provider rate limit exceeded",
      false,
      status,
    );
  }
  if (status >= 500) {
    return new AiProviderError(
      "AI_PROVIDER_UNAVAILABLE",
      "AI provider is temporarily unavailable",
      true,
      status,
    );
  }
  return new AiProviderError(
    "AI_PROVIDER_REQUEST_REJECTED",
    "AI provider rejected the request",
    false,
    status,
  );
}

function readCompletion(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const response = payload as GroqChatCompletionResponse;
  if (!Array.isArray(response.choices)) {
    return null;
  }
  const firstChoice = response.choices[0];
  if (!firstChoice || typeof firstChoice !== "object") {
    return null;
  }
  const message = (firstChoice as { message?: unknown }).message;
  if (!message || typeof message !== "object") {
    return null;
  }
  const content = (message as { content?: unknown }).content;
  if (typeof content !== "string" || content.trim().length === 0) {
    return null;
  }
  return content.trim();
}

export class GroqProvider implements AiProvider {
  readonly name = "groq";

  private readonly fetchImpl: FetchImplementation;

  constructor(private readonly config: GroqProviderConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async chat(input: AiProviderChatInput): Promise<AiProviderChatResult> {
    const apiKey = this.config.apiKey?.trim();
    const model = this.config.model?.trim();
    if (!apiKey || !model) {
      throw new AiProviderError(
        "AI_PROVIDER_NOT_CONFIGURED",
        "AI provider is not configured",
        false,
      );
    }

    const configuredMax = safePositiveInteger(
      this.config.maxOutputTokens,
      GROQ_MAX_COMPLETION_TOKENS_CAP,
      GROQ_MAX_COMPLETION_TOKENS_CAP,
    );
    const maxCompletionTokens = safePositiveInteger(
      input.maxCompletionTokens ?? configuredMax,
      configuredMax,
      configuredMax,
    );
    const body = JSON.stringify({
      model,
      messages: input.messages,
      max_completion_tokens: maxCompletionTokens,
      stream: false,
    });
    const requestTimeoutMs = safePositiveInteger(this.config.requestTimeoutMs, 12_000, 60_000);
    const deadlineAt = Date.now() + requestTimeoutMs;

    let lastTransientError: AiProviderError | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const remainingTimeoutMs = deadlineAt - Date.now();
      if (remainingTimeoutMs <= 0) {
        throw new AiProviderError("AI_PROVIDER_TIMEOUT", "AI provider request timed out", false);
      }
      try {
        return await this.requestOnce(apiKey, model, body, remainingTimeoutMs);
      } catch (error) {
        if (!(error instanceof AiProviderError) || !error.retryable || attempt === 1) {
          throw error;
        }
        lastTransientError = error;
      }
    }

    throw (
      lastTransientError ??
      new AiProviderError("AI_PROVIDER_UNAVAILABLE", "AI provider is temporarily unavailable", true)
    );
  }

  private async requestOnce(
    apiKey: string,
    requestedModel: string,
    body: string,
    timeoutMs: number,
  ): Promise<AiProviderChatResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));

    try {
      const response = await this.fetchImpl(GROQ_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body,
        signal: controller.signal,
        redirect: "error",
      });

      if (!response.ok) {
        throw providerHttpError(response.status);
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new AiProviderError(
          "AI_PROVIDER_INVALID_RESPONSE",
          "AI provider returned an invalid response",
          false,
        );
      }

      const content = readCompletion(payload);
      if (!content) {
        throw new AiProviderError(
          "AI_PROVIDER_INVALID_RESPONSE",
          "AI provider returned an empty completion",
          false,
        );
      }

      const responsePayload = payload as GroqChatCompletionResponse;
      const responseModel =
        typeof responsePayload.model === "string" && responsePayload.model.trim()
          ? responsePayload.model
          : requestedModel;
      const promptTokens = optionalTokenCount(responsePayload.usage?.prompt_tokens);
      const completionTokens = optionalTokenCount(responsePayload.usage?.completion_tokens);
      const totalTokens = optionalTokenCount(responsePayload.usage?.total_tokens);
      const hasUsage =
        promptTokens !== undefined || completionTokens !== undefined || totalTokens !== undefined;

      return {
        content,
        model: responseModel,
        ...(hasUsage
          ? {
              usage: {
                promptTokens,
                completionTokens,
                totalTokens,
              },
            }
          : {}),
      };
    } catch (error) {
      if (error instanceof AiProviderError) {
        throw error;
      }
      if (isAbortError(error)) {
        throw new AiProviderError("AI_PROVIDER_TIMEOUT", "AI provider request timed out", false);
      }
      throw new AiProviderError(
        "AI_PROVIDER_UNAVAILABLE",
        "AI provider is temporarily unavailable",
        true,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
