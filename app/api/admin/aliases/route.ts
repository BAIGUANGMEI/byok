import { asc } from "drizzle-orm";
import { adminRoute, boolValue, readJson, redirectAfterMutation, stringValue, wantsHtml } from "@/lib/admin/http";
import { serializeAlias } from "@/lib/admin/serializers";
import { getDb } from "@/lib/db/client";
import { modelAliases } from "@/lib/db/schema";
import { RelayError } from "@/lib/internal/errors";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return adminRoute(async () => {
    const rows = await getDb().select().from(modelAliases).orderBy(asc(modelAliases.alias));
    return Response.json({ data: rows.map(serializeAlias) });
  });
}

export async function POST(request: Request): Promise<Response> {
  return adminRoute(async () => {
    const body = await readJson(request);
    const alias = stringValue(body.alias);
    const targetModel = stringValue(body.targetModel);
    if (!alias || !targetModel) {
      throw new RelayError({ type: "invalid_request_error", message: "alias and targetModel are required", status: 400 });
    }
    const [row] = await getDb()
      .insert(modelAliases)
      .values({ alias, targetModel, enabled: boolValue(body.enabled, true) })
      .returning();
    if (wantsHtml(request)) return redirectAfterMutation(request, body);
    return Response.json({ data: serializeAlias(row) }, { status: 201 });
  });
}
