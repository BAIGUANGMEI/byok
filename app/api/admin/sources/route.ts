import { asc } from "drizzle-orm";
import { adminRoute, boolValue, numberValue, readJson, redirectAfterMutation, stringValue, wantsHtml } from "@/lib/admin/http";
import { serializeSource } from "@/lib/admin/serializers";
import { encryptSecret } from "@/lib/crypto/encrypt";
import { getDb } from "@/lib/db/client";
import { providerSources } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { RelayError } from "@/lib/internal/errors";
import { validateBaseUrl } from "@/lib/security/validate-base-url";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return adminRoute(async () => {
    const rows = await getDb().select().from(providerSources).orderBy(asc(providerSources.priority));
    return Response.json({ data: rows.map(serializeSource) });
  });
}

export async function POST(request: Request): Promise<Response> {
  return adminRoute(async () => {
    const body = await readJson(request);
    const apiKey = stringValue(body.apiKey);
    const baseUrl = stringValue(body.baseUrl);
    if (!apiKey) throw new RelayError({ type: "invalid_request_error", message: "apiKey is required", status: 400 });
    if (!baseUrl) throw new RelayError({ type: "invalid_request_error", message: "baseUrl is required", status: 400 });
    validateBaseUrl(baseUrl);

    const [row] = await getDb()
      .insert(providerSources)
      .values({
        name: stringValue(body.name) ?? "Untitled source",
        providerType: stringValue(body.providerType) ?? "custom",
        protocol: stringValue(body.protocol) ?? "openai_chat",
        baseUrl,
        authType: stringValue(body.authType) ?? "bearer",
        apiKeyEncrypted: encryptSecret(apiKey),
        apiKeyLast4: apiKey.slice(-4),
        extraHeadersEncrypted: body.extraHeaders ? encryptSecret(String(body.extraHeaders)) : null,
        enabled: boolValue(body.enabled, true),
        priority: numberValue(body.priority) ?? 100,
        timeoutMs: numberValue(body.timeoutMs) ?? getEnv().RELAY_DEFAULT_TIMEOUT_MS,
      })
      .returning();

    if (wantsHtml(request)) return redirectAfterMutation(request, body);
    return Response.json({ data: serializeSource(row) }, { status: 201 });
  });
}
