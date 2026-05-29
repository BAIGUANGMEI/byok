import { eq } from "drizzle-orm";
import { adminRoute, boolValue, numberValue, readJson, stringValue } from "@/lib/admin/http";
import { serializeSource } from "@/lib/admin/serializers";
import { encryptSecret } from "@/lib/crypto/encrypt";
import { getDb } from "@/lib/db/client";
import { providerSources } from "@/lib/db/schema";
import { RelayError } from "@/lib/internal/errors";
import { validateBaseUrl } from "@/lib/security/validate-base-url";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context): Promise<Response> {
  return adminRoute(async () => {
    const { id } = await context.params;
    const [row] = await getDb().select().from(providerSources).where(eq(providerSources.id, id)).limit(1);
    if (!row) throw new RelayError({ type: "model_not_found", message: "Source not found", status: 404 });
    return Response.json({ data: serializeSource(row) });
  });
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  return adminRoute(async () => {
    const { id } = await context.params;
    const body = await readJson(request);
    const updates: Partial<typeof providerSources.$inferInsert> = { updatedAt: new Date() };
    const baseUrl = stringValue(body.baseUrl);
    if (baseUrl) {
      validateBaseUrl(baseUrl);
      updates.baseUrl = baseUrl;
    }
    if (body.name !== undefined) updates.name = stringValue(body.name) ?? "Untitled source";
    if (body.providerType !== undefined) updates.providerType = stringValue(body.providerType) ?? "custom";
    if (body.protocol !== undefined) updates.protocol = stringValue(body.protocol) ?? "openai_chat";
    if (body.authType !== undefined) updates.authType = stringValue(body.authType) ?? "bearer";
    if (body.enabled !== undefined) updates.enabled = boolValue(body.enabled, true);
    if (body.priority !== undefined) updates.priority = numberValue(body.priority) ?? 100;
    if (body.timeoutMs !== undefined) updates.timeoutMs = numberValue(body.timeoutMs) ?? 60000;
    const apiKey = stringValue(body.apiKey);
    if (apiKey) {
      updates.apiKeyEncrypted = encryptSecret(apiKey);
      updates.apiKeyLast4 = apiKey.slice(-4);
    }
    if (body.extraHeaders !== undefined) {
      const value = stringValue(body.extraHeaders);
      updates.extraHeadersEncrypted = value ? encryptSecret(value) : null;
    }

    const [row] = await getDb()
      .update(providerSources)
      .set(updates)
      .where(eq(providerSources.id, id))
      .returning();
    if (!row) throw new RelayError({ type: "model_not_found", message: "Source not found", status: 404 });
    return Response.json({ data: serializeSource(row) });
  });
}

export async function DELETE(_request: Request, context: Context): Promise<Response> {
  return adminRoute(async () => {
    const { id } = await context.params;
    await getDb().delete(providerSources).where(eq(providerSources.id, id));
    return Response.json({ ok: true });
  });
}
