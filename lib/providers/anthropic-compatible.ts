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
import { fetchWithTimeout, joinUrl, mapFinishReason, throwProviderError } from "@/lib/providers/common";
import { fetchWithImageUrlFallback } from "@/lib/providers/image-url-fallback";
import { buildProviderAuthHeaders } from "@/lib/providers/mimo";
import type { ProviderAdapter, ProviderInvokeContext } from "@/lib/providers/types";

type AnthropicContentBlock = {
  type?: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: unknown;
};

type AnthropicResponse = {
  id?: string;
  content?: AnthropicContentBlock[];
  stop_reason?: unknown;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
};

type AnthropicStreamData = {
  type?: string;
  index?: number;
  content_block?: AnthropicContentBlock;
  message?: { id?: string; model?: string; usage?: AnthropicResponse["usage"] };
  delta?: {
    type?: string;
    text?: string;
    thinking?: string;
    partial_json?: string;
    stop_reason?: unknown;
  };
  usage?: AnthropicResponse["usage"];
};

function stringifyToolContent(content: unknown): unknown {
  if (typeof content === "string") return content;
  return content ?? "";
}

function contentToAnthropic(content: InternalContentBlock[]): string | Array<Record<string, unknown>> {
  const hasNonText = content.some((block) => block.type !== "text");
  if (!hasNonText) {
    return content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");
  }
  return content.map((block) => {
    if (block.type === "text") return { ...(block.raw ?? {}), type: "text", text: block.text };
    if (block.type === "image") {
      return { ...(block.raw ?? {}), type: "image", source: imageSourceToAnthropicSource(block.source) };
    }
    if (block.type === "tool_result") {
      return {
        ...(block.raw ?? {}),
        type: "tool_result",
        tool_use_id: block.toolCallId,
        content: stringifyToolContent(block.content),
      };
    }
    return block.content;
  });
}

function parseToolInput(value: unknown): unknown {
  if (typeof value !== "string") return value ?? {};
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
}

function internalMessagesToAnthropicContent(message: InternalMessage): string | Array<Record<string, unknown>> {
  const content = contentToAnthropic(message.content);
  const toolUseBlocks =
    message.toolCalls?.map((call) => ({
      type: "tool_use",
      id: call.id,
      name: call.name,
      input: parseToolInput(call.arguments),
    })) ?? [];
  const thinkingBlocks = message.reasoningContent
    ? [{ type: "thinking", thinking: message.reasoningContent }]
    : [];

  if (!toolUseBlocks.length && !thinkingBlocks.length) return content;
  const contentBlocks = typeof content === "string" ? (content ? [{ type: "text", text: content }] : []) : content;
  return [...thinkingBlocks, ...contentBlocks, ...toolUseBlocks];
}

function toolsToAnthropic(tools: unknown[]): unknown[] {
  return tools.map((tool) => {
    if (!tool || typeof tool !== "object" || Array.isArray(tool)) return tool;
    const raw = tool as Record<string, unknown>;
    if (typeof raw.name === "string" && raw.input_schema) return tool;
    const fn = raw.function;
    if (raw.type === "function" && fn && typeof fn === "object" && !Array.isArray(fn)) {
      const functionTool = fn as Record<string, unknown>;
      return {
        name: functionTool.name,
        description: functionTool.description,
        input_schema: functionTool.parameters ?? { type: "object", properties: {} },
      };
    }
    return tool;
  });
}

function toolChoiceToAnthropic(toolChoice: unknown): unknown {
  if (toolChoice === "auto") return { type: "auto" };
  if (toolChoice === "required") return { type: "any" };
  if (toolChoice === "none") return { type: "none" };
  if (!toolChoice || typeof toolChoice !== "object" || Array.isArray(toolChoice)) return toolChoice;
  const raw = toolChoice as Record<string, unknown>;
  const fn = raw.function;
  if (raw.type === "function" && fn && typeof fn === "object" && !Array.isArray(fn)) {
    const name = (fn as Record<string, unknown>).name;
    if (typeof name === "string") return { type: "tool", name };
  }
  return toolChoice;
}

function toUsage(usage?: AnthropicResponse["usage"]): InternalUsage | undefined {
  if (!usage) return undefined;
  const inputCacheHitTokens = usage.cache_read_input_tokens;
  const inputCacheMissTokens =
    usage.input_tokens !== undefined || usage.cache_creation_input_tokens !== undefined
      ? (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0)
      : undefined;
  const inputTokens =
    inputCacheHitTokens !== undefined || inputCacheMissTokens !== undefined
      ? (inputCacheHitTokens ?? 0) + (inputCacheMissTokens ?? 0)
      : usage.input_tokens;
  const outputTokens = usage.output_tokens;
  return {
    inputTokens,
    inputCacheHitTokens,
    inputCacheMissTokens,
    outputTokens,
    totalTokens:
      inputTokens !== undefined || outputTokens !== undefined ? (inputTokens ?? 0) + (outputTokens ?? 0) : undefined,
  };
}

