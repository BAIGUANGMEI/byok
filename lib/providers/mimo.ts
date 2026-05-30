import { buildAuthHeaders } from "@/lib/providers/common";
import type { ProviderInvokeContext } from "@/lib/providers/types";

export function isMimoContext(context: ProviderInvokeContext): boolean {
  return (
    context.source.providerType === "mimo" ||
    context.source.baseUrl.includes("xiaomimimo.com") ||
    context.model.upstreamModelName.startsWith("mimo-")
  );
}

export function isKimiContext(context: ProviderInvokeContext): boolean {
  return (
    context.source.providerType === "kimi" ||
    context.source.baseUrl.includes("moonshot.cn") ||
    context.model.upstreamModelName.startsWith("kimi-") ||
    context.model.upstreamModelName.startsWith("moonshot-")
  );
}

export function buildProviderAuthHeaders(context: ProviderInvokeContext): Record<string, string> {
  return buildAuthHeaders(isMimoContext(context) ? "api-key" : context.source.authType, context.apiKey);
}
