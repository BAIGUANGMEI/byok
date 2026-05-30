import { encodeSse } from "@/lib/sse/encode-sse";
import type { InternalStreamEvent } from "@/lib/internal/types";
import { mapAnthropicStopReason } from "@/lib/protocols/anthropic/format-response";

export function formatAnthropicStreamEvent(
  event: InternalStreamEvent,
  state: {
    id: string;
    model: string;
    contentStarted: boolean;
    nextIndex?: number;
    textIndex?: number;
    reasoningIndex?: number;
    toolIndexes?: Record<number, number>;
    openContentIndexes?: number[];
  },
): string {
  if (event.type === "message_start") {
    state.id = event.id;
    state.model = event.model;
    return encodeSse(
      JSON.stringify({
        type: "message_start",
        message: {
          id: state.id,
          type: "message",
          role: "assistant",
          model: state.model,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: {
            input_tokens: 0,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
            output_tokens: 0,
          },
        },
      }),
      "message_start",
    );
  }

  if (event.type === "text_delta") {
    const prefix = ensureAnthropicContentBlock(state, "text");
    state.contentStarted = true;
    return `${prefix}${encodeSse(
      JSON.stringify({
        type: "content_block_delta",
        index: state.textIndex ?? 0,
        delta: { type: "text_delta", text: event.text },
      }),
      "content_block_delta",
    )}`;
  }

  if (event.type === "reasoning_delta") {
    const prefix = ensureAnthropicContentBlock(state, "thinking");
    return `${prefix}${encodeSse(
      JSON.stringify({
        type: "content_block_delta",
        index: state.reasoningIndex ?? 0,
        delta: { type: "thinking_delta", thinking: event.text },
      }),
      "content_block_delta",
    )}`;
  }

  if (event.type === "tool_call_start") {
    state.nextIndex ??= 0;
    state.toolIndexes ??= {};
    state.openContentIndexes ??= [];
    const index = state.nextIndex++;
    state.toolIndexes[event.index] = index;
    state.openContentIndexes.push(index);
    return encodeSse(
      JSON.stringify({
        type: "content_block_start",
        index,
        content_block: { type: "tool_use", id: event.id, name: event.name, input: {} },
      }),
      "content_block_start",
    );
  }

  if (event.type === "tool_call_delta") {
    const index = state.toolIndexes?.[event.index] ?? event.index;
    return encodeSse(
      JSON.stringify({
        type: "content_block_delta",
        index,
        delta: { type: "input_json_delta", partial_json: event.argumentsDelta },
      }),
      "content_block_delta",
    );
  }

  if (event.type === "usage") {
    const usage: Record<string, number> = {};
    if (event.usage.outputTokens !== undefined) usage.output_tokens = event.usage.outputTokens;
    if (event.usage.inputTokens !== undefined || event.usage.inputCacheMissTokens !== undefined) {
      usage.input_tokens = event.usage.inputCacheMissTokens ?? event.usage.inputTokens ?? 0;
    }
    if (event.usage.inputCacheHitTokens !== undefined) usage.cache_read_input_tokens = event.usage.inputCacheHitTokens;
    if (event.usage.inputCacheMissTokens !== undefined || event.usage.inputTokens !== undefined) {
      usage.cache_creation_input_tokens = 0;
    }
    return encodeSse(
      JSON.stringify({
        type: "message_delta",
        delta: {},
        usage,
      }),
      "message_delta",
    );
  }

  if (event.type === "message_stop") {
    const stopReason = mapAnthropicStopReason(event.finishReason);
    const blockStop = (state.openContentIndexes ?? [])
      .map((index) => encodeSse(JSON.stringify({ type: "content_block_stop", index }), "content_block_stop"))
      .join("");
    return `${blockStop}${encodeSse(
      JSON.stringify({ type: "message_delta", delta: { stop_reason: stopReason, stop_sequence: null } }),
      "message_delta",
    )}${encodeSse(JSON.stringify({ type: "message_stop" }), "message_stop")}`;
  }

  if (event.type === "error") {
    return encodeSse(JSON.stringify({ type: "error", error: event.error }), "error");
  }

  return "";
}

function ensureAnthropicContentBlock(
  state: {
    nextIndex?: number;
    textIndex?: number;
    reasoningIndex?: number;
    openContentIndexes?: number[];
  },
  type: "text" | "thinking",
): string {
  state.nextIndex ??= 0;
  state.openContentIndexes ??= [];
  if (type === "text" && state.textIndex !== undefined) return "";
  if (type === "thinking" && state.reasoningIndex !== undefined) return "";

  const index = state.nextIndex++;
  state.openContentIndexes.push(index);
  if (type === "text") {
    state.textIndex = index;
    return encodeSse(
      JSON.stringify({ type: "content_block_start", index, content_block: { type: "text", text: "" } }),
      "content_block_start",
    );
  }

  state.reasoningIndex = index;
  return encodeSse(
    JSON.stringify({ type: "content_block_start", index, content_block: { type: "thinking", thinking: "" } }),
    "content_block_start",
  );
}
