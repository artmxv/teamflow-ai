import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createAiProvider } from "./ai/ai-provider.factory.js";
import { AiProviderError } from "./ai/ai-provider.js";
import { GroqProvider } from "./ai/groq.provider.js";

const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MAX_COMPLETION_TOKENS_CAP = 4_096;

const messages = [
  { role: "system" as const, content: "System" },
  { role: "user" as const, content: "Question" },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeProvider(
  fetchImpl: typeof fetch,
  overrides: Partial<ConstructorParameters<typeof GroqProvider>[0]> = {},
) {
  return new GroqProvider({
    apiKey: "test-secret-key",
    model: "model-from-env",
    requestTimeoutMs: 100,
    maxOutputTokens: 700,
    fetchImpl,
    ...overrides,
  });
}

function assertProviderError(error: unknown, code: string): boolean {
  assert.ok(error instanceof AiProviderError);
  assert.equal(error.code, code);
  assert.equal(error.message.includes("test-secret-key"), false);
  return true;
}

describe("GroqProvider", () => {
  it("sends a non-streaming chat completion with the configured model and capped output", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const fetchImpl = (async (input: URL | RequestInfo, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedInit = init;
      return jsonResponse({
        model: "model-from-env",
        choices: [{ message: { role: "assistant", content: " Grounded answer " } }],
        usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 },
      });
    }) as typeof fetch;
    const provider = makeProvider(fetchImpl, { maxOutputTokens: 99_999 });

    const result = await provider.chat({ messages, maxCompletionTokens: 99_999 });

    assert.equal(capturedUrl, GROQ_CHAT_COMPLETIONS_URL);
    assert.equal(capturedInit?.method, "POST");
    assert.equal(capturedInit?.redirect, "error");
    assert.equal(
      (capturedInit?.headers as Record<string, string>).Authorization,
      "Bearer test-secret-key",
    );
    const body = JSON.parse(String(capturedInit?.body)) as Record<string, unknown>;
    assert.equal(body.model, "model-from-env");
    assert.equal(body.stream, false);
    assert.equal(body.max_completion_tokens, GROQ_MAX_COMPLETION_TOKENS_CAP);
    assert.equal("reasoning_effort" in body, false);
    assert.deepEqual(body.messages, messages);
    assert.equal("tools" in body, false);
    assert.equal("functions" in body, false);
    assert.equal(result.content, "Grounded answer");
    assert.equal(result.model, "model-from-env");
    assert.deepEqual(result.usage, {
      promptTokens: 10,
      completionTokens: 3,
      totalTokens: 13,
    });
  });

  it("uses low reasoning effort and a higher floor for gpt-oss models", async () => {
    let capturedBody: Record<string, unknown> | null = null;
    const fetchImpl = (async (_input: URL | RequestInfo, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return jsonResponse({ choices: [{ message: { content: "Ready" } }] });
    }) as typeof fetch;

    const result = await makeProvider(fetchImpl, {
      model: "openai/gpt-oss-120b",
      maxOutputTokens: 700,
    }).chat({ messages });

    assert.equal(result.content, "Ready");
    assert.equal(capturedBody?.model, "openai/gpt-oss-120b");
    assert.equal(capturedBody?.reasoning_effort, "low");
    assert.equal(capturedBody?.max_completion_tokens, 2_048);
  });

  it("aborts on timeout without retrying", async () => {
    let calls = 0;
    const fetchImpl = ((_input: URL | RequestInfo, init?: RequestInit) => {
      calls += 1;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }) as typeof fetch;
    const provider = makeProvider(fetchImpl, { requestTimeoutMs: 10 });

    await assert.rejects(provider.chat({ messages }), (error) =>
      assertProviderError(error, "AI_PROVIDER_TIMEOUT"),
    );
    assert.equal(calls, 1);
  });

  it("retries a transient network failure at most once", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      if (calls === 1) throw new TypeError("network failed with private details");
      return jsonResponse({ choices: [{ message: { content: "Recovered" } }] });
    }) as typeof fetch;

    const result = await makeProvider(fetchImpl).chat({ messages });
    assert.equal(result.content, "Recovered");
    assert.equal(calls, 2);
  });

  it("shares one total timeout budget across the initial attempt and retry", async () => {
    let calls = 0;
    let secondAttemptStartedAt = 0;
    let secondAttemptAbortedAt = 0;
    const fetchImpl = ((_input: URL | RequestInfo, init?: RequestInit) => {
      calls += 1;
      if (calls === 1) {
        return new Promise<Response>((_resolve, reject) => {
          setTimeout(() => reject(new TypeError("late network failure")), 60);
        });
      }
      secondAttemptStartedAt = Date.now();
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          secondAttemptAbortedAt = Date.now();
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }) as typeof fetch;

    await assert.rejects(
      makeProvider(fetchImpl, { requestTimeoutMs: 100 }).chat({ messages }),
      (error) => assertProviderError(error, "AI_PROVIDER_TIMEOUT"),
    );
    assert.equal(calls, 2);
    assert.ok(secondAttemptAbortedAt - secondAttemptStartedAt < 75);
  });

  it("retries 5xx once but never retries 4xx or 429", async () => {
    for (const testCase of [
      { status: 500, expectedCalls: 2, code: "AI_PROVIDER_UNAVAILABLE" },
      { status: 400, expectedCalls: 1, code: "AI_PROVIDER_REQUEST_REJECTED" },
      { status: 401, expectedCalls: 1, code: "AI_PROVIDER_AUTHENTICATION_FAILED" },
      { status: 429, expectedCalls: 1, code: "AI_PROVIDER_RATE_LIMITED" },
    ]) {
      let calls = 0;
      const fetchImpl = (async () => {
        calls += 1;
        return jsonResponse({ error: { message: "upstream secret details" } }, testCase.status);
      }) as typeof fetch;

      await assert.rejects(makeProvider(fetchImpl).chat({ messages }), (error) =>
        assertProviderError(error, testCase.code),
      );
      assert.equal(calls, testCase.expectedCalls);
    }
  });

  it("normalizes invalid JSON and empty completions", async () => {
    const invalidJson = (async () => new Response("not-json", { status: 200 })) as typeof fetch;
    await assert.rejects(makeProvider(invalidJson).chat({ messages }), (error) =>
      assertProviderError(error, "AI_PROVIDER_INVALID_RESPONSE"),
    );

    const emptyCompletion = (async () =>
      jsonResponse({ choices: [{ message: { content: "   " } }] })) as typeof fetch;
    await assert.rejects(makeProvider(emptyCompletion).chat({ messages }), (error) =>
      assertProviderError(error, "AI_PROVIDER_INVALID_RESPONSE"),
    );

    let primitiveCalls = 0;
    const primitiveResponse = (async () => {
      primitiveCalls += 1;
      return jsonResponse(null);
    }) as typeof fetch;
    await assert.rejects(makeProvider(primitiveResponse).chat({ messages }), (error) =>
      assertProviderError(error, "AI_PROVIDER_INVALID_RESPONSE"),
    );
    assert.equal(primitiveCalls, 1);
  });
});

describe("AI provider factory", () => {
  it("returns null when the provider is disabled", () => {
    assert.equal(
      createAiProvider({
        provider: "disabled",
        requestTimeoutMs: 12_000,
        maxOutputTokens: 700,
      }),
      null,
    );
  });

  it("does not validate optional Groq config until the provider is used", async () => {
    const provider = createAiProvider({
      provider: "groq",
      requestTimeoutMs: 12_000,
      maxOutputTokens: 700,
    });
    assert.ok(provider);

    await assert.rejects(provider.chat({ messages }), (error) =>
      assertProviderError(error, "AI_PROVIDER_NOT_CONFIGURED"),
    );
  });
});
