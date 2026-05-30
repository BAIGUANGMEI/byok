import { randomUUID } from "node:crypto";
import { imageSourceFromAnthropicSource } from "@/lib/internal/images";
import { RelayError } from "@/lib/internal/errors";
import type { InternalChatRequest, InternalContentBlock, InternalMessage, InternalToolCall } from "@/lib/internal/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function objectWithout(source: Record<string, unknown>, keys: string[]): Record<string, unknown> | undefined {
  const ignored = new Set(keys);
  const output = Object.fromEntries(Object.entries(source).filter(([key]) => !ignored.has(key)));
  return Object.keys(output).length ? output : undefined;
}

function parseAnthropicContent(content: unknown): {
  content: InternalContentBlock[];
  toolCalls?: InternalToolCall[];
  reasoningContent?: string;
} {
  if (typeof content === "string") return { content: [{ type: "text", text: content }] };
  if (!Array.isArray(content)) return { content: [{ type: "text", text: "" }] };

  const blocks: InternalContentBlock[] = [];
  const toolCalls: InternalToolCall[] = [];
  const reasoningParts: string[] = [];

  for (const item of content) {
    if (!isRecord(item)) continue;
    const block = item;
    if (block.type === "text" && typeof block.text === "string") {
      blocks.push({ type: "text", text: block.text, raw: objectWithout(block, ["type", "text"]) });
      continue;
    }
    if (block.type === "image" && typeof block.source === "object") {
      const source = imageSourceFromAnthropicSource(block.source);
      if (source) blocks.push({ type: "image", source, raw: objectWithout(block, ["type", "source"]) });
      continue;
    }
    if (block.type === "tool_result" && typeof block.tool_use_id === "string") {
      blocks.push({
        type: "tool_result",
        toolCallId: block.tool_use_id,
        content: block.content,
        raw: objectWithout(block, ["type", "tool_use_id", "content"]),
      });
      continue;
    }
    if (block.type === "tool_use" && typeof block.id === "string" && typeof block.name === "string") {
      toolCalls.push({ id: block.id, name: block.name, arguments: block.input ?? {} });
      continue;
    }
    if (block.type === "thinking" && typeof block.thinking === "string") {
      reasoningParts.push(block.thinking);
      continue;
    }
    blocks.push({ type: "raw", content: block });
  }

  return {
    content: blocks.length ? blocks : [{ type: "text", text: "" }],
    toolCalls: toolCalls.length ? toolCalls : undefined,
    reasoningContent: reasoningParts.length ? reasoningParts.join("") : undefined,
  };
}

function parseSystem(system: unknown): string | undefined {
  if (typeof system === "string") return system;
  if (Array.isArray(system)) {
    return system
      .map((block) =>
        typeof block === "object" &&
        block !== null &&
        (block as Record<string, unknown>).type === "text" &&
        typeof (block as Record<string, unknown>).text === "string"
          ? ((block as Record<string, unknown>).text as string)
          : "",
      )
      .filter(Boolean)
      .join("\n\n");
  }
  return undefined;
}

function collectExtraBody(raw: Record<string, unknown>): Record<string, unknown> | undefined {
  const handled = new Set([
    "model",
    "messages",
    "system",
    "temperature",
    "top_p",
    "max_tokens",
    "stop_sequences",
    "stream",
    "tools",
    "tool_choice",
  ]);
  const entries = Object.entries(raw).filter(([key]) => !handled.has(key));
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function parseAnthropicRequest(body: unknown): InternalChatRequest {
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

  const messages: InternalMessage[] = raw.messages.map((message) => {
    const item = isRecord(message) ? message : {};
    if (item.role !== "user" && item.role !== "assistant") {
      throw new RelayError({
        type: "invalid_request_error",
        message: `Unsupported Anthropic message role: ${item.role}`,
        status: 400,
      });
    }
    const parsed = parseAnthropicContent(item.content);
    return {
      role: item.role,
      content: parsed.content,
      toolCalls: parsed.toolCalls,
      reasoningContent: parsed.reasoningContent,
      raw: objectWithout(item, ["role", "content"]),
    };
  });

  return {
    requestId: randomUUID(),
    inputProtocol: "anthropic",
    outputProtocol: "anthropic",
    requestedModel: raw.model,
    system: parseSystem(raw.system),
    messages,
    temperature: typeof raw.temperature === "number" ? raw.temperature : undefined,
    topP: typeof raw.top_p === "number" ? raw.top_p : undefined,
    maxTokens: typeof raw.max_tokens === "number" ? raw.max_tokens : 1024,
    stop: Array.isArray(raw.stop_sequences)
      ? raw.stop_sequences.filter((item): item is string => typeof item === "string")
      : undefined,
    stream: raw.stream === true,
    tools: Array.isArray(raw.tools) ? raw.tools : undefined,
    toolChoice: raw.tool_choice,
    extraBody: collectExtraBody(raw),
    rawRequest: raw,
  };
}
