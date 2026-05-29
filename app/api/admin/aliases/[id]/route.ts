import { eq } from "drizzle-orm";
import { adminRoute, boolValue, readJson, stringValue } from "@/lib/admin/http";
import { serializeAlias } from "@/lib/admin/serializers";
import { getDb } from "@/lib/db/client";
import { modelAliases } from "@/lib/db/schema";
import { RelayError } from "@/lib/internal/errors";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context): Promise<Response> {
  return adminRoute(async () => {
    const { id } = await context.params;
    const body = await readJson(request);
    const updates: Partial<typeof modelAliases.$inferInsert> = { updatedAt: new Date() };
    if (body.alias !== undefined) updates.alias = stringValue(body.alias) ?? "";
    if (body.targetModel !== undefined) updates.targetModel = stringValue(body.targetModel) ?? "";
    if (body.enabled !== undefined) updates.enabled = boolValue(body.enabled, true);
    const [row] = await getDb().update(modelAliases).set(updates).where(eq(modelAliases.id, id)).returning();
    if (!row) throw new RelayError({ type: "model_not_found", message: "Alias not found", status: 404 });
    return Response.json({ data: serializeAlias(row) });
  });
}

export async function DELETE(_request: Request, context: Context): Promise<Response> {
  return adminRoute(async () => {
    const { id } = await context.params;
    await getDb().delete(modelAliases).where(eq(modelAliases.id, id));
    return Response.json({ ok: true });
  });
}
