import { RelayError, toInternalError } from "@/lib/internal/errors";
import { imageSourceToOpenAIUrl } from "@/lib/internal/images";
import type {
  InternalChatRequest,
  InternalChatResponse,
  InternalContentBlock,
  InternalMessage,
  InternalStreamEvent,
  InternalToolCall,
  InternalUsage,
} from "@/lib/internal/types";
import { parseSse } from "@/lib/sse/parse-sse";
import { fetchWithTimeout, joinUrl, mapFinishReason, throwProviderError } from "@/lib/providers/common";
import { fetchWithImageUrlFallback } from "@/lib/providers/image-url-fallback";
import { buildProviderAuthHeaders, isKimiContext, isMimoContext } from "@/lib/providers/mimo";
import type { ProviderAdapter, ProviderInvokeContext } from "@/lib/providers/types";

type OpenAIToolCall = {
  index?: number;
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
};

type OpenAIChoice = {
  message?: {
    content?: string | null;
    reasoning_content?: string | null;
    reasoning?: string | null;
    thinking?: string | null;
    tool_calls?: OpenAIToolCall[];
  };
  delta?: {
    content?: string | null;
    reasoning_content?: string | null;
    reasoning?: string | null;
    thinking?: string | null;
    tool_calls?: OpenAIToolCall[];
  };
  finish_reason?: unknown;
  logprobs?: unknown;
};

type OpenAIResponse = {
  id?: string;
  choices?: OpenAIChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    prompt_tokens_details?: {
      cached_tokens?: number;
    };
    cached_tokens?: number;
    prompt_cache_hit_tokens?: number;
    prompt_cache_miss_tokens?: number;
  };
};

function stringifyToolContent(content: unknown): string {
  if (typeof content === "string") return content;
  return JSON.stringify(content ?? "");
}

function contentToOpenAI(content: InternalContentBlock[]): string | Array<Record<string, unknown>> {
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
      const url = imageSourceToOpenAIUrl(block.source);
      if (url) return { ...(block.raw ?? {}), type: "image_url", image_url: { url } };
      const label = block.source.type === "file" ? `[image file: ${block.source.fileId}]` : "[image]";
      return { type: "text", text: label };
    }
    if (block.type === "tool_result") return { type: "text", text: stringifyToolContent(block.content) };
    return block.content;
  });
}

function internalToolCallToOpenAI(call: InternalToolCall): Record<string, unknown> {
  return {
    id: call.id,
    type: "function",
    function: {
      name: call.name,
      arguments: typeof call.arguments === "string" ? call.arguments : JSON.stringify(call.arguments ?? {}),
    },
  };
}

function toOpenAIMessages(request: InternalChatRequest): Array<Record<string, unknown>> {
  const messages: Array<Record<string, unknown>> = [];
  if (request.system) messages.push({ role: "system", content: request.system });

  for (const message of request.messages) {
    const toolResults = message.content.filter((block) => block.type === "tool_result");
    const regularContent = message.content.filter((block) => block.type !== "tool_result");

    if (regularContent.length || message.toolCalls?.length) {
      const output: Record<string, unknown> = {
        ...(message.raw ?? {}),
        role: message.role,
        content: regularContent.length ? contentToOpenAI(regularContent) : "",
      };
      if (message.name) output.name = message.name;
      if (message.toolCallId) output.tool_call_id = message.toolCallId;
      if (message.reasoningContent) output.reasoning_content = message.reasoningContent;
      if (message.toolCalls?.length) output.tool_calls = message.toolCalls.map(internalToolCallToOpenAI);
      messages.push(output);
    }

    for (const block of toolResults) {
      messages.push({
        role: "tool",
        tool_call_id: block.toolCallId,
        content: stringifyToolContent(block.content),
      });
    }

    if (!regularContent.length && !toolResults.length && !message.toolCalls?.length) {
      messages.push({ ...(message.raw ?? {}), role: message.role, content: "" });
    }
  }

  return messages;
}

function toolsToOpenAI(tools: unknown[]): unknown[] {
  return tools.map((tool) => {
    if (!tool || typeof tool !== "object" || Array.isArray(tool)) return tool;
    const raw = tool as Record<string, unknown>;
    if (raw.type === "function") return tool;
    if (typeof raw.name === "string" && raw.input_schema) {
      return {
        type: "function",
        function: {
          name: raw.name,
          description: raw.description,
          parameters: raw.input_schema,
        },
      };
    }
    return tool;
  });
}

