import { randomUUID } from "node:crypto";
import { RelayError } from "@/lib/internal/errors";
import type { InternalChatRequest, InternalContentBlock, InternalMessage } from "@/lib/internal/types";

function parseAnthropicContent(content: unknown): InternalContentBlock[] {
  if (typeof content === "string") return [{ type: "text", text: content }];
  if (!Array.isArray(content)) return [{ type: "text", text: "" }];

  return content.flatMap((item): InternalContentBlock[] => {
    if (!item || typeof item !== "object") return [];
    const block = item as Record<string, unknown>;
    if (block.type === "text" && typeof block.text === "string") {
      return [{ type: "text", text: block.text }];
    }
    if (block.type === "image" && typeof block.source === "object") {
      return [{ type: "image_url", imageUrl: JSON.stringify(block.source) }];
    }
    return [];
  });
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
    const item = message as { role?: string; content?: unknown };
    if (item.role !== "user" && item.role !== "assistant") {
      throw new RelayError({
        type: "invalid_request_error",
        message: `Unsupported Anthropic message role: ${item.role}`,
        status: 400,
      });
    }
    return {
      role: item.role,
      content: parseAnthropicContent(item.content),
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
    rawRequest: raw,
  };
}
