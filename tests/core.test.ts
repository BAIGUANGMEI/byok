import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encryptSecret, decryptSecret } from "@/lib/crypto/encrypt";
import { createRelayKey, hashRelayKey } from "@/lib/crypto/hash";
import { RelayError } from "@/lib/internal/errors";
import { estimateTokensFromText } from "@/lib/internal/token-estimator";
import { parseAnthropicRequest } from "@/lib/protocols/anthropic/parse-request";
import { formatAnthropicResponse } from "@/lib/protocols/anthropic/format-response";
import { formatOpenAIResponse } from "@/lib/protocols/openai/format-response";
import { formatOpenAIStreamEvent } from "@/lib/protocols/openai/format-stream";
import { parseOpenAIRequest } from "@/lib/protocols/openai/parse-request";
import { internalMessagesToAnthropic } from "@/lib/providers/anthropic-compatible";
import { fetchWithImageUrlFallback } from "@/lib/providers/image-url-fallback";
import { buildProviderAuthHeaders } from "@/lib/providers/mimo";
import {
  buildOpenAICompatibleBody,
  internalMessagesToOpenAI,
  OpenAICompatibleAdapter,
} from "@/lib/providers/openai-compatible";
import { resolveModelFromRecords } from "@/lib/router/resolve-model";
import { shouldFallback } from "@/lib/router/should-fallback";
import type { InternalChatResponse } from "@/lib/internal/types";
import type { ProviderInvokeContext } from "@/lib/providers/types";

