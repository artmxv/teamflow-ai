export type AiProviderMessageRole = "system" | "user" | "assistant";

export type AiProviderMessage = {
  role: AiProviderMessageRole;
  content: string;
};

export type AiProviderChatInput = {
  messages: AiProviderMessage[];
  maxCompletionTokens?: number;
};

export type AiProviderUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type AiProviderChatResult = {
  content: string;
  model: string;
  usage?: AiProviderUsage;
};

export interface AiProvider {
  readonly name: string;
  chat(input: AiProviderChatInput): Promise<AiProviderChatResult>;
}

export type AiProviderErrorCode =
  | "AI_PROVIDER_NOT_CONFIGURED"
  | "AI_PROVIDER_TIMEOUT"
  | "AI_PROVIDER_RATE_LIMITED"
  | "AI_PROVIDER_AUTHENTICATION_FAILED"
  | "AI_PROVIDER_REQUEST_REJECTED"
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_PROVIDER_INVALID_RESPONSE";

/** Safe provider error: messages never contain request bodies, credentials, or upstream bodies. */
export class AiProviderError extends Error {
  constructor(
    readonly code: AiProviderErrorCode,
    message: string,
    readonly retryable: boolean,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}
