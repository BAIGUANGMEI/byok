const SECRET_KEYS = new Set([
  "authorization",
  "x-api-key",
  "api-key",
  "cookie",
  "set-cookie",
  "password",
  "api_key",
  "access_token",
  "refresh_token",
]);

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SECRET_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : redact(item),
    ]),
  );
}
