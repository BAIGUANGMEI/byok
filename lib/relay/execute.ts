import { decryptSecret } from "@/lib/crypto/encrypt";
import type { RelayApiKey } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { RelayError, toInternalError } from "@/lib/internal/errors";
import type { InternalChatRequest, InternalChatResponse, InternalStreamEvent, InternalUsage } from "@/lib/internal/types";
import { estimateCost, normalizeUsage, recordUsageAndLog } from "@/lib/internal/usage";
import { formatAnthropicStreamEvent } from "@/lib/protocols/anthropic/format-stream";
import { formatOpenAIStreamEvent, openAIDoneEvent } from "@/lib/protocols/openai/format-stream";
import { getProviderAdapter } from "@/lib/providers/registry";
import type { ResolveCandidate } from "@/lib/router/resolve-model";
import { resolveModel } from "@/lib/router/resolve-model";
import { shouldFallback } from "@/lib/router/should-fallback";

export type RelayResult = {
  response: InternalChatResponse;
  usage: Required<InternalUsage>;
  estimatedCost: string | null;
  attempts: AttemptLog[];
};

export type AttemptLog = {
  sourceId: string;
  model: string;
  status: "success" | "error";
  errorType?: string;
  errorMessage?: string;
};

function assertCapabilities(request: InternalChatRequest, candidate: ResolveCandidate): void {
  if (request.stream && !candidate.model.supportsStreaming) {
    throw new RelayError({
      type: "invalid_request_error",
      message: "This model mapping does not support streaming.",
      status: 400,
    });
  }
  if (request.tools?.length && !candidate.model.supportsTools) {
    throw new RelayError({
      type: "invalid_request_error",
      message: "This model mapping does not support tools yet.",
      status: 400,
    });
  }
  const raw = request.rawRequest as Record<string, unknown> | undefined;
  if (raw?.response_format && !candidate.model.supportsJsonMode) {
    throw new RelayError({
      type: "invalid_request_error",
      message: "This model mapping does not support json_mode yet.",
      status: 400,
    });
  }
}

function responseText(response: InternalChatResponse): string {
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
}

async function invokeCandidate(
  request: InternalChatRequest,
  candidate: ResolveCandidate,
): Promise<InternalChatResponse> {
  assertCapabilities(request, candidate);
  const adapter = getProviderAdapter(candidate.source.protocol);
  return adapter.invokeChat(request, {
    source: candidate.source,
    model: candidate.model,
    apiKey: decryptSecret(candidate.source.apiKeyEncrypted),
    timeoutMs: candidate.source.timeoutMs || getEnv().RELAY_DEFAULT_TIMEOUT_MS,
  });
}

export async function invokeWithFallback(
  request: InternalChatRequest,
  keyRecord: RelayApiKey,
): Promise<RelayResult> {
  const candidates = await resolveModel(request.requestedModel);
  const attempts: AttemptLog[] = [];
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const response = await invokeCandidate(request, candidate);
      const usage = normalizeUsage(request, responseText(response), response.usage);
      const estimatedCost = estimateCost({
        usage,
        inputPricePer1M: candidate.model.inputPricePer1M,
        outputPricePer1M: candidate.model.outputPricePer1M,
      });
      attempts.push({
        sourceId: candidate.source.id,
        model: candidate.model.publicModelName,
        status: "success",
      });
      await recordUsageAndLog({
        requestId: request.requestId,
        relayApiKeyId: keyRecord.id,
        inputProtocol: request.inputProtocol,
        outputProtocol: request.outputProtocol,
        requestedModel: request.requestedModel,
        resolvedModel: candidate.model.publicModelName,
        sourceId: candidate.source.id,
        upstreamModel: candidate.model.upstreamModelName,
        stream: request.stream,
        status: "success",
        httpStatus: 200,
        usage,
        estimatedCost,
        currency: candidate.model.currency ?? "USD",
        fallbackAttempts: attempts,
      });
      return { response: { ...response, usage }, usage, estimatedCost, attempts };
    } catch (error) {
      lastError = error;
      const internal = toInternalError(error);
      attempts.push({
        sourceId: candidate.source.id,
        model: candidate.model.publicModelName,
        status: "error",
        errorType: internal.type,
        errorMessage: internal.message,
      });
      if (!shouldFallback(error)) break;
    }
  }

  const internal = toInternalError(lastError);
  await recordUsageAndLog({
    requestId: request.requestId,
    relayApiKeyId: keyRecord.id,
    inputProtocol: request.inputProtocol,
    outputProtocol: request.outputProtocol,
    requestedModel: request.requestedModel,
    stream: request.stream,
    status: "error",
    httpStatus: lastError instanceof RelayError ? lastError.status : 500,
    errorType: internal.type,
    errorMessage: internal.message,
    fallbackAttempts: attempts,
  });
  throw lastError;
}

