import { RelayError, toInternalError } from "@/lib/internal/errors";
import { imageSourceToOpenAIUrl } from "@/lib/internal/images";
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
import { buildProviderAuthHeaders, isMimoContext } from "@/lib/providers/mimo";
import type { ProviderAdapter, ProviderInvokeContext } from "@/lib/providers/types";

type OpenAIChoice = {
  message?: { content?: string | null };
  delta?: { content?: string | null };
  finish_reason?: unknown;
};

type OpenAIResponse = {
  id?: string;
  choices?: OpenAIChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

function textFromContent(content: InternalContentBlock[]): string | Array<Record<string, unknown>> {
  const hasNonText = content.some((block) => block.type !== "text");
  if (!hasNonText) {
    return content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");
  }
  return content.map((block) => {
    if (block.type === "text") return { type: "text", text: block.text };
    if (block.type === "image") {
      const url = imageSourceToOpenAIUrl(block.source);
      if (url) return { type: "image_url", image_url: { url } };
      const label = block.source.type === "file" ? `[image file: ${block.source.fileId}]` : "[image]";
      return { type: "text", text: label };
    }
    return { type: "text", text: JSON.stringify(block.content) };
  });
}

function toOpenAIMessages(request: InternalChatRequest): Array<Record<string, unknown>> {
  const messages: Array<Record<string, unknown>> = [];
  if (request.system) messages.push({ role: "system", content: request.system });
  for (const message of request.messages) {
    const output: Record<string, unknown> = {
      role: message.role,
      content: textFromContent(message.content),
    };
    if (message.name) output.name = message.name;
    if (message.toolCallId) output.tool_call_id = message.toolCallId;
    messages.push(output);
  }
  return messages;
}

function usesMaxCompletionTokens(context: ProviderInvokeContext): boolean {
  return isMimoContext(context);
}

export function buildOpenAICompatibleBody(
  request: InternalChatRequest,
  context: ProviderInvokeContext,
  stream: boolean,
  includeUsage: boolean,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
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
  if (request.tools) body.tools = request.tools;
  if (request.toolChoice) body.tool_choice = request.toolChoice;
  if (request.responseFormat) body.response_format = request.responseFormat;
  if (stream && includeUsage) body.stream_options = { include_usage: true };
  return body;
}

function toUsage(usage?: OpenAIResponse["usage"]): InternalUsage | undefined {
  if (!usage) return undefined;
  return {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
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
        headers: {
          ...buildProviderAuthHeaders(context),
          "content-type": "application/json",
        },
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
    const content = data.choices?.[0]?.message?.content ?? "";
    return {
      id: data.id ?? `chatcmpl_${request.requestId}`,
      model: request.requestedModel,
      resolvedModel: context.model.publicModelName,
      sourceId: context.source.id,
      upstreamModel: context.model.upstreamModelName,
      content: [{ type: "text", text: content }],
      finishReason: mapFinishReason(data.choices?.[0]?.finish_reason),
      usage: toUsage(data.usage),
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
      yield { type: "message_start", id, model };

      for await (const event of parseSse(response.body as ReadableStream<Uint8Array>)) {
        const data = JSON.parse(event.data) as OpenAIResponse;
        id = data.id ?? id;
        const choice = data.choices?.[0];
        const text = choice?.delta?.content;
        if (text) yield { type: "text_delta", index: 0, text };
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
      { headers: buildProviderAuthHeaders(context) },
      context.timeoutMs,
    );
    return { ok: response.ok, message: response.ok ? "Connection ok" : `HTTP ${response.status}` };
  }

  normalizeError(error: unknown) {
    return toInternalError(error);
  }
}

export function internalMessagesToOpenAI(messages: InternalMessage[]): Array<Record<string, unknown>> {
  return messages.map((message) => ({ role: message.role, content: textFromContent(message.content) }));
}