function toolChoiceToOpenAI(toolChoice: unknown): unknown {
  if (!toolChoice || typeof toolChoice !== "object" || Array.isArray(toolChoice)) return toolChoice;
  const raw = toolChoice as Record<string, unknown>;
  if (raw.type === "tool" && typeof raw.name === "string") return { type: "function", function: { name: raw.name } };
  if (raw.type === "any") return "required";
  if (raw.type === "auto") return "auto";
  if (raw.type === "none") return "none";
  return toolChoice;
}

function usesMaxCompletionTokens(context: ProviderInvokeContext): boolean {
  return isMimoContext(context) || isKimiContext(context);
}

function mergeStreamOptions(extra: unknown, includeUsage: boolean): Record<string, unknown> {
  const options =
    extra && typeof extra === "object" && !Array.isArray(extra) ? { ...(extra as Record<string, unknown>) } : {};
  if (includeUsage) options.include_usage = true;
  return options;
}

function withProviderHeaders(context: ProviderInvokeContext, headers: Record<string, string>): Record<string, string> {
  return {
    ...(context.extraHeaders ?? {}),
    ...headers,
  };
}

export function buildOpenAICompatibleBody(
  request: InternalChatRequest,
  context: ProviderInvokeContext,
  stream: boolean,
  includeUsage: boolean,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    ...(request.extraBody ?? {}),
    model: context.model.upstreamModelName,
    messages: toOpenAIMessages(request),
    stream,
  };
  if (request.temperature !== undefined) body.temperature = request.temperature;
  if (request.topP !== undefined) body.top_p = request.topP;
  if (request.maxTokens !== undefined) {
    if (usesMaxCompletionTokens(context)) body.max_completion_tokens = request.maxTokens;
    else body.max_tokens = request.maxTokens;
  }
  if (request.stop) body.stop = request.stop;
  if (request.tools) body.tools = toolsToOpenAI(request.tools);
  if (request.toolChoice) body.tool_choice = toolChoiceToOpenAI(request.toolChoice);
  if (request.responseFormat) body.response_format = request.responseFormat;
  if (stream && includeUsage) body.stream_options = mergeStreamOptions(body.stream_options, true);
  return body;
}

