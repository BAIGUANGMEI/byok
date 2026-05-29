import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { modelAliases, modelMappings, providerSources, routingRules } from "@/lib/db/schema";
import { RelayError } from "@/lib/internal/errors";
import type { ModelMappingRecord, ProviderSourceRecord } from "@/lib/providers/types";

export type ResolveCandidate = {
  model: ModelMappingRecord;
  source: ProviderSourceRecord;
};

type MappingLike = {
  id: string;
  publicModelName: string;
  sourceId: string;
  enabled: boolean;
};

type AliasLike = {
  alias: string;
  targetModel: string;
  enabled: boolean;
};

type RoutingLike = {
  alias: string;
  modelMappingId: string;
  priority: number;
  enabled: boolean;
};

export function resolveModelFromRecords<TMapping extends MappingLike>(
  requestedModel: string,
  mappings: TMapping[],
  aliases: AliasLike[],
  routes: RoutingLike[],
): TMapping[] {
  const enabledMappings = mappings.filter((mapping) => mapping.enabled);
  const direct = enabledMappings.find((mapping) => mapping.publicModelName === requestedModel);
  if (direct) return [direct];

  const alias = aliases.find((item) => item.enabled && item.alias === requestedModel);
  if (!alias) return [];

  const routeMappings = routes
    .filter((route) => route.enabled && route.alias === requestedModel)
    .sort((a, b) => a.priority - b.priority)
    .map((route) => enabledMappings.find((mapping) => mapping.id === route.modelMappingId))
    .filter((mapping): mapping is TMapping => Boolean(mapping));

  if (routeMappings.length) return routeMappings;

  const aliasTarget = enabledMappings.find((mapping) => mapping.publicModelName === alias.targetModel);
  return aliasTarget ? [aliasTarget] : [];
}

function toModelRecord(row: typeof modelMappings.$inferSelect): ModelMappingRecord {
  return {
    id: row.id,
    publicModelName: row.publicModelName,
    upstreamModelName: row.upstreamModelName,
    sourceId: row.sourceId,
    supportsStreaming: row.supportsStreaming,
    supportsTools: row.supportsTools,
    supportsVision: row.supportsVision,
    supportsJsonMode: row.supportsJsonMode,
    inputPricePer1M: row.inputPricePer1M,
    outputPricePer1M: row.outputPricePer1M,
    currency: row.currency,
  };
}

function toSourceRecord(row: typeof providerSources.$inferSelect): ProviderSourceRecord {
  return {
    id: row.id,
    name: row.name,
    providerType: row.providerType,
    protocol: row.protocol as ProviderSourceRecord["protocol"],
    baseUrl: row.baseUrl,
    authType: row.authType as ProviderSourceRecord["authType"],
    apiKeyEncrypted: row.apiKeyEncrypted,
    extraHeadersEncrypted: row.extraHeadersEncrypted,
    timeoutMs: row.timeoutMs,
  };
}

export async function resolveModel(requestedModel: string): Promise<ResolveCandidate[]> {
  const db = getDb();

  const directRows = await db
    .select({ model: modelMappings, source: providerSources })
    .from(modelMappings)
    .innerJoin(providerSources, eq(modelMappings.sourceId, providerSources.id))
    .where(
      and(
        eq(modelMappings.enabled, true),
        eq(providerSources.enabled, true),
        eq(modelMappings.publicModelName, requestedModel),
      ),
    )
    .limit(1);

  if (directRows.length) {
    return directRows.map((row) => ({ model: toModelRecord(row.model), source: toSourceRecord(row.source) }));
  }

  const [alias] = await db
    .select()
    .from(modelAliases)
    .where(and(eq(modelAliases.enabled, true), eq(modelAliases.alias, requestedModel)))
    .limit(1);

  if (!alias) {
    throw new RelayError({
      type: "model_not_found",
      message: `Model not found: ${requestedModel}`,
      status: 404,
    });
  }

  const routeRows = await db
    .select({ route: routingRules })
    .from(routingRules)
    .where(and(eq(routingRules.enabled, true), eq(routingRules.alias, requestedModel)))
    .orderBy(asc(routingRules.priority));

  if (routeRows.length) {
    const ids = routeRows.map((row) => row.route.modelMappingId);
    const rows = await db
      .select({ model: modelMappings, source: providerSources })
      .from(modelMappings)
      .innerJoin(providerSources, eq(modelMappings.sourceId, providerSources.id))
      .where(and(eq(modelMappings.enabled, true), eq(providerSources.enabled, true), inArray(modelMappings.id, ids)));
    const byId = new Map(rows.map((row) => [row.model.id, row]));
    return ids
      .map((id) => byId.get(id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map((row) => ({ model: toModelRecord(row.model), source: toSourceRecord(row.source) }));
  }

  const aliasRows = await db
    .select({ model: modelMappings, source: providerSources })
    .from(modelMappings)
    .innerJoin(providerSources, eq(modelMappings.sourceId, providerSources.id))
    .where(
      and(
        eq(modelMappings.enabled, true),
        eq(providerSources.enabled, true),
        eq(modelMappings.publicModelName, alias.targetModel),
      ),
    )
    .limit(1);

  if (!aliasRows.length) {
    throw new RelayError({
      type: "model_not_found",
      message: `Alias target not found: ${alias.targetModel}`,
      status: 404,
    });
  }

  return aliasRows.map((row) => ({ model: toModelRecord(row.model), source: toSourceRecord(row.source) }));
}
