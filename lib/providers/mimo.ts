import { buildAuthHeaders } from "@/lib/providers/common";
import type { ProviderInvokeContext } from "@/lib/providers/types";

export function isMimoContext(context: ProviderInvokeContext): boolean {
  return (
    context.source.providerType === "mimo" ||
    context.source.baseUrl.includes("xiaomimimo.com") ||
    context.model.upstreamModelName.startsWith("mimo-")
  );
}

export function buildProviderAuthHeaders(context: ProviderInvokeContext): Record<string, string> {
  return buildAuthHeaders(isMimoContext(context) ? "api-key" : context.source.authType, context.apiKey);
}
