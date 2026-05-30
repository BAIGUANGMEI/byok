import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  ADMIN_EMAIL: z.string().email("ADMIN_EMAIL must be a valid email"),
  ADMIN_PASSWORD: z.string().min(1, "ADMIN_PASSWORD is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  ENCRYPTION_KEY_BASE64: z.string().min(1, "ENCRYPTION_KEY_BASE64 is required"),
  RELAY_DEFAULT_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  RELAY_MAX_REQUEST_BODY_BYTES: z.coerce.number().int().positive().default(4500000),
  LOG_PROMPTS_DEFAULT: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  ALLOW_INSECURE_PROVIDER_URLS: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  NEXT_PUBLIC_APP_NAME: z.string().default("BYOK"),
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(): AppEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${message}`);
  }
  return parsed.data;
}

export function getOptionalAppName(): string {
  return process.env.NEXT_PUBLIC_APP_NAME || "BYOK";
}