function withProviderHeaders(context: ProviderInvokeContext, headers: Record<string, string>): Record<string, string> {
  return {
    ...(context.extraHeaders ?? {}),
    ...headers,
  };
}

function buildBody(request: InternalChatRequest, context: ProviderInvokeContext, stream: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    ...(request.extraBody ?? {}),
    model: context.model.upstreamModelName,
    messages: internalMessagesToAnthropic(request.messages),
    max_tokens: request.maxTokens ?? 1024,
    stream,
  };
  if (request.system) body.system = request.system;
  if (request.temperature !== undefined) body.temperature = request.temperature;
  if (request.topP !== undefined) body.top_p = request.topP;
  if (request.stop) body.stop_sequences = request.stop;
  if (request.tools) body.tools = toolsToAnthropic(request.tools);
  if (request.toolChoice) body.tool_choice = toolChoiceToAnthropic(request.toolChoice);
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
        headers: withProviderHeaders(context, {
          ...buildProviderAuthHeaders(context),
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        }),
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
    const reasoningContent =
      data.content
        ?.filter((block) => block.type === "thinking")
        .map((block) => block.thinking ?? "")
        .join("") || undefined;
    const toolCalls =
      data.content
        ?.filter((block) => block.type === "tool_use" && block.id && block.name)
        .map((block) => ({
          type: "tool_call" as const,
          id: block.id as string,
          name: block.name as string,
          arguments: block.input ?? {},
        })) ?? [];

    return {
      id: data.id ?? `msg_${request.requestId}`,
      model: request.requestedModel,
      resolvedModel: context.model.publicModelName,
      sourceId: context.source.id,
      upstreamModel: context.model.upstreamModelName,
      content: [...(text ? [{ type: "text" as const, text }] : []), ...toolCalls],
      reasoningContent,
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
      let stopEmitted = false;
      const toolIndexes = new Map<number, { id: string; name: string }>();
      for await (const event of parseSse(response.body as ReadableStream<Uint8Array>)) {
        const data = JSON.parse(event.data) as AnthropicStreamData;
        if (data.type === "message_start") {
          id = data.message?.id ?? id;
          started = true;
          yield { type: "message_start", id, model };
          const usage = toUsage(data.message?.usage);
          if (usage) yield { type: "usage", usage };
        }
        if (!started) {
          started = true;
          yield { type: "message_start", id, model };
        }
        if (data.type === "content_block_start" && data.content_block?.type === "tool_use") {
          const index = data.index ?? 0;
          const toolId = data.content_block.id ?? `toolu_${index}`;
          const name = data.content_block.name ?? "";
          toolIndexes.set(index, { id: toolId, name });
          yield { type: "tool_call_start", index, id: toolId, name };
        }
        if (data.type === "content_block_delta" && data.delta?.type === "text_delta" && data.delta.text) {
          yield { type: "text_delta", index: data.index ?? 0, text: data.delta.text };
        }
        if (data.type === "content_block_delta" && data.delta?.type === "thinking_delta" && data.delta.thinking) {
          yield { type: "reasoning_delta", index: data.index ?? 0, text: data.delta.thinking };
        }
        if (data.type === "content_block_delta" && data.delta?.type === "input_json_delta" && data.delta.partial_json) {
          const index = data.index ?? 0;
          if (!toolIndexes.has(index)) {
            const toolId = `toolu_${index}`;
            toolIndexes.set(index, { id: toolId, name: "" });
            yield { type: "tool_call_start", index, id: toolId, name: "" };
          }
          yield { type: "tool_call_delta", index, argumentsDelta: data.delta.partial_json };
        }
        if (data.type === "message_delta" && data.usage) {
          const usage = toUsage(data.usage);
          if (!usage) continue;
          yield {
            type: "usage",
            usage,
          };
        }
        if (data.type === "message_delta" && data.delta?.stop_reason) {
          stopEmitted = true;
          yield { type: "message_stop", finishReason: mapFinishReason(data.delta.stop_reason) };
        }
        if (data.type === "message_stop" && !stopEmitted) {
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
        headers: withProviderHeaders(context, {
          ...buildProviderAuthHeaders(context),
          "anthropic-version": "2023-06-01",
        }),
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
    ...(message.raw ?? {}),
    role: message.role === "assistant" ? "assistant" : "user",
    content: internalMessagesToAnthropicContent(message),
  }));
}
