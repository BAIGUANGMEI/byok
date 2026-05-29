import { asc } from "drizzle-orm";
import { adminRoute, boolValue, numberValue, readJson, redirectAfterMutation, stringValue, wantsHtml } from "@/lib/admin/http";
import { serializeModel } from "@/lib/admin/serializers";
import { getDb } from "@/lib/db/client";
import { modelMappings } from "@/lib/db/schema";
import { RelayError } from "@/lib/internal/errors";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return adminRoute(async () => {
    const rows = await getDb().select().from(modelMappings).orderBy(asc(modelMappings.publicModelName));
    return Response.json({ data: rows.map(serializeModel) });
  });
}

export async function POST(request: Request): Promise<Response> {
  return adminRoute(async () => {
    const body = await readJson(request);
    const publicModelName = stringValue(body.publicModelName);
    const sourceId = stringValue(body.sourceId);
    const upstreamModelName = stringValue(body.upstreamModelName);
    if (!publicModelName || !sourceId || !upstreamModelName) {
      throw new RelayError({
        type: "invalid_request_error",
        message: "publicModelName, sourceId, and upstreamModelName are required",
        status: 400,
      });
    }

    const [row] = await getDb()
      .insert(modelMappings)
      .values({
        publicModelName,
        sourceId,
        upstreamModelName,
        enabled: boolValue(body.enabled, true),
        supportsStreaming: boolValue(body.supportsStreaming, true),
        supportsTools: boolValue(body.supportsTools, false),
        supportsVision: boolValue(body.supportsVision, false),
        supportsJsonMode: boolValue(body.supportsJsonMode, false),
        contextWindow: numberValue(body.contextWindow),
        maxOutputTokens: numberValue(body.maxOutputTokens),
        inputPricePer1M: stringValue(body.inputPricePer1M),
        outputPricePer1M: stringValue(body.outputPricePer1M),
        currency: stringValue(body.currency) ?? "USD",
      })
      .returning();
    if (wantsHtml(request)) return redirectAfterMutation(request, body);
    return Response.json({ data: serializeModel(row) }, { status: 201 });
  });
}
