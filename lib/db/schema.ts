import {
  bigint,
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const providerSources = pgTable("provider_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  providerType: text("provider_type").notNull(),
  protocol: text("protocol").notNull(),
  baseUrl: text("base_url").notNull(),
  authType: text("auth_type").notNull(),
  apiKeyEncrypted: text("api_key_encrypted").notNull(),
  apiKeyLast4: text("api_key_last4"),
  extraHeadersEncrypted: text("extra_headers_encrypted"),
  enabled: boolean("enabled").notNull().default(true),
  priority: integer("priority").notNull().default(100),
  timeoutMs: integer("timeout_ms").notNull().default(60000),
  healthStatus: text("health_status").notNull().default("unknown"),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const modelMappings = pgTable("model_mappings", {
  id: uuid("id").defaultRandom().primaryKey(),
  publicModelName: text("public_model_name").notNull().unique(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => providerSources.id, { onDelete: "cascade" }),
  upstreamModelName: text("upstream_model_name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  supportsStreaming: boolean("supports_streaming").notNull().default(true),
  supportsTools: boolean("supports_tools").notNull().default(false),
  supportsVision: boolean("supports_vision").notNull().default(false),
  supportsJsonMode: boolean("supports_json_mode").notNull().default(false),
  contextWindow: integer("context_window"),
  maxOutputTokens: integer("max_output_tokens"),
  inputPricePer1M: numeric("input_price_per_1m", { precision: 18, scale: 8 }),
  outputPricePer1M: numeric("output_price_per_1m", { precision: 18, scale: 8 }),
  currency: text("currency").notNull().default("USD"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const modelAliases = pgTable("model_aliases", {
  id: uuid("id").defaultRandom().primaryKey(),
  alias: text("alias").notNull().unique(),
  targetModel: text("target_model").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const routingRules = pgTable("routing_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  alias: text("alias").notNull(),
  modelMappingId: uuid("model_mapping_id")
    .notNull()
    .references(() => modelMappings.id, { onDelete: "cascade" }),
  priority: integer("priority").notNull().default(100),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const relayApiKeys = pgTable("relay_api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(),
  last4: text("last4").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  monthlyTokenLimit: bigint("monthly_token_limit", { mode: "number" }),
  monthlyRequestLimit: bigint("monthly_request_limit", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const requestLogs = pgTable("request_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: text("request_id").notNull(),
  relayApiKeyId: uuid("relay_api_key_id").references(() => relayApiKeys.id, {
    onDelete: "set null",
  }),
  inputProtocol: text("input_protocol").notNull(),
  outputProtocol: text("output_protocol").notNull(),
  requestedModel: text("requested_model").notNull(),
  resolvedModel: text("resolved_model"),
  sourceId: uuid("source_id").references(() => providerSources.id, { onDelete: "set null" }),
  upstreamModel: text("upstream_model"),
  stream: boolean("stream").notNull().default(false),
  status: text("status").notNull(),
  httpStatus: integer("http_status"),
  errorType: text("error_type"),
  errorMessage: text("error_message"),
  inputTokens: integer("input_tokens"),
  inputCacheHitTokens: integer("input_cache_hit_tokens").notNull().default(0),
  inputCacheMissTokens: integer("input_cache_miss_tokens").notNull().default(0),
  outputTokens: integer("output_tokens"),
  totalTokens: integer("total_tokens"),
  estimatedCost: numeric("estimated_cost", { precision: 18, scale: 8 }),
  currency: text("currency").default("USD"),
  firstTokenLatencyMs: integer("first_token_latency_ms"),
  totalLatencyMs: integer("total_latency_ms"),
  promptSaved: boolean("prompt_saved").notNull().default(false),
  promptPreview: text("prompt_preview"),
  responsePreview: text("response_preview"),
  fallbackAttempts: jsonb("fallback_attempts"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dailyUsage = pgTable(
  "daily_usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    date: date("date").notNull(),
    model: text("model").notNull(),
    sourceId: uuid("source_id").references(() => providerSources.id, { onDelete: "set null" }),
    requestCount: integer("request_count").notNull().default(0),
    successCount: integer("success_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    inputTokens: bigint("input_tokens", { mode: "number" }).notNull().default(0),
    inputCacheHitTokens: bigint("input_cache_hit_tokens", { mode: "number" }).notNull().default(0),
    inputCacheMissTokens: bigint("input_cache_miss_tokens", { mode: "number" }).notNull().default(0),
    outputTokens: bigint("output_tokens", { mode: "number" }).notNull().default(0),
    totalTokens: bigint("total_tokens", { mode: "number" }).notNull().default(0),
    estimatedCost: numeric("estimated_cost", { precision: 18, scale: 8 }).notNull().default("0"),
    currency: text("currency").default("USD"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    dailyUsageKey: unique().on(table.date, table.model, table.sourceId),
  }),
);

export type ProviderSource = typeof providerSources.$inferSelect;
export type ModelMapping = typeof modelMappings.$inferSelect;
export type ModelAlias = typeof modelAliases.$inferSelect;
export type RoutingRule = typeof routingRules.$inferSelect;
export type RelayApiKey = typeof relayApiKeys.$inferSelect;
export type RequestLog = typeof requestLogs.$inferSelect;
export type DailyUsage = typeof dailyUsage.$inferSelect;
