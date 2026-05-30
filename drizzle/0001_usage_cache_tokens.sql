ALTER TABLE request_logs
  ADD COLUMN IF NOT EXISTS input_cache_hit_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS input_cache_miss_tokens integer NOT NULL DEFAULT 0;

ALTER TABLE daily_usage
  ADD COLUMN IF NOT EXISTS input_cache_hit_tokens bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS input_cache_miss_tokens bigint NOT NULL DEFAULT 0;

UPDATE request_logs
SET
  input_cache_hit_tokens = 0,
  input_cache_miss_tokens = COALESCE(input_tokens, 0)
WHERE input_cache_hit_tokens = 0
  AND input_cache_miss_tokens = 0
  AND COALESCE(input_tokens, 0) > 0;

UPDATE daily_usage
SET
  input_cache_hit_tokens = 0,
  input_cache_miss_tokens = input_tokens
WHERE input_cache_hit_tokens = 0
  AND input_cache_miss_tokens = 0
  AND input_tokens > 0;
