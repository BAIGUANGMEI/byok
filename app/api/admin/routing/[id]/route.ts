import { eq } from "drizzle-orm";
import { adminRoute, boolValue, numberValue, readJson, stringValue } from "@/lib/admin/http";
import { serializeRoute } from "@/lib/admin/serializers";
import { getDb } from "@/lib/db/client";
import { routingRules } from "@/lib/db/schema";
import { RelayError } from "@/lib/internal/errors";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context): Promise<Response> {
  return adminRoute(async () => {
    const { id } = await context.params;
    const body = await readJson(request);
    const updates: Partial<typeof routingRules.$inferInsert> = { updatedAt: new Date() };
    if (body.alias !== undefined) updates.alias = stringValue(body.alias) ?? "";
    if (body.modelMappingId !== undefined) updates.modelMappingId = stringValue(body.modelMappingId) ?? "";
    if (body.priority !== undefined) updates.priority = numberValue(body.priority) ?? 100;
    if (body.enabled !== undefined) updates.enabled = boolValue(body.enabled, true);
    const [row] = await getDb().update(routingRules).set(updates).where(eq(routingRules.id, id)).returning();
    if (!row) throw new RelayError({ type: "model_not_found", message: "Routing rule not found", status: 404 });
    return Response.json({ data: serializeRoute(row) });
  });
}

export async function DELETE(_request: Request, context: Context): Promise<Response> {
  return adminRoute(async () => {
    const { id } = await context.params;
    await getDb().delete(routingRules).where(eq(routingRules.id, id));
    return Response.json({ ok: true });
  });
}
