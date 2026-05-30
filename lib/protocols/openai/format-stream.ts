import { encodeSse } from "@/lib/sse/encode-sse";
import type { InternalFinishReason, InternalStreamEvent } from "@/lib/internal/types";
import { formatOpenAIUsage, mapOpenAIFinishReason } from "@/lib/protocols/openai/format-response";

export function formatOpenAIStreamEvent(event: InternalStreamEvent, state: { id: string; model: string }): string {
  const created = Math.floor(Date.now() / 1000);

  if (event.type === "message_start") {
    state.id = event.id;
    state.model = event.model;
    return "";
  }

  if (event.type === "text_delta") {
    return encodeSse(
      JSON.stringify({
        id: state.id,
        object: "chat.completion.chunk",
        created,
        model: state.model,
        choices: [{ index: 0, delta: { content: event.text }, finish_reason: null }],
      }),
    );
  }

  if (event.type === "reasoning_delta") {
    return encodeSse(
      JSON.stringify({
        id: state.id,
        object: "chat.completion.chunk",
        created,
        model: state.model,
        choices: [{ index: 0, delta: { reasoning_content: event.text }, finish_reason: null }],
      }),
    );
  }

  if (event.type === "tool_call_start") {
    return encodeSse(
      JSON.stringify({
        id: state.id,
        object: "chat.completion.chunk",
        created,
        model: state.model,
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: event.index,
                  id: event.id,
                  type: "function",
                  function: { name: event.name, arguments: "" },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      }),
    );
  }

  if (event.type === "tool_call_delta") {
    return encodeSse(
      JSON.stringify({
        id: state.id,
        object: "chat.completion.chunk",
        created,
        model: state.model,
        choices: [
          {
            index: 0,
            delta: { tool_calls: [{ index: event.index, function: { arguments: event.argumentsDelta } }] },
            finish_reason: null,
          },
        ],
      }),
    );
  }

  if (event.type === "message_stop") {
    return encodeSse(
      JSON.stringify({
        id: state.id,
        object: "chat.completion.chunk",
        created,
        model: state.model,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: mapOpenAIFinishReason(event.finishReason as InternalFinishReason),
          },
        ],
      }),
    );
  }

  if (event.type === "usage") {
    return encodeSse(
      JSON.stringify({
        id: state.id,
        object: "chat.completion.chunk",
        created,
        model: state.model,
        choices: [],
        usage: formatOpenAIUsage(event.usage),
      }),
    );
  }

  if (event.type === "error") {
    return encodeSse(JSON.stringify({ error: event.error }));
  }

  return "";
}

export function openAIDoneEvent(): string {
  return "data: [DONE]\n\n";
}
