import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { dailyUsage, requestLogs } from "@/lib/db/schema";
import type { InternalChatRequest, InternalUsage } from "@/lib/internal/types";
import { estimateInputTokens, estimateTokensFromText } from "@/lib/internal/token-estimator";

export function normalizeUsage(
  request: InternalChatRequest,
  responseText: string,
  upstreamUsage?: InternalUsage,
): Required<InternalUsage> {
  const inputTokens = upstreamUsage?.inputTokens ?? estimateInputTokens(request);
  const outputTokens = upstreamUsage?.outputTokens ?? estimateTokensFromText(responseText);
  const totalTokens = upstreamUsage?.totalTokens ?? inputTokens + outputTokens;
  return { inputTokens, outputTokens, totalTokens };
}

export function estimateCost(options: {
  usage: InternalUsage;
  inputPricePer1M?: string | null;
  outputPricePer1M?: string | null;
}): string | null {
  const inputPrice = options.inputPricePer1M ? Number(options.inputPricePer1M) : 0;
  const outputPrice = options.outputPricePer1M ? Number(options.outputPricePer1M) : 0;
  if (!inputPrice && !outputPrice) return null;
  const inputTokens = options.usage.inputTokens ?? 0;
  const outputTokens = options.usage.outputTokens ?? 0;
  const cost = (inputTokens / 1_000_000) * inputPrice + (outputTokens / 1_000_000) * outputPrice;
  return cost.toFixed(8);
}

export async function recordUsageAndLog(input: {
  requestId: string;
  relayApiKeyId?: string | null;
  inputProtocol: string;
  outputProtocol: string;
  requestedModel: string;
  resolvedModel?: string | null;
  sourceId?: string | null;
  upstreamModel?: string | null;
  stream: boolean;
  status: "success" | "error";
  httpStatus?: number | null;
  errorType?: string | null;
  errorMessage?: string | null;
  usage?: InternalUsage;
  estimatedCost?: string | null;
  currency?: string | null;
  firstTokenLatencyMs?: number | null;
  totalLatencyMs?: number | null;
  fallbackAttempts?: unknown;
}): Promise<void> {
  const db = getDb();
  const usage = input.usage ?? {};
  const date = new Date().toISOString().slice(0, 10);
  const model = input.resolvedModel ?? input.requestedModel;

  await db.insert(requestLogs).values({
    requestId: input.requestId,
    relayApiKeyId: input.relayApiKeyId ?? null,
    inputProtocol: input.inputProtocol,
    outputProtocol: input.outputProtocol,
    requestedModel: input.requestedModel,
    resolvedModel: input.resolvedModel ?? null,
    sourceId: input.sourceId ?? null,
    upstreamModel: input.upstreamModel ?? null,
    stream: input.stream,
    status: input.status,
    httpStatus: input.httpStatus ?? null,
    errorType: input.errorType ?? null,
    errorMessage: input.errorMessage ?? null,
    inputTokens: usage.inputTokens ?? null,
    outputTokens: usage.outputTokens ?? null,
    totalTokens: usage.totalTokens ?? null,
    estimatedCost: input.estimatedCost ?? null,
    currency: input.currency ?? "USD",
    firstTokenLatencyMs: input.firstTokenLatencyMs ?? null,
    totalLatencyMs: input.totalLatencyMs ?? null,
    promptSaved: false,
    fallbackAttempts: input.fallbackAttempts ?? null,
  });

  await db
    .insert(dailyUsage)
    .values({
      date,
      model,
      sourceId: input.sourceId ?? null,
      requestCount: 1,
      successCount: input.status === "success" ? 1 : 0,
      errorCount: input.status === "error" ? 1 : 0,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      totalTokens: usage.totalTokens ?? 0,
      estimatedCost: input.estimatedCost ?? "0",
      currency: input.currency ?? "USD",
    })
    .onConflictDoUpdate({
      target: [dailyUsage.date, dailyUsage.model, dailyUsage.sourceId],
      set: {
        requestCount: sql`${dailyUsage.requestCount} + 1`,
        successCount: sql`${dailyUsage.successCount} + ${input.status === "success" ? 1 : 0}`,
        errorCount: sql`${dailyUsage.errorCount} + ${input.status === "error" ? 1 : 0}`,
        inputTokens: sql`${dailyUsage.inputTokens} + ${usage.inputTokens ?? 0}`,
        outputTokens: sql`${dailyUsage.outputTokens} + ${usage.outputTokens ?? 0}`,
        totalTokens: sql`${dailyUsage.totalTokens} + ${usage.totalTokens ?? 0}`,
        estimatedCost: sql`${dailyUsage.estimatedCost} + ${input.estimatedCost ?? "0"}`,
        updatedAt: new Date(),
      },
    });
}
