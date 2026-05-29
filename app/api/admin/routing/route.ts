import { asc } from "drizzle-orm";
import { adminRoute, boolValue, numberValue, readJson, redirectAfterMutation, stringValue, wantsHtml } from "@/lib/admin/http";
import { serializeRoute } from "@/lib/admin/serializers";
import { getDb } from "@/lib/db/client";
import { routingRules } from "@/lib/db/schema";
import { RelayError } from "@/lib/internal/errors";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return adminRoute(async () => {
    const rows = await getDb().select().from(routingRules).orderBy(asc(routingRules.alias), asc(routingRules.priority));
    return Response.json({ data: rows.map(serializeRoute) });
  });
}

export async function POST(request: Request): Promise<Response> {
  return adminRoute(async () => {
    const body = await readJson(request);
    const alias = stringValue(body.alias);
    const modelMappingId = stringValue(body.modelMappingId);
    if (!alias || !modelMappingId) {
      throw new RelayError({ type: "invalid_request_error", message: "alias and modelMappingId are required", status: 400 });
    }
    const [row] = await getDb()
      .insert(routingRules)
      .values({
        alias,
        modelMappingId,
        priority: numberValue(body.priority) ?? 100,
        enabled: boolValue(body.enabled, true),
      })
      .returning();
    if (wantsHtml(request)) return redirectAfterMutation(request, body);
    return Response.json({ data: serializeRoute(row) }, { status: 201 });
  });
}
