import { env } from "../../config/env.js";
import type { AiProvider } from "./ai-provider.js";
import { GroqProvider } from "./groq.provider.js";

export type AiProviderFactoryConfig = {
  provider: "disabled" | "groq";
  groqApiKey?: string;
  groqModel?: string;
  requestTimeoutMs: number;
  maxOutputTokens: number;
};

/** Returns null when AI is disabled. Groq credentials are validated lazily on first chat call. */
export function createAiProvider(config: AiProviderFactoryConfig): AiProvider | null {
  if (config.provider === "disabled") {
    return null;
  }

  return new GroqProvider({
    apiKey: config.groqApiKey,
    model: config.groqModel,
    requestTimeoutMs: config.requestTimeoutMs,
    maxOutputTokens: config.maxOutputTokens,
  });
}

export function createConfiguredAiProvider(): AiProvider | null {
  return createAiProvider({
    provider: env.AI_PROVIDER,
    groqApiKey: env.GROQ_API_KEY,
    groqModel: env.GROQ_MODEL,
    requestTimeoutMs: env.AI_REQUEST_TIMEOUT_MS,
    maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
  });
}
