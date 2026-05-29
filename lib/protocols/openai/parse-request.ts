import { randomUUID } from "node:crypto";
import { RelayError } from "@/lib/internal/errors";
import type { InternalChatRequest, InternalContentBlock, InternalMessage } from "@/lib/internal/types";

type OpenAIMessage = {
  role?: string;
  content?: unknown;
  name?: string;
  tool_call_id?: string;
};

function parseContent(content: unknown): InternalContentBlock[] {
  if (typeof content === "string") return [{ type: "text", text: content }];
  if (!Array.isArray(content)) return [{ type: "text", text: "" }];

  return content.flatMap((item): InternalContentBlock[] => {
    if (!item || typeof item !== "object") return [];
    const block = item as Record<string, unknown>;
    if (block.type === "text" && typeof block.text === "string") {
      return [{ type: "text", text: block.text }];
    }
    if (block.type === "image_url") {
      const image = block.image_url as { url?: string } | undefined;
      if (image?.url) return [{ type: "image_url", imageUrl: image.url }];
    }
    return [];
  });
}

function parseStop(stop: unknown): string[] | undefined {
  if (typeof stop === "string") return [stop];
  if (Array.isArray(stop)) return stop.filter((item): item is string => typeof item === "string");
  return undefined;
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
    if (!message || typeof message !== "object") continue;
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
    rawRequest: raw,
  };
}
