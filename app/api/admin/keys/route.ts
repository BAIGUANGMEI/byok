import { desc } from "drizzle-orm";
import { adminRoute, boolValue, numberValue, readJson, stringValue, wantsHtml } from "@/lib/admin/http";
import { serializeRelayKey } from "@/lib/admin/serializers";
import { createRelayKey, hashRelayKey } from "@/lib/crypto/hash";
import { getDb } from "@/lib/db/client";
import { relayApiKeys } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return adminRoute(async () => {
    const rows = await getDb().select().from(relayApiKeys).orderBy(desc(relayApiKeys.createdAt));
    return Response.json({ data: rows.map(serializeRelayKey) });
  });
}

export async function POST(request: Request): Promise<Response> {
  return adminRoute(async () => {
    const body = await readJson(request);
    const rawKey = createRelayKey();
    const [row] = await getDb()
      .insert(relayApiKeys)
      .values({
        name: stringValue(body.name) ?? "Relay key",
        keyHash: hashRelayKey(rawKey),
        keyPrefix: rawKey.slice(0, 16),
        last4: rawKey.slice(-4),
        enabled: boolValue(body.enabled, true),
        monthlyTokenLimit: numberValue(body.monthlyTokenLimit),
        monthlyRequestLimit: numberValue(body.monthlyRequestLimit),
      })
      .returning();
    if (wantsHtml(request)) {
      const requestedRedirect = stringValue(body._redirect);
      const redirectPath = requestedRedirect?.startsWith("/") ? requestedRedirect : "/dashboard/keys";
      return new Response(
        `<!doctype html><html><head><meta charset="utf-8"><title>Relay key created</title></head><body style="font-family: sans-serif; background: #09090b; color: #f4f4f5; padding: 32px;"><h1>Relay key created</h1><p>This key is shown once. Store it now.</p><pre style="background:#18181b; border:1px solid #3f3f46; padding:16px; overflow:auto;">${rawKey}</pre><p><a style="color:#67e8f9" href="${redirectPath}">Back to keys</a></p></body></html>`,
        { headers: { "content-type": "text/html; charset=utf-8" }, status: 201 },
      );
    }
    return Response.json({ data: { ...serializeRelayKey(row), key: rawKey } }, { status: 201 });
  });
}
