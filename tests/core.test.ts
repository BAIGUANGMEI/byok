import { describe, expect, it, beforeEach } from "vitest";
import { encryptSecret, decryptSecret } from "@/lib/crypto/encrypt";
import { createRelayKey, hashRelayKey } from "@/lib/crypto/hash";
import { RelayError } from "@/lib/internal/errors";
import { estimateTokensFromText } from "@/lib/internal/token-estimator";
import { parseAnthropicRequest } from "@/lib/protocols/anthropic/parse-request";
import { formatAnthropicResponse } from "@/lib/protocols/anthropic/format-response";
import { formatOpenAIResponse } from "@/lib/protocols/openai/format-response";
import { parseOpenAIRequest } from "@/lib/protocols/openai/parse-request";
import { resolveModelFromRecords } from "@/lib/router/resolve-model";
import { shouldFallback } from "@/lib/router/should-fallback";
import type { InternalChatResponse } from "@/lib/internal/types";

beforeEach(() => {
  process.env.AUTH_SECRET = "x".repeat(32);
  process.env.ENCRYPTION_KEY_BASE64 = Buffer.from("a".repeat(32)).toString("base64");
  process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
  process.env.ADMIN_EMAIL = "admin@example.com";
  process.env.ADMIN_PASSWORD = "password";
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

  it("formats OpenAI and Anthropic responses", () => {
    const response: InternalChatResponse = {
      id: "msg_1",
      model: "coding",
      resolvedModel: "coding",
      sourceId: "source",
      upstreamModel: "upstream",
      content: [{ type: "text", text: "hello" }],
      finishReason: "length",
      usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    };
    expect(formatOpenAIResponse(response, "coding")).toMatchObject({
      choices: [{ finish_reason: "length" }],
      usage: { total_tokens: 3 },
    });
    expect(formatAnthropicResponse(response, "coding")).toMatchObject({
      stop_reason: "max_tokens",
      usage: { input_tokens: 1, output_tokens: 2 },
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