function toUsage(usage?: OpenAIResponse["usage"]): InternalUsage | undefined {
  if (!usage) return undefined;
  const inputTokens = usage.prompt_tokens;
  const inputCacheHitTokens =
    usage.prompt_tokens_details?.cached_tokens ?? usage.cached_tokens ?? usage.prompt_cache_hit_tokens;
  const inputCacheMissTokens =
    usage.prompt_cache_miss_tokens ??
    (inputTokens !== undefined && inputCacheHitTokens !== undefined
      ? Math.max(inputTokens - inputCacheHitTokens, 0)
      : undefined);
  return {
    inputTokens,
    inputCacheHitTokens,
    inputCacheMissTokens,
    outputTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
}

function reasoningFromOpenAI(choice?: OpenAIChoice): string | undefined {
  return (
    choice?.message?.reasoning_content ??
    choice?.message?.reasoning ??
    choice?.message?.thinking ??
    undefined
  ) ?? undefined;
}

function reasoningDeltaFromOpenAI(choice?: OpenAIChoice): string | undefined {
  return (
    choice?.delta?.reasoning_content ??
    choice?.delta?.reasoning ??
    choice?.delta?.thinking ??
    undefined
  ) ?? undefined;
}

function toolCallsFromOpenAI(calls: OpenAIToolCall[] | undefined): InternalToolCall[] {
  if (!calls?.length) return [];
  return calls.flatMap((call) => {
    const name = call.function?.name;
    if (!name) return [];
    return [
      {
        id: call.id ?? `call_${crypto.randomUUID().replaceAll("-", "")}`,
        name,
        arguments: call.function?.arguments ?? "",
      },
    ];
  });
}

async function requestJson(
  request: InternalChatRequest,
  context: ProviderInvokeContext,
  stream: boolean,
  includeUsage: boolean,
): Promise<Response> {
  return fetchWithImageUrlFallback(request, context.timeoutMs, (upstreamRequest) => {
    const body = buildOpenAICompatibleBody(upstreamRequest, context, stream, includeUsage);
    return fetchWithTimeout(
      joinUrl(context.source.baseUrl, "/chat/completions"),
      {
        method: "POST",
        headers: withProviderHeaders(context, {
          ...buildProviderAuthHeaders(context),
          "content-type": "application/json",
        }),
        body: JSON.stringify(body),
      },
      context.timeoutMs,
    );
  });
}

export class OpenAICompatibleAdapter implements ProviderAdapter {
  id = "openai-compatible";
  protocol = "openai_chat" as const;

  async invokeChat(
    request: InternalChatRequest,
    context: ProviderInvokeContext,
  ): Promise<InternalChatResponse> {
    const response = await requestJson(request, context, false, false);
    if (!response.ok) await throwProviderError(response, context.source.name);

    const data = (await response.json()) as OpenAIResponse;
    const choice = data.choices?.[0];
    const text = choice?.message?.content ?? "";
    const toolCalls = toolCallsFromOpenAI(choice?.message?.tool_calls);
    return {
      id: data.id ?? `chatcmpl_${request.requestId}`,
      model: request.requestedModel,
      resolvedModel: context.model.publicModelName,
      sourceId: context.source.id,
      upstreamModel: context.model.upstreamModelName,
      content: [
        ...(text ? [{ type: "text" as const, text }] : []),
        ...toolCalls.map((call) => ({
          type: "tool_call" as const,
          id: call.id,
          name: call.name,
          arguments: call.arguments,
        })),
      ],
      reasoningContent: reasoningFromOpenAI(choice),
      finishReason: mapFinishReason(choice?.finish_reason),
      usage: toUsage(data.usage),
      logprobs: choice?.logprobs,
      providerRequestId: response.headers.get("x-request-id") ?? undefined,
    };
  }

  async streamChat(
    request: InternalChatRequest,
    context: ProviderInvokeContext,
  ): Promise<AsyncIterable<InternalStreamEvent>> {
    let response = await requestJson(request, context, true, true);
    if (!response.ok && response.status === 400) {
      response = await requestJson(request, context, true, false);
    }
    if (!response.ok) await throwProviderError(response, context.source.name);
    if (!response.body) {
      throw new RelayError({
        type: "provider_error",
        message: "Provider returned an empty stream",
        status: 502,
        retryable: true,
      });
    }

    const model = context.model.publicModelName;
    const requestId = request.requestId;
    async function* iterator(): AsyncIterable<InternalStreamEvent> {
      let id = `chatcmpl_${requestId}`;
      const startedToolCalls = new Set<number>();
      yield { type: "message_start", id, model };

      for await (const event of parseSse(response.body as ReadableStream<Uint8Array>)) {
        const data = JSON.parse(event.data) as OpenAIResponse;
        id = data.id ?? id;
        const choice = data.choices?.[0];
        const reasoning = reasoningDeltaFromOpenAI(choice);
        if (reasoning) yield { type: "reasoning_delta", index: 0, text: reasoning };
        const text = choice?.delta?.content;
        if (text) yield { type: "text_delta", index: 0, text };
        for (const call of choice?.delta?.tool_calls ?? []) {
          const index = call.index ?? 0;
          if (!startedToolCalls.has(index) && (call.id || call.function?.name)) {
            startedToolCalls.add(index);
            yield {
              type: "tool_call_start",
              index,
              id: call.id ?? `call_${crypto.randomUUID().replaceAll("-", "")}`,
              name: call.function?.name ?? "",
            };
          }
          if (call.function?.arguments) {
            yield { type: "tool_call_delta", index, argumentsDelta: call.function.arguments };
          }
        }
        const usage = toUsage(data.usage);
        if (usage) yield { type: "usage", usage };
        if (choice?.finish_reason) yield { type: "message_stop", finishReason: mapFinishReason(choice.finish_reason) };
      }
    }

    return iterator();
  }

  async testConnection(context: ProviderInvokeContext): Promise<{ ok: boolean; message: string }> {
    const response = await fetchWithTimeout(
      joinUrl(context.source.baseUrl, "/models"),
      { headers: withProviderHeaders(context, buildProviderAuthHeaders(context)) },
      context.timeoutMs,
    );
    return { ok: response.ok, message: response.ok ? "Connection ok" : `HTTP ${response.status}` };
  }

  normalizeError(error: unknown) {
    return toInternalError(error);
  }
}

export function internalMessagesToOpenAI(messages: InternalMessage[]): Array<Record<string, unknown>> {
  return toOpenAIMessages({
    requestId: "conversion",
    inputProtocol: "openai",
    outputProtocol: "openai",
    requestedModel: "conversion",
    messages,
    stream: false,
  });
}
