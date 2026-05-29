import { RelayError } from "@/lib/internal/errors";
import type { InternalError } from "@/lib/internal/types";

const FALLBACK_TYPES = new Set<InternalError["type"]>([
  "rate_limit_error",
  "provider_timeout",
  "provider_overloaded",
  "provider_error",
]);

export function shouldFallback(error: unknown): boolean {
  if (error instanceof RelayError) return error.retryable && FALLBACK_TYPES.has(error.type);
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("network") ||
      message.includes("connection reset") ||
      message.includes("timeout") ||
      message.includes("econnreset")
    );
  }
  return false;
}
