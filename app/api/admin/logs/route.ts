import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { adminRoute } from "@/lib/admin/http";
import { getDb } from "@/lib/db/client";
import { requestLogs } from "@/lib/db/schema";

export const runtime = "nodejs";

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request): Promise<Response> {
  return adminRoute(async () => {
    const url = new URL(request.url);
    const filters = [];
    const page = positiveInteger(url.searchParams.get("page"), 1);
    const pageSize = Math.min(positiveInteger(url.searchParams.get("pageSize"), 20), 100);
    const offset = (page - 1) * pageSize;
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
    const where = filters.length ? and(...filters) : undefined;
    const db = getDb();
    const [[totals], [summary], rows] = await Promise.all([
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(requestLogs)
        .where(where),
      db
        .select({
          requestCount: sql<number>`count(*)::int`,
          successCount: sql<number>`coalesce(sum(case when ${requestLogs.status} = 'success' then 1 else 0 end), 0)::int`,
          errorCount: sql<number>`coalesce(sum(case when ${requestLogs.status} = 'error' then 1 else 0 end), 0)::int`,
          inputTokens: sql<number>`coalesce(sum(${requestLogs.inputTokens}), 0)::int`,
          inputCacheHitTokens: sql<number>`coalesce(sum(${requestLogs.inputCacheHitTokens}), 0)::int`,
          inputCacheMissTokens: sql<number>`coalesce(sum(${requestLogs.inputCacheMissTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${requestLogs.outputTokens}), 0)::int`,
          totalTokens: sql<number>`coalesce(sum(${requestLogs.totalTokens}), 0)::int`,
          estimatedCost: sql<string>`coalesce(sum(${requestLogs.estimatedCost}), 0)`,
          avgLatencyMs: sql<number>`coalesce(avg(${requestLogs.totalLatencyMs}), 0)::int`,
        })
        .from(requestLogs)
        .where(where),
      db
        .select()
        .from(requestLogs)
        .where(where)
        .orderBy(desc(requestLogs.createdAt))
        .limit(pageSize)
        .offset(offset),
    ]);
    const total = totals?.total ?? 0;
    return Response.json({
      data: rows,
      summary,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(Math.ceil(total / pageSize), 1),
      },
    });
  });
}