beforeEach(() => {
  process.env.AUTH_SECRET = "x".repeat(32);
  process.env.ENCRYPTION_KEY_BASE64 = Buffer.from("a".repeat(32)).toString("base64");
  process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
  process.env.ADMIN_EMAIL = "admin@example.com";
  process.env.ADMIN_PASSWORD = "password";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("protocol parsing and formatting", () => {
  it("parses OpenAI chat requests", () => {
    const request = parseOpenAIRequest({
      model: "coding",
      messages: [
        { role: "system", content: "system" },
        { role: "developer", content: "developer" },
        { role: "user", content: "hello" },
      ],
      stream: true,
      max_tokens: 10,
    });
    expect(request.system).toBe("system\n\ndeveloper");
    expect(request.messages).toHaveLength(1);
    expect(request.stream).toBe(true);
    expect(request.maxTokens).toBe(10);
  });

  it("parses Anthropic messages requests", () => {
    const request = parseAnthropicRequest({
      model: "smart",
      system: "system",
      messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
      max_tokens: 12,
    });
    expect(request.system).toBe("system");
    expect(request.maxTokens).toBe(12);
    expect(request.messages[0]?.content[0]).toEqual({ type: "text", text: "hello" });
  });

  it("preserves Anthropic image sources for upstream Anthropic requests", () => {
    const request = parseAnthropicRequest({
      model: "vision",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/png", data: "abc123" },
            },
            { type: "text", text: "Describe this image." },
          ],
        },
      ],
      max_tokens: 64,
    });

    expect(request.messages[0]?.content[0]).toEqual({
      type: "image",
      source: { type: "base64", mediaType: "image/png", data: "abc123" },
    });
    expect(internalMessagesToAnthropic(request.messages)[0]?.content).toEqual([
      {
        type: "image",
        source: { type: "base64", media_type: "image/png", data: "abc123" },
      },
      { type: "text", text: "Describe this image." },
    ]);
  });

  it("converts OpenAI image URLs to Anthropic image sources", () => {
    const request = parseOpenAIRequest({
      model: "vision",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this image." },
            {
              type: "image_url",
              image_url: { url: "data:image/jpeg;base64,abc123" },
            },
            {
              type: "image_url",
              image_url: { url: "https://example.com/image.png" },
            },
          ],
        },
      ],
    });

    expect(internalMessagesToAnthropic(request.messages)[0]?.content).toEqual([
      { type: "text", text: "Describe this image." },
      {
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: "abc123" },
      },
      {
        type: "image",
        source: { type: "url", url: "https://example.com/image.png" },
      },
    ]);
  });

  it("converts Anthropic image sources to OpenAI image URLs when possible", () => {
    const request = parseAnthropicRequest({
      model: "vision",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "url", url: "https://example.com/image.webp" },
            },
          ],
        },
      ],
      max_tokens: 64,
    });

    expect(internalMessagesToOpenAI(request.messages)[0]?.content).toEqual([
      {
        type: "image_url",
        image_url: { url: "https://example.com/image.webp" },
      },
    ]);
  });

  it("uses MiMo max_completion_tokens for OpenAI-compatible upstream requests", () => {
    const request = parseAnthropicRequest({
      model: "mimo-v2.5",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "url", url: "https://example.com/image.jpg" },
            },
            { type: "text", text: "Describe this image." },
          ],
        },
      ],
      max_tokens: 1024,
    });
    const context: ProviderInvokeContext = {
      source: {
        id: "source",
        name: "MiMo",
        providerType: "mimo",
        protocol: "openai_chat",
        baseUrl: "https://api.xiaomimimo.com/v1",
        authType: "api-key",
        apiKeyEncrypted: "encrypted",
        timeoutMs: 60000,
      },
      model: {
        id: "model",
        publicModelName: "mimo-v2.5",
        upstreamModelName: "mimo-v2.5",
        sourceId: "source",
        supportsStreaming: true,
        supportsVision: true,
      },
      apiKey: "key",
      timeoutMs: 60000,
    };

    const body = buildOpenAICompatibleBody(request, context, false, false);
    expect(body.max_completion_tokens).toBe(1024);
    expect(body.max_tokens).toBeUndefined();
    expect(body.messages).toEqual([
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: "https://example.com/image.jpg" },
          },
          { type: "text", text: "Describe this image." },
        ],
      },
    ]);
  });

  it("detects MiMo max_completion_tokens from upstream model names", () => {
    const request = parseOpenAIRequest({
      model: "mimo-v2.5",
      messages: [{ role: "user", content: "hello" }],
      max_tokens: 128,
    });
    const context: ProviderInvokeContext = {
      source: {
        id: "source",
        name: "Custom",
        providerType: "openai_compatible",
        protocol: "openai_chat",
        baseUrl: "https://example.com/v1",
        authType: "bearer",
        apiKeyEncrypted: "encrypted",
        timeoutMs: 60000,
      },
      model: {
        id: "model",
        publicModelName: "mimo-v2.5",
        upstreamModelName: "mimo-v2.5",
        sourceId: "source",
        supportsStreaming: true,
      },
      apiKey: "key",
      timeoutMs: 60000,
    };

    const body = buildOpenAICompatibleBody(request, context, false, false);
    expect(body.max_completion_tokens).toBe(128);
    expect(body.max_tokens).toBeUndefined();
    expect(buildProviderAuthHeaders(context)).toEqual({ "api-key": "key" });
  });

  it("uses Kimi max_completion_tokens for OpenAI-compatible upstream requests", () => {
    const request = parseOpenAIRequest({
      model: "kimi-k2",
      messages: [{ role: "user", content: "hello" }],
      max_tokens: 256,
      prompt_cache_key: "stable-chat",
      thinking: { type: "enabled" },
    });
    const context: ProviderInvokeContext = {
      source: {
        id: "source",
        name: "Kimi",
        providerType: "kimi",
        protocol: "openai_chat",
        baseUrl: "https://api.moonshot.cn/v1",
        authType: "bearer",
        apiKeyEncrypted: "encrypted",
        timeoutMs: 60000,
      },
      model: {
        id: "model",
        publicModelName: "kimi-k2",
        upstreamModelName: "kimi-k2-latest",
        sourceId: "source",
        supportsStreaming: true,
      },
      apiKey: "key",
      timeoutMs: 60000,
    };

    const body = buildOpenAICompatibleBody(request, context, false, false);
    expect(body.max_completion_tokens).toBe(256);
    expect(body.max_tokens).toBeUndefined();
    expect(body.prompt_cache_key).toBe("stable-chat");
    expect(body.thinking).toEqual({ type: "enabled" });
  });

  it("reads Kimi cached_tokens usage from upstream responses", async () => {
    const request = parseOpenAIRequest({
      model: "kimi-k2",
      messages: [{ role: "user", content: "hello" }],
    });
    const context: ProviderInvokeContext = {
      source: {
        id: "source",
        name: "Kimi",
        providerType: "kimi",
        protocol: "openai_chat",
        baseUrl: "https://api.moonshot.cn/v1",
        authType: "bearer",
        apiKeyEncrypted: "encrypted",
        timeoutMs: 60000,
      },
      model: {
        id: "model",
        publicModelName: "kimi-k2",
        upstreamModelName: "kimi-k2-latest",
        sourceId: "source",
        supportsStreaming: true,
      },
      apiKey: "key",
      timeoutMs: 60000,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () =>
        Response.json({
          id: "chatcmpl_kimi",
          choices: [{ message: { content: "hello" }, finish_reason: "stop" }],
          usage: {
            prompt_tokens: 100,
            cached_tokens: 40,
            completion_tokens: 8,
            total_tokens: 108,
          },
        }),
      ),
    );

    const response = await new OpenAICompatibleAdapter().invokeChat(request, context);
    expect(response.usage).toEqual({
      inputTokens: 100,
      inputCacheHitTokens: 40,
      inputCacheMissTokens: 60,
      outputTokens: 8,
      totalTokens: 108,
    });
  });

  it("round-trips tool calls and reasoning across client API formats", async () => {
    const request = parseOpenAIRequest({
      model: "deepseek-reasoner",
      messages: [
        {
          role: "assistant",
          content: null,
          reasoning_content: "Need a tool.",
          tool_calls: [
            {
              id: "call_weather",
              type: "function",
              function: { name: "get_weather", arguments: "{\"city\":\"HK\"}" },
            },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "get_weather",
            parameters: { type: "object", properties: { city: { type: "string" } } },
          },
        },
      ],
    });

    expect(internalMessagesToAnthropic(request.messages)[0]?.content).toEqual([
      { type: "thinking", thinking: "Need a tool." },
      { type: "tool_use", id: "call_weather", name: "get_weather", input: { city: "HK" } },
    ]);

    const response: InternalChatResponse = {
      id: "chatcmpl_tools",
      model: "deepseek-reasoner",
      resolvedModel: "deepseek-reasoner",
      sourceId: "source",
      upstreamModel: "deepseek-reasoner",
      reasoningContent: "Need a tool.",
      content: [{ type: "tool_call", id: "call_weather", name: "get_weather", arguments: "{\"city\":\"HK\"}" }],
      finishReason: "tool_calls",
    };

    expect(formatOpenAIResponse(response, "deepseek-reasoner")).toMatchObject({
      choices: [
        {
          message: {
            content: null,
            reasoning_content: "Need a tool.",
            tool_calls: [{ function: { name: "get_weather", arguments: "{\"city\":\"HK\"}" } }],
          },
          finish_reason: "tool_calls",
        },
      ],
    });
    expect(formatAnthropicResponse(response, "deepseek-reasoner")).toMatchObject({
      content: [
        { type: "thinking", thinking: "Need a tool." },
        { type: "tool_use", id: "call_weather", name: "get_weather", input: { city: "HK" } },
      ],
      stop_reason: "tool_use",
    });
  });

  it("tries image URLs first and falls back to base64 after provider rejection", async () => {
    const request = parseAnthropicRequest({
      model: "mimo-v2.5",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "url", url: "https://example.com/image.jpg" },
            },
          ],
        },
      ],
      max_tokens: 128,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } })),
    );
    const send = vi
      .fn<(upstreamRequest: typeof request) => Promise<Response>>()
      .mockResolvedValueOnce(new Response("bad image url", { status: 400 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const response = await fetchWithImageUrlFallback(request, 60000, send);
    expect(response.ok).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[0].messages[0]?.content[0]).toEqual({
      type: "image",
      source: { type: "url", url: "https://example.com/image.jpg" },
    });
    expect(send.mock.calls[1]?.[0].messages[0]?.content[0]).toEqual({
      type: "image",
      source: { type: "base64", mediaType: "image/jpeg", data: "AQID" },
    });
  });

  it("formats OpenAI and Anthropic responses", () => {
    const response: InternalChatResponse = {
      id: "msg_1",
      model: "coding",
      resolvedModel: "coding",
      sourceId: "source",
      upstreamModel: "upstream",
      content: [{ type: "text", text: "hello" }],
      finishReason: "length",
      usage: { inputTokens: 10, inputCacheHitTokens: 6, inputCacheMissTokens: 4, outputTokens: 2, totalTokens: 12 },
    };
    expect(formatOpenAIResponse(response, "coding")).toMatchObject({
      choices: [{ finish_reason: "length" }],
      usage: {
        prompt_tokens: 10,
        total_tokens: 12,
        prompt_tokens_details: { cached_tokens: 6 },
      },
    });
    expect(formatAnthropicResponse(response, "coding")).toMatchObject({
      stop_reason: "max_tokens",
      usage: { input_tokens: 4, cache_read_input_tokens: 6, output_tokens: 2 },
    });
  });

  it("emits OpenAI streaming usage chunks with cache hit and miss fields", () => {
    const chunk = formatOpenAIStreamEvent(
      {
        type: "usage",
        usage: { inputTokens: 10, inputCacheHitTokens: 6, inputCacheMissTokens: 4, outputTokens: 2, totalTokens: 12 },
      },
      { id: "chatcmpl_test", model: "coding" },
    );

    expect(chunk).toContain('"choices":[]');
    expect(chunk).toContain('"cached_tokens":6');
    expect(chunk).not.toContain("prompt_cache_hit_tokens");
    expect(chunk).not.toContain("prompt_cache_miss_tokens");
  });

  it("exposes one internal response through both client API formats", () => {
    const response: InternalChatResponse = {
      id: "msg_dual",
      model: "coding",
      resolvedModel: "coding",
      sourceId: "source",
      upstreamModel: "upstream",
      content: [{ type: "text", text: "same model, two API shapes" }],
      finishReason: "stop",
      usage: { inputTokens: 5, outputTokens: 6, totalTokens: 11 },
    };

    expect(formatOpenAIResponse(response, "coding")).toMatchObject({
      model: "coding",
      choices: [{ message: { content: "same model, two API shapes" } }],
    });
    expect(formatAnthropicResponse(response, "coding")).toMatchObject({
      model: "coding",
      content: [{ type: "text", text: "same model, two API shapes" }],
    });
  });
});

