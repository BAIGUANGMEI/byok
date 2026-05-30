import type { InternalChatResponse, InternalFinishReason } from "@/lib/internal/types";

export function mapAnthropicStopReason(reason: InternalFinishReason): string {
  if (reason === "length") return "max_tokens";
  if (reason === "tool_calls") return "tool_use";
  return "end_turn";
}

export function formatAnthropicResponse(response: InternalChatResponse, requestedModel: string): unknown {
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
  const content: Array<Record<string, unknown>> = [];
  if (response.reasoningContent) content.push({ type: "thinking", thinking: response.reasoningContent });
  if (text) content.push({ type: "text", text });
  for (const call of response.content.filter((block) => block.type === "tool_call")) {
    content.push({
      type: "tool_use",
      id: call.id,
      name: call.name,
      input: typeof call.arguments === "string" ? parseJsonObject(call.arguments) : call.arguments,
    });
  }

  return {
    id: response.id,
    type: "message",
    role: "assistant",
    model: requestedModel,
    content: content.length ? content : [{ type: "text", text: "" }],
    stop_reason: mapAnthropicStopReason(response.finishReason),
    stop_sequence: null,
    usage: {
      input_tokens: response.usage?.inputCacheMissTokens ?? response.usage?.inputTokens ?? 0,
      cache_read_input_tokens: response.usage?.inputCacheHitTokens ?? 0,
      cache_creation_input_tokens: 0,
      output_tokens: response.usage?.outputTokens ?? 0,
    },
  };
}

function parseJsonObject(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
}
