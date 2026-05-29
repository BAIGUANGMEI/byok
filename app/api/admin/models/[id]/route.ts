import { eq } from "drizzle-orm";
import { adminRoute, boolValue, numberValue, readJson, stringValue } from "@/lib/admin/http";
import { serializeModel } from "@/lib/admin/serializers";
import { getDb } from "@/lib/db/client";
import { modelMappings } from "@/lib/db/schema";
import { RelayError } from "@/lib/internal/errors";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context): Promise<Response> {
  return adminRoute(async () => {
    const { id } = await context.params;
    const body = await readJson(request);
    const updates: Partial<typeof modelMappings.$inferInsert> = { updatedAt: new Date() };
    if (body.publicModelName !== undefined) updates.publicModelName = stringValue(body.publicModelName) ?? "";
    if (body.sourceId !== undefined) updates.sourceId = stringValue(body.sourceId) ?? "";
    if (body.upstreamModelName !== undefined) updates.upstreamModelName = stringValue(body.upstreamModelName) ?? "";
    if (body.enabled !== undefined) updates.enabled = boolValue(body.enabled, true);
    if (body.supportsStreaming !== undefined) updates.supportsStreaming = boolValue(body.supportsStreaming, true);
    if (body.supportsTools !== undefined) updates.supportsTools = boolValue(body.supportsTools, false);
    if (body.supportsVision !== undefined) updates.supportsVision = boolValue(body.supportsVision, false);
    if (body.supportsJsonMode !== undefined) updates.supportsJsonMode = boolValue(body.supportsJsonMode, false);
    if (body.contextWindow !== undefined) updates.contextWindow = numberValue(body.contextWindow);
    if (body.maxOutputTokens !== undefined) updates.maxOutputTokens = numberValue(body.maxOutputTokens);
    if (body.inputPricePer1M !== undefined) updates.inputPricePer1M = stringValue(body.inputPricePer1M);
    if (body.outputPricePer1M !== undefined) updates.outputPricePer1M = stringValue(body.outputPricePer1M);
    if (body.currency !== undefined) updates.currency = stringValue(body.currency) ?? "USD";

    const [row] = await getDb().update(modelMappings).set(updates).where(eq(modelMappings.id, id)).returning();
    if (!row) throw new RelayError({ type: "model_not_found", message: "Model mapping not found", status: 404 });
    return Response.json({ data: serializeModel(row) });
  });
}

export async function DELETE(_request: Request, context: Context): Promise<Response> {
  return adminRoute(async () => {
    const { id } = await context.params;
    await getDb().delete(modelMappings).where(eq(modelMappings.id, id));
    return Response.json({ ok: true });
  });
}