describe("security utilities", () => {
  it("encrypts and decrypts provider keys", () => {
    const encrypted = encryptSecret("secret-key");
    expect(encrypted).not.toContain("secret-key");
    expect(decryptSecret(encrypted)).toBe("secret-key");
  });

  it("hashes relay keys", () => {
    const key = createRelayKey();
    expect(key.startsWith("sk-relay-")).toBe(true);
    expect(hashRelayKey(key)).toBe(hashRelayKey(key));
  });
});

describe("routing and fallback", () => {
  const mappings = [
    { id: "m1", publicModelName: "a", sourceId: "s1", enabled: true },
    { id: "m2", publicModelName: "b", sourceId: "s2", enabled: true },
  ];

  it("resolves direct mappings", () => {
    expect(resolveModelFromRecords("a", mappings, [], [])).toEqual([mappings[0]]);
  });

  it("resolves aliases", () => {
    expect(
      resolveModelFromRecords("fast", mappings, [{ alias: "fast", targetModel: "b", enabled: true }], []),
    ).toEqual([mappings[1]]);
  });

  it("resolves routing rules by priority", () => {
    expect(
      resolveModelFromRecords(
        "coding",
        mappings,
        [{ alias: "coding", targetModel: "a", enabled: true }],
        [
          { alias: "coding", modelMappingId: "m2", priority: 2, enabled: true },
          { alias: "coding", modelMappingId: "m1", priority: 1, enabled: true },
        ],
      ),
    ).toEqual([mappings[0], mappings[1]]);
  });

  it("falls back only for retryable provider errors", () => {
    expect(
      shouldFallback(
        new RelayError({ type: "rate_limit_error", message: "429", status: 429, retryable: true }),
      ),
    ).toBe(true);
    expect(
      shouldFallback(
        new RelayError({ type: "authentication_error", message: "401", status: 401, retryable: false }),
      ),
    ).toBe(false);
  });
});

describe("token estimator", () => {
  it("estimates ascii and cjk text", () => {
    expect(estimateTokensFromText("hello world")).toBeGreaterThan(0);
    expect(estimateTokensFromText("你好世界")).toBeGreaterThan(3);
  });
});
