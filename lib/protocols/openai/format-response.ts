import type { InternalChatResponse, InternalFinishReason, InternalUsage } from "@/lib/internal/types";

export function mapOpenAIFinishReason(reason: InternalFinishReason): string {
  if (reason === "tool_calls") return "tool_calls";
  if (reason === "content_filter") return "content_filter";
  if (reason === "length") return "length";
  return "stop";
}

export function formatOpenAIUsage(usage: InternalUsage): Record<string, unknown> {
  return {
    prompt_tokens: usage.inputTokens ?? 0,
    completion_tokens: usage.outputTokens ?? 0,
    total_tokens: usage.totalTokens ?? 0,
    prompt_tokens_details: {
      cached_tokens: usage.inputCacheHitTokens ?? 0,
    },
  };
}

export function formatOpenAIResponse(response: InternalChatResponse, requestedModel: string): unknown {
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
  const toolCalls = response.content.filter((block) => block.type === "tool_call");
  const message: Record<string, unknown> = {
    role: "assistant",
    content: toolCalls.length && !text ? null : text,
  };
  if (response.reasoningContent) message.reasoning_content = response.reasoningContent;
  if (toolCalls.length) {
    message.tool_calls = toolCalls.map((call) => ({
      id: call.id,
      type: "function",
      function: {
        name: call.name,
        arguments: typeof call.arguments === "string" ? call.arguments : JSON.stringify(call.arguments ?? {}),
      },
    }));
  }

  return {
    id: response.id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: requestedModel,
    choices: [
      {
        index: 0,
        message,
        logprobs: response.logprobs,
        finish_reason: mapOpenAIFinishReason(response.finishReason),
      },
    ],
    usage: response.usage ? formatOpenAIUsage(response.usage) : undefined,
  };
}
