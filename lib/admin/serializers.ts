import type {
  ModelAlias,
  ModelMapping,
  ProviderSource,
  RelayApiKey,
  RoutingRule,
} from "@/lib/db/schema";

export function serializeSource(source: ProviderSource): Record<string, unknown> {
  return {
    id: source.id,
    name: source.name,
    providerType: source.providerType,
    protocol: source.protocol,
    baseUrl: source.baseUrl,
    authType: source.authType,
    apiKeyLast4: source.apiKeyLast4,
    enabled: source.enabled,
    priority: source.priority,
    timeoutMs: source.timeoutMs,
    healthStatus: source.healthStatus,
    lastCheckedAt: source.lastCheckedAt,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

export function serializeModel(model: ModelMapping): Record<string, unknown> {
  return {
    ...model,
    inputPricePer1M: model.inputPricePer1M ?? "",
    outputPricePer1M: model.outputPricePer1M ?? "",
  };
}

export function serializeAlias(alias: ModelAlias): Record<string, unknown> {
  return alias;
}

export function serializeRoute(route: RoutingRule): Record<string, unknown> {
  return route;
}

export function serializeRelayKey(key: RelayApiKey): Record<string, unknown> {
  return {
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    last4: key.last4,
    enabled: key.enabled,
    monthlyTokenLimit: key.monthlyTokenLimit,
    monthlyRequestLimit: key.monthlyRequestLimit,
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt,
  };
}
