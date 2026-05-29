import { and, desc, eq, gte, lte } from "drizzle-orm";
import { adminRoute } from "@/lib/admin/http";
import { getDb } from "@/lib/db/client";
import { requestLogs } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return adminRoute(async () => {
    const url = new URL(request.url);
    const filters = [];
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const model = url.searchParams.get("model");
    const status = url.searchParams.get("status");
    const sourceId = url.searchParams.get("sourceId");
    if (from) filters.push(gte(requestLogs.createdAt, new Date(from)));
    if (to) filters.push(lte(requestLogs.createdAt, new Date(to)));
    if (model) filters.push(eq(requestLogs.requestedModel, model));
    if (status) filters.push(eq(requestLogs.status, status));
    if (sourceId) filters.push(eq(requestLogs.sourceId, sourceId));
    const rows = await getDb()
      .select()
      .from(requestLogs)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(requestLogs.createdAt))
      .limit(100);
    return Response.json({ data: rows });
  });
}
