CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS provider_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider_type text NOT NULL,
  protocol text NOT NULL,
  base_url text NOT NULL,
  auth_type text NOT NULL,
  api_key_encrypted text NOT NULL,
  api_key_last4 text,
  extra_headers_encrypted text,
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  timeout_ms integer NOT NULL DEFAULT 60000,
  health_status text NOT NULL DEFAULT 'unknown',
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS model_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_model_name text NOT NULL UNIQUE,
  source_id uuid NOT NULL REFERENCES provider_sources(id) ON DELETE CASCADE,
  upstream_model_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  supports_streaming boolean NOT NULL DEFAULT true,
  supports_tools boolean NOT NULL DEFAULT false,
  supports_vision boolean NOT NULL DEFAULT false,
  supports_json_mode boolean NOT NULL DEFAULT false,
  context_window integer,
  max_output_tokens integer,
  input_price_per_1m numeric(18,8),
  output_price_per_1m numeric(18,8),
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS model_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias text NOT NULL UNIQUE,
  target_model text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias text NOT NULL,
  model_mapping_id uuid NOT NULL REFERENCES model_mappings(id) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS relay_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  last4 text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  monthly_token_limit bigint,
  monthly_request_limit bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE TABLE IF NOT EXISTS request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL,
  relay_api_key_id uuid REFERENCES relay_api_keys(id) ON DELETE SET NULL,
  input_protocol text NOT NULL,
  output_protocol text NOT NULL,
  requested_model text NOT NULL,
  resolved_model text,
  source_id uuid REFERENCES provider_sources(id) ON DELETE SET NULL,
  upstream_model text,
  stream boolean NOT NULL DEFAULT false,
  status text NOT NULL,
  http_status integer,
  error_type text,
  error_message text,
  input_tokens integer,
  input_cache_hit_tokens integer NOT NULL DEFAULT 0,
  input_cache_miss_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer,
  total_tokens integer,
  estimated_cost numeric(18,8),
  currency text DEFAULT 'USD',
  first_token_latency_ms integer,
  total_latency_ms integer,
  prompt_saved boolean NOT NULL DEFAULT false,
  prompt_preview text,
  response_preview text,
  fallback_attempts jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  model text NOT NULL,
  source_id uuid REFERENCES provider_sources(id) ON DELETE SET NULL,
  request_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  input_tokens bigint NOT NULL DEFAULT 0,
  input_cache_hit_tokens bigint NOT NULL DEFAULT 0,
  input_cache_miss_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  total_tokens bigint NOT NULL DEFAULT 0,
  estimated_cost numeric(18,8) NOT NULL DEFAULT 0,
  currency text DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(date, model, source_id)
);

CREATE INDEX IF NOT EXISTS request_logs_created_at_idx ON request_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS request_logs_requested_model_idx ON request_logs(requested_model);
CREATE INDEX IF NOT EXISTS daily_usage_date_idx ON daily_usage(date DESC);
CREATE INDEX IF NOT EXISTS model_mappings_source_id_idx ON model_mappings(source_id);
CREATE INDEX IF NOT EXISTS routing_rules_model_mapping_id_idx ON routing_rules(model_mapping_id);
CREATE INDEX IF NOT EXISTS request_logs_relay_api_key_id_idx ON request_logs(relay_api_key_id);
CREATE INDEX IF NOT EXISTS request_logs_source_id_idx ON request_logs(source_id);
CREATE INDEX IF NOT EXISTS daily_usage_source_id_idx ON daily_usage(source_id);

ALTER TABLE provider_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE relay_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_usage ENABLE ROW LEVEL SECURITY;
