import { and, asc, desc, gte, lte, sql } from "drizzle-orm";
import { adminRoute } from "@/lib/admin/http";
import { getDb } from "@/lib/db/client";
import { dailyUsage, requestLogs } from "@/lib/db/schema";

export const runtime = "nodejs";

function dateParam(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function serializeBucket(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const normalized = (value.includes("T") ? value : value.replace(" ", "T")).replace(/([+-]\d{2})$/, "$1:00");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

export async function GET(request: Request): Promise<Response> {
  return adminRoute(async () => {
    const url = new URL(request.url);
    const groupBy = url.searchParams.get("groupBy") ?? "day";
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (groupBy === "tokenBuckets") {
      const unitParam = url.searchParams.get("unit");
      const unit = unitParam === "day" || unitParam === "week" ? unitParam : "hour";
      const bucket =
        unit === "week"
          ? sql<Date>`date_trunc('week', ${requestLogs.createdAt})`
          : unit === "day"
            ? sql<Date>`date_trunc('day', ${requestLogs.createdAt})`
            : sql<Date>`date_trunc('hour', ${requestLogs.createdAt})`;
      const logFilters = [];
      const fromDate = dateParam(from);
      const toDate = dateParam(to);
      if (fromDate) logFilters.push(gte(requestLogs.createdAt, fromDate));
      if (toDate) logFilters.push(lte(requestLogs.createdAt, toDate));
      const where = logFilters.length ? and(...logFilters) : undefined;
      const db = getDb();
      const [rows, modelRows] = await Promise.all([
        db
          .select({
            bucket,
            requestCount: sql<string>`count(*)`,
            inputTokens: sql<string>`coalesce(sum(${requestLogs.inputTokens}), 0)`,
            inputCacheHitTokens: sql<string>`coalesce(sum(${requestLogs.inputCacheHitTokens}), 0)`,
            inputCacheMissTokens: sql<string>`coalesce(sum(${requestLogs.inputCacheMissTokens}), 0)`,
            outputTokens: sql<string>`coalesce(sum(${requestLogs.outputTokens}), 0)`,
            totalTokens: sql<string>`coalesce(sum(${requestLogs.totalTokens}), 0)`,
          })
          .from(requestLogs)
          .where(where)
          .groupBy(bucket)
          .orderBy(asc(bucket))
          .limit(unit === "hour" ? 168 : unit === "day" ? 366 : 104),
        db
          .select({
            bucket,
            model: requestLogs.requestedModel,
            totalTokens: sql<string>`coalesce(sum(${requestLogs.totalTokens}), 0)`,
          })
          .from(requestLogs)
          .where(where)
          .groupBy(bucket, requestLogs.requestedModel)
          .orderBy(asc(bucket)),
      ]);
      return Response.json({
        data: rows.map((row) => ({ ...row, bucket: serializeBucket(row.bucket) })),
        models: modelRows.map((row) => ({ ...row, bucket: serializeBucket(row.bucket) })),
        unit,
      });
    }

    const filters = [];
    if (from) filters.push(gte(dailyUsage.date, from));
    if (to) filters.push(lte(dailyUsage.date, to));
    const where = filters.length ? and(...filters) : undefined;

    if (groupBy === "modelDaily") {
      const rows = await getDb()
        .select({
          date: dailyUsage.date,
          model: dailyUsage.model,
          inputTokens: sql<number>`sum(${dailyUsage.inputTokens})`,
          inputCacheHitTokens: sql<number>`sum(${dailyUsage.inputCacheHitTokens})`,
          inputCacheMissTokens: sql<number>`sum(${dailyUsage.inputCacheMissTokens})`,
          outputTokens: sql<number>`sum(${dailyUsage.outputTokens})`,
          totalTokens: sql<number>`sum(${dailyUsage.totalTokens})`,
          estimatedCost: sql<string>`sum(${dailyUsage.estimatedCost})`,
        })
        .from(dailyUsage)
        .where(where)
        .groupBy(dailyUsage.date, dailyUsage.model)
        .orderBy(asc(dailyUsage.date));
      return Response.json({ data: rows });
    }

    if (groupBy === "model") {
      const rows = await getDb()
        .select({
          model: dailyUsage.model,
          requestCount: sql<number>`sum(${dailyUsage.requestCount})`,
          successCount: sql<number>`sum(${dailyUsage.successCount})`,
          errorCount: sql<number>`sum(${dailyUsage.errorCount})`,
          inputTokens: sql<number>`sum(${dailyUsage.inputTokens})`,
          inputCacheHitTokens: sql<number>`sum(${dailyUsage.inputCacheHitTokens})`,
          inputCacheMissTokens: sql<number>`sum(${dailyUsage.inputCacheMissTokens})`,
          outputTokens: sql<number>`sum(${dailyUsage.outputTokens})`,
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
          inputTokens: sql<number>`sum(${dailyUsage.inputTokens})`,
          inputCacheHitTokens: sql<number>`sum(${dailyUsage.inputCacheHitTokens})`,
          inputCacheMissTokens: sql<number>`sum(${dailyUsage.inputCacheMissTokens})`,
          outputTokens: sql<number>`sum(${dailyUsage.outputTokens})`,
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
        inputCacheHitTokens: sql<number>`sum(${dailyUsage.inputCacheHitTokens})`,
        inputCacheMissTokens: sql<number>`sum(${dailyUsage.inputCacheMissTokens})`,
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
