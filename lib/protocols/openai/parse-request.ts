import { randomUUID } from "node:crypto";
import { imageSourceFromOpenAIUrl } from "@/lib/internal/images";
import { RelayError } from "@/lib/internal/errors";
import type { InternalChatRequest, InternalContentBlock, InternalMessage, InternalToolCall } from "@/lib/internal/types";

type OpenAIMessage = {
  role?: string;
  content?: unknown;
  name?: string;
  tool_call_id?: string;
  tool_calls?: unknown;
  reasoning_content?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function objectWithout(source: Record<string, unknown>, keys: string[]): Record<string, unknown> | undefined {
  const ignored = new Set(keys);
  const output = Object.fromEntries(Object.entries(source).filter(([key]) => !ignored.has(key)));
  return Object.keys(output).length ? output : undefined;
}

function parseContent(content: unknown): InternalContentBlock[] {
  if (typeof content === "string") return [{ type: "text", text: content }];
  if (!Array.isArray(content)) return [{ type: "text", text: "" }];

  return content.flatMap((item): InternalContentBlock[] => {
    if (!isRecord(item)) return [];
    const block = item;
    if (block.type === "text" && typeof block.text === "string") {
      return [{ type: "text", text: block.text, raw: objectWithout(block, ["type", "text"]) }];
    }
    if (block.type === "image_url") {
      const image = block.image_url as { url?: string } | undefined;
      if (image?.url) {
        return [{ type: "image", source: imageSourceFromOpenAIUrl(image.url), raw: objectWithout(block, ["type", "image_url"]) }];
      }
    }
    return [{ type: "raw", content: block }];
  });
}

function parseStop(stop: unknown): string[] | undefined {
  if (typeof stop === "string") return [stop];
  if (Array.isArray(stop)) return stop.filter((item): item is string => typeof item === "string");
  return undefined;
}

function parseToolCalls(value: unknown): InternalToolCall[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const calls = value.flatMap((item): InternalToolCall[] => {
    if (!isRecord(item)) return [];
    const fn = item.function;
    if (!isRecord(fn) || typeof fn.name !== "string") return [];
    return [
      {
        id: typeof item.id === "string" ? item.id : `call_${randomUUID().replaceAll("-", "")}`,
        name: fn.name,
        arguments: typeof fn.arguments === "string" ? fn.arguments : JSON.stringify(fn.arguments ?? {}),
      },
    ];
  });
  return calls.length ? calls : undefined;
}

function collectExtraBody(raw: Record<string, unknown>): Record<string, unknown> | undefined {
  const handled = new Set([
    "model",
    "messages",
    "temperature",
    "top_p",
    "max_tokens",
    "max_completion_tokens",
    "stop",
    "stream",
    "tools",
    "tool_choice",
    "response_format",
  ]);
  const entries = Object.entries(raw).filter(([key]) => !handled.has(key));
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function parseOpenAIRequest(body: unknown): InternalChatRequest {
  if (!body || typeof body !== "object") {
    throw new RelayError({ type: "invalid_request_error", message: "Request body must be an object", status: 400 });
  }

  const raw = body as Record<string, unknown>;
  if (typeof raw.model !== "string" || !raw.model) {
    throw new RelayError({ type: "invalid_request_error", message: "model is required", status: 400 });
  }
  if (!Array.isArray(raw.messages)) {
    throw new RelayError({ type: "invalid_request_error", message: "messages must be an array", status: 400 });
  }

  const systemParts: string[] = [];
  const messages: InternalMessage[] = [];

  for (const message of raw.messages as OpenAIMessage[]) {
    if (!isRecord(message)) continue;
    const role = message.role;
    const content = parseContent(message.content);
    const text = content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n");

    if (role === "system" || role === "developer") {
      if (text) systemParts.push(text);
      continue;
    }

    if (!["user", "assistant", "tool"].includes(role ?? "")) {
      throw new RelayError({
        type: "invalid_request_error",
        message: `Unsupported message role: ${role}`,
        status: 400,
      });
    }

    messages.push({
      role: role as "user" | "assistant" | "tool",
      content,
      name: message.name,
      toolCallId: message.tool_call_id,
      toolCalls: parseToolCalls(message.tool_calls),
      reasoningContent: typeof message.reasoning_content === "string" ? message.reasoning_content : undefined,
      raw: objectWithout(message, ["role", "content", "name", "tool_call_id", "tool_calls", "reasoning_content"]),
    });
  }

  return {
    requestId: randomUUID(),
    inputProtocol: "openai",
    outputProtocol: "openai",
    requestedModel: raw.model,
    system: systemParts.length ? systemParts.join("\n\n") : undefined,
    messages,
    temperature: typeof raw.temperature === "number" ? raw.temperature : undefined,
    topP: typeof raw.top_p === "number" ? raw.top_p : undefined,
    maxTokens:
      typeof raw.max_tokens === "number"
        ? raw.max_tokens
        : typeof raw.max_completion_tokens === "number"
          ? raw.max_completion_tokens
          : undefined,
    stop: parseStop(raw.stop),
    stream: raw.stream === true,
    tools: Array.isArray(raw.tools) ? raw.tools : undefined,
    toolChoice: raw.tool_choice,
    responseFormat: raw.response_format,
    extraBody: collectExtraBody(raw),
    rawRequest: raw,
  };
}
