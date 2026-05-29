import { eq } from "drizzle-orm";
import { adminRoute } from "@/lib/admin/http";
import { decryptSecret } from "@/lib/crypto/encrypt";
import { getDb } from "@/lib/db/client";
import { providerSources } from "@/lib/db/schema";
import { RelayError } from "@/lib/internal/errors";
import { getProviderAdapter } from "@/lib/providers/registry";
import type { ModelMappingRecord, ProviderSourceRecord } from "@/lib/providers/types";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context): Promise<Response> {
  return adminRoute(async () => {
    const { id } = await context.params;
    const [source] = await getDb().select().from(providerSources).where(eq(providerSources.id, id)).limit(1);
    if (!source) throw new RelayError({ type: "model_not_found", message: "Source not found", status: 404 });
    const adapter = getProviderAdapter(source.protocol);
    const result = await adapter.testConnection({
      source: {
        id: source.id,
        name: source.name,
        providerType: source.providerType,
        protocol: source.protocol as ProviderSourceRecord["protocol"],
        baseUrl: source.baseUrl,
        authType: source.authType as ProviderSourceRecord["authType"],
        apiKeyEncrypted: source.apiKeyEncrypted,
        timeoutMs: source.timeoutMs,
      },
      model: {
        id: "test",
        publicModelName: "test",
        upstreamModelName: "test",
        sourceId: source.id,
        supportsStreaming: true,
      } satisfies ModelMappingRecord,
      apiKey: decryptSecret(source.apiKeyEncrypted),
      timeoutMs: source.timeoutMs,
    });
    await getDb()
      .update(providerSources)
      .set({ healthStatus: result.ok ? "healthy" : "error", lastCheckedAt: new Date() })
      .where(eq(providerSources.id, id));
    return Response.json(result);
  });
}
