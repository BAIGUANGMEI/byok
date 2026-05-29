import { eq } from "drizzle-orm";
import { adminRoute, boolValue, numberValue, readJson, stringValue } from "@/lib/admin/http";
import { serializeRelayKey } from "@/lib/admin/serializers";
import { getDb } from "@/lib/db/client";
import { relayApiKeys } from "@/lib/db/schema";
import { RelayError } from "@/lib/internal/errors";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context): Promise<Response> {
  return adminRoute(async () => {
    const { id } = await context.params;
    const body = await readJson(request);
    const updates: Partial<typeof relayApiKeys.$inferInsert> = {};
    if (body.name !== undefined) updates.name = stringValue(body.name) ?? "Relay key";
    if (body.enabled !== undefined) updates.enabled = boolValue(body.enabled, true);
    if (body.monthlyTokenLimit !== undefined) updates.monthlyTokenLimit = numberValue(body.monthlyTokenLimit);
    if (body.monthlyRequestLimit !== undefined) updates.monthlyRequestLimit = numberValue(body.monthlyRequestLimit);
    const [row] = await getDb().update(relayApiKeys).set(updates).where(eq(relayApiKeys.id, id)).returning();
    if (!row) throw new RelayError({ type: "model_not_found", message: "Relay key not found", status: 404 });
    return Response.json({ data: serializeRelayKey(row) });
  });
}

export async function DELETE(_request: Request, context: Context): Promise<Response> {
  return adminRoute(async () => {
    const { id } = await context.params;
    await getDb().delete(relayApiKeys).where(eq(relayApiKeys.id, id));
    return Response.json({ ok: true });
  });
}
