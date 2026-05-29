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

  return {
    id: response.id,
    type: "message",
    role: "assistant",
    model: requestedModel,
    content: [{ type: "text", text }],
    stop_reason: mapAnthropicStopReason(response.finishReason),
    stop_sequence: null,
    usage: {
      input_tokens: response.usage?.inputTokens ?? 0,
      output_tokens: response.usage?.outputTokens ?? 0,
    },
  };
}
