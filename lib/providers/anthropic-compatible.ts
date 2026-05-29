import { RelayError, toInternalError } from "@/lib/internal/errors";
import { imageSourceToAnthropicSource } from "@/lib/internal/images";
import type {
  InternalChatRequest,
  InternalChatResponse,
  InternalContentBlock,
  InternalMessage,
  InternalStreamEvent,
  InternalUsage,
} from "@/lib/internal/types";
import { parseSse } from "@/lib/sse/parse-sse";
import {
  fetchWithTimeout,
  joinUrl,
  mapFinishReason,
  throwProviderError,
} from "@/lib/providers/common";
import { fetchWithImageUrlFallback } from "@/lib/providers/image-url-fallback";
import { buildProviderAuthHeaders } from "@/lib/providers/mimo";
import type { ProviderAdapter, ProviderInvokeContext } from "@/lib/providers/types";

type AnthropicResponse = {
  id?: string;
  content?: Array<{ type?: string; text?: string }>;
  stop_reason?: unknown;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
};

type AnthropicStreamData = {
  type?: string;
  message?: { id?: string; model?: string };
  delta?: { text?: string; stop_reason?: unknown };
  usage?: { output_tokens?: number; input_tokens?: number };
};

function contentToAnthropic(content: InternalContentBlock[]): string | Array<Record<string, unknown>> {
  const hasNonText = content.some((block) => block.type !== "text");
  if (!hasNonText) {
    return content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");
  }
  return content.map((block) => {
    if (block.type === "text") return { type: "text", text: block.text };
    if (block.type === "image") return { type: "image", source: imageSourceToAnthropicSource(block.source) };
    return { type: "text", text: JSON.stringify(block.content) };
  });
}

function toUsage(usage?: AnthropicResponse["usage"]): InternalUsage | undefined {
  if (!usage) return undefined;
  const inputTokens = usage.input_tokens;
  const outputTokens = usage.output_tokens;
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens !== undefined || outputTokens !== undefined ? (inputTokens ?? 0) + (outputTokens ?? 0) : undefined,
  };
}

function buildBody(request: InternalChatRequest, context: ProviderInvokeContext, stream: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: context.model.upstreamModelName,
    messages: internalMessagesToAnthropic(request.messages),
    max_tokens: request.maxTokens ?? 1024,
    stream,
  };
  if (request.system) body.system = request.system;
  if (request.temperature !== undefined) body.temperature = request.temperature;
  if (request.topP !== undefined) body.top_p = request.topP;
  if (request.stop) body.stop_sequences = request.stop;
  if (request.tools) body.tools = request.tools;
  if (request.toolChoice) body.tool_choice = request.toolChoice;
  return body;
}

async function requestAnthropic(
  request: InternalChatRequest,
  context: ProviderInvokeContext,
  stream: boolean,
): Promise<Response> {
  return fetchWithImageUrlFallback(request, context.timeoutMs, (upstreamRequest) =>
    fetchWithTimeout(
      joinUrl(context.source.baseUrl, "/messages"),
      {
        method: "POST",
        headers: {
          ...buildProviderAuthHeaders(context),
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify(buildBody(upstreamRequest, context, stream)),
      },
      context.timeoutMs,
    ),
  );
}

export class AnthropicCompatibleAdapter implements ProviderAdapter {
  id = "anthropic-compatible";
  protocol = "anthropic_messages" as const;

  async invokeChat(
    request: InternalChatRequest,
    context: ProviderInvokeContext,
  ): Promise<InternalChatResponse> {
    const response = await requestAnthropic(request, context, false);
    if (!response.ok) await throwProviderError(response, context.source.name);

    const data = (await response.json()) as AnthropicResponse;
    const text =
      data.content
        ?.filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("") ?? "";

    return {
      id: data.id ?? `msg_${request.requestId}`,
      model: request.requestedModel,
      resolvedModel: context.model.publicModelName,
      sourceId: context.source.id,
      upstreamModel: context.model.upstreamModelName,
      content: [{ type: "text", text }],
      finishReason: mapFinishReason(data.stop_reason),
      usage: toUsage(data.usage),
      providerRequestId: response.headers.get("request-id") ?? undefined,
    };
  }

  async streamChat(
    request: InternalChatRequest,
    context: ProviderInvokeContext,
  ): Promise<AsyncIterable<InternalStreamEvent>> {
    const response = await requestAnthropic(request, context, true);
    if (!response.ok) await throwProviderError(response, context.source.name);
    if (!response.body) {
      throw new RelayError({
        type: "provider_error",
        message: "Provider returned an empty stream",
        status: 502,
        retryable: true,
      });
    }

    const fallbackId = `msg_${request.requestId}`;
    const model = context.model.publicModelName;

    async function* iterator(): AsyncIterable<InternalStreamEvent> {
      let id = fallbackId;
      let started = false;
      for await (const event of parseSse(response.body as ReadableStream<Uint8Array>)) {
        const data = JSON.parse(event.data) as AnthropicStreamData;
        if (data.type === "message_start") {
          id = data.message?.id ?? id;
          started = true;
          yield { type: "message_start", id, model };
        }
        if (!started) {
          started = true;
          yield { type: "message_start", id, model };
        }
        if (data.type === "content_block_delta" && data.delta?.text) {
          yield { type: "text_delta", index: 0, text: data.delta.text };
        }
        if (data.type === "message_delta" && data.usage) {
          const outputTokens = data.usage.output_tokens;
          yield {
            type: "usage",
            usage: {
              outputTokens,
              totalTokens: outputTokens,
            },
          };
        }
        if (data.type === "message_delta" && data.delta?.stop_reason) {
          yield { type: "message_stop", finishReason: mapFinishReason(data.delta.stop_reason) };
        }
        if (data.type === "message_stop") {
          yield { type: "message_stop", finishReason: "stop" };
        }
      }
    }

    return iterator();
  }

  async testConnection(context: ProviderInvokeContext): Promise<{ ok: boolean; message: string }> {
    const response = await fetchWithTimeout(
      joinUrl(context.source.baseUrl, "/models"),
      {
        headers: {
          ...buildProviderAuthHeaders(context),
          "anthropic-version": "2023-06-01",
        },
      },
      context.timeoutMs,
    );
    return { ok: response.ok, message: response.ok ? "Connection ok" : `HTTP ${response.status}` };
  }

  normalizeError(error: unknown) {
    return toInternalError(error);
  }
}

export function internalMessagesToAnthropic(messages: InternalMessage[]): Array<Record<string, unknown>> {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: contentToAnthropic(message.content),
  }));
}
