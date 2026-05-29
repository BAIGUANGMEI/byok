import { and, desc, gte, lte, sql } from "drizzle-orm";
import { adminRoute } from "@/lib/admin/http";
import { getDb } from "@/lib/db/client";
import { dailyUsage } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return adminRoute(async () => {
    const url = new URL(request.url);
    const groupBy = url.searchParams.get("groupBy") ?? "day";
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const filters = [];
    if (from) filters.push(gte(dailyUsage.date, from));
    if (to) filters.push(lte(dailyUsage.date, to));
    const where = filters.length ? and(...filters) : undefined;

    if (groupBy === "model") {
      const rows = await getDb()
        .select({
          model: dailyUsage.model,
          requestCount: sql<number>`sum(${dailyUsage.requestCount})`,
          successCount: sql<number>`sum(${dailyUsage.successCount})`,
          errorCount: sql<number>`sum(${dailyUsage.errorCount})`,
          totalTokens: sql<number>`sum(${dailyUsage.totalTokens})`,
          estimatedCost: sql<string>`sum(${dailyUsage.estimatedCost})`,
        })
        .from(dailyUsage)
        .where(where)
        .groupBy(dailyUsage.model)
        .orderBy(desc(sql`sum(${dailyUsage.requestCount})`));
      return Response.json({ data: rows });
    }

    if (groupBy === "source") {
      const rows = await getDb()
        .select({
          sourceId: dailyUsage.sourceId,
          requestCount: sql<number>`sum(${dailyUsage.requestCount})`,
          successCount: sql<number>`sum(${dailyUsage.successCount})`,
          errorCount: sql<number>`sum(${dailyUsage.errorCount})`,
          totalTokens: sql<number>`sum(${dailyUsage.totalTokens})`,
          estimatedCost: sql<string>`sum(${dailyUsage.estimatedCost})`,
        })
        .from(dailyUsage)
        .where(where)
        .groupBy(dailyUsage.sourceId)
        .orderBy(desc(sql`sum(${dailyUsage.requestCount})`));
      return Response.json({ data: rows });
    }

    const rows = await getDb()
      .select({
        date: dailyUsage.date,
        requestCount: sql<number>`sum(${dailyUsage.requestCount})`,
        successCount: sql<number>`sum(${dailyUsage.successCount})`,
        errorCount: sql<number>`sum(${dailyUsage.errorCount})`,
        inputTokens: sql<number>`sum(${dailyUsage.inputTokens})`,
        outputTokens: sql<number>`sum(${dailyUsage.outputTokens})`,
        totalTokens: sql<number>`sum(${dailyUsage.totalTokens})`,
        estimatedCost: sql<string>`sum(${dailyUsage.estimatedCost})`,
      })
      .from(dailyUsage)
      .where(where)
      .groupBy(dailyUsage.date)
      .orderBy(desc(dailyUsage.date))
      .limit(100);
    return Response.json({ data: rows });
  });
}
