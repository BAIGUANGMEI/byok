import { RelayError, statusToErrorType } from "@/lib/internal/errors";
import type { ProviderAuthType } from "@/lib/providers/types";

export function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export function buildAuthHeaders(authType: ProviderAuthType, apiKey: string): Record<string, string> {
  if (authType === "x-api-key") return { "x-api-key": apiKey };
  if (authType === "api-key") return { "api-key": apiKey };
  return { authorization: `Bearer ${apiKey}` };
}

export async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new RelayError({
        type: "provider_timeout",
        message: "Provider request timed out",
        status: 504,
        retryable: true,
      });
    }
    throw new RelayError({
      type: "provider_error",
      message: error instanceof Error ? error.message : "Provider network error",
      status: 502,
      retryable: true,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function throwProviderError(response: Response, provider: string): Promise<never> {
  const text = await response.text().catch(() => "");
  const mapped = statusToErrorType(response.status);
  let message = text || response.statusText || "Provider request failed";

  try {
    const body = JSON.parse(text) as { error?: { message?: string }; message?: string };
    message = body.error?.message ?? body.message ?? message;
  } catch {
    // Keep text fallback.
  }

  throw new RelayError({
    type: mapped.type,
    message,
    status: mapped.httpStatus,
    retryable: mapped.retryable,
    provider,
    providerStatus: response.status,
    providerRequestId: response.headers.get("x-request-id") ?? undefined,
  });
}

export function mapFinishReason(value: unknown): "stop" | "length" | "tool_calls" | "content_filter" | "error" {
  if (value === "length" || value === "max_tokens") return "length";
  if (value === "tool_calls" || value === "tool_use") return "tool_calls";
  if (value === "content_filter") return "content_filter";
  if (value === "error") return "error";
  return "stop";
}
