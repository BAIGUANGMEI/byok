import type { InternalChatResponse, InternalFinishReason } from "@/lib/internal/types";

export function mapOpenAIFinishReason(reason: InternalFinishReason): string {
  if (reason === "tool_calls") return "tool_calls";
  if (reason === "content_filter") return "content_filter";
  if (reason === "length") return "length";
  return "stop";
}

export function formatOpenAIResponse(response: InternalChatResponse, requestedModel: string): unknown {
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");

  return {
    id: response.id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: requestedModel,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: text,
        },
        finish_reason: mapOpenAIFinishReason(response.finishReason),
      },
    ],
    usage: response.usage
      ? {
          prompt_tokens: response.usage.inputTokens ?? 0,
          completion_tokens: response.usage.outputTokens ?? 0,
          total_tokens: response.usage.totalTokens ?? 0,
        }
      : undefined,
  };
}