async function openStreamCandidate(
  request: InternalChatRequest,
  candidates: ResolveCandidate[],
  attempts: AttemptLog[],
): Promise<{ candidate: ResolveCandidate; stream: AsyncIterable<InternalStreamEvent> }> {
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      assertCapabilities(request, candidate);
      const adapter = getProviderAdapter(candidate.source.protocol);
      const stream = await adapter.streamChat(request, {
        source: candidate.source,
        model: candidate.model,
        apiKey: decryptSecret(candidate.source.apiKeyEncrypted),
        timeoutMs: candidate.source.timeoutMs || getEnv().RELAY_DEFAULT_TIMEOUT_MS,
      });
      return { candidate, stream };
    } catch (error) {
      lastError = error;
      const internal = toInternalError(error);
      attempts.push({
        sourceId: candidate.source.id,
        model: candidate.model.publicModelName,
        status: "error",
        errorType: internal.type,
        errorMessage: internal.message,
      });
      if (!shouldFallback(error)) break;
    }
  }

  throw lastError;
}

type StreamProtocol = "openai" | "anthropic";

export async function createRelayStreamResponse(
  request: InternalChatRequest,
  keyRecord: RelayApiKey,
  protocol: StreamProtocol,
): Promise<Response> {
  const candidates = await resolveModel(request.requestedModel);
  const attempts: AttemptLog[] = [];
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = Date.now();
      let firstTokenLatencyMs: number | null = null;
      let outputText = "";
      let usageFromStream: InternalUsage | undefined;
      let candidate: ResolveCandidate | undefined;

      try {
        const opened = await openStreamCandidate(request, candidates, attempts);
        candidate = opened.candidate;
        attempts.push({
          sourceId: candidate.source.id,
          model: candidate.model.publicModelName,
          status: "success",
        });

        const state =
          protocol === "openai"
            ? { id: `chatcmpl_${request.requestId}`, model: request.requestedModel }
            : { id: `msg_${request.requestId}`, model: request.requestedModel, contentStarted: false };

        for await (const event of opened.stream) {
          if (event.type === "text_delta") {
            outputText += event.text;
            firstTokenLatencyMs ??= Date.now() - startedAt;
          }
          if (event.type === "usage") usageFromStream = event.usage;

          const chunk =
            protocol === "openai"
              ? formatOpenAIStreamEvent(event, state as { id: string; model: string })
              : formatAnthropicStreamEvent(event, state as { id: string; model: string; contentStarted: boolean });
          if (chunk) controller.enqueue(encoder.encode(chunk));
        }

        if (protocol === "openai") controller.enqueue(encoder.encode(openAIDoneEvent()));

        const usage = normalizeUsage(request, outputText, usageFromStream);
        const estimatedCost = estimateCost({
          usage,
          inputPricePer1M: candidate.model.inputPricePer1M,
          outputPricePer1M: candidate.model.outputPricePer1M,
        });

        await recordUsageAndLog({
          requestId: request.requestId,
          relayApiKeyId: keyRecord.id,
          inputProtocol: request.inputProtocol,
          outputProtocol: request.outputProtocol,
          requestedModel: request.requestedModel,
          resolvedModel: candidate.model.publicModelName,
          sourceId: candidate.source.id,
          upstreamModel: candidate.model.upstreamModelName,
          stream: true,
          status: "success",
          httpStatus: 200,
          usage,
          estimatedCost,
          currency: candidate.model.currency ?? "USD",
          firstTokenLatencyMs,
          totalLatencyMs: Date.now() - startedAt,
          fallbackAttempts: attempts,
        });
      } catch (error) {
        const internal = toInternalError(error);
        const errorEvent: InternalStreamEvent = { type: "error", error: internal };
        const state =
          protocol === "openai"
            ? { id: `chatcmpl_${request.requestId}`, model: request.requestedModel }
            : { id: `msg_${request.requestId}`, model: request.requestedModel, contentStarted: false };
        const chunk =
          protocol === "openai"
            ? formatOpenAIStreamEvent(errorEvent, state as { id: string; model: string })
            : formatAnthropicStreamEvent(errorEvent, state as { id: string; model: string; contentStarted: boolean });
        if (chunk) controller.enqueue(encoder.encode(chunk));
        if (protocol === "openai") controller.enqueue(encoder.encode(openAIDoneEvent()));

        await recordUsageAndLog({
          requestId: request.requestId,
          relayApiKeyId: keyRecord.id,
          inputProtocol: request.inputProtocol,
          outputProtocol: request.outputProtocol,
          requestedModel: request.requestedModel,
          resolvedModel: candidate?.model.publicModelName,
          sourceId: candidate?.source.id,
          upstreamModel: candidate?.model.upstreamModelName,
          stream: true,
          status: "error",
          httpStatus: error instanceof RelayError ? error.status : 500,
          errorType: internal.type,
          errorMessage: internal.message,
          totalLatencyMs: Date.now() - startedAt,
          fallbackAttempts: attempts,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
