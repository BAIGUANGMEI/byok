import { encodeSse } from "@/lib/sse/encode-sse";
import type { InternalStreamEvent } from "@/lib/internal/types";
import { mapAnthropicStopReason } from "@/lib/protocols/anthropic/format-response";

export function formatAnthropicStreamEvent(
  event: InternalStreamEvent,
  state: { id: string; model: string; contentStarted: boolean },
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
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      }),
      "message_start",
    );
  }

  if (event.type === "text_delta") {
    const prefix = state.contentStarted
      ? ""
      : encodeSse(
          JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }),
          "content_block_start",
        );
    state.contentStarted = true;
    return `${prefix}${encodeSse(
      JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: event.text } }),
      "content_block_delta",
    )}`;
  }

  if (event.type === "usage") {
    return encodeSse(
      JSON.stringify({ type: "message_delta", delta: {}, usage: { output_tokens: event.usage.outputTokens ?? 0 } }),
      "message_delta",
    );
  }

  if (event.type === "message_stop") {
    const stopReason = mapAnthropicStopReason(event.finishReason);
    const blockStop = state.contentStarted
      ? encodeSse(JSON.stringify({ type: "content_block_stop", index: 0 }), "content_block_stop")
      : "";
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
