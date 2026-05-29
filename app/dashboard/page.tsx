import { asc, desc, eq, gte, sql } from "drizzle-orm";
import { BarChart, TrendChart } from "@/components/admin/metric-charts";
import { StatCard } from "@/components/stat-card";
import { getDb } from "@/lib/db/client";
import { dailyUsage, requestLogs } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function dateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function shortDate(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function DashboardPage() {
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const since = dateDaysAgo(13);
    const [[todayStats], recentErrors, avgRows, recentUsage, modelRows] = await Promise.all([
      db
        .select({
          requests: sql<number>`coalesce(sum(${dailyUsage.requestCount}), 0)`,
          tokens: sql<number>`coalesce(sum(${dailyUsage.totalTokens}), 0)`,
          cost: sql<string>`coalesce(sum(${dailyUsage.estimatedCost}), 0)`,
          success: sql<number>`coalesce(sum(${dailyUsage.successCount}), 0)`,
          errors: sql<number>`coalesce(sum(${dailyUsage.errorCount}), 0)`,
        })
        .from(dailyUsage)
        .where(eq(dailyUsage.date, today)),
      db
        .select()
        .from(requestLogs)
        .where(eq(requestLogs.status, "error"))
        .orderBy(desc(requestLogs.createdAt))
        .limit(10),
      db
        .select({ latency: sql<number>`coalesce(avg(${requestLogs.totalLatencyMs}), 0)` })
        .from(requestLogs)
        .where(gte(requestLogs.createdAt, new Date(`${today}T00:00:00.000Z`))),
      db
        .select({
          date: dailyUsage.date,
          requestCount: sql<number>`sum(${dailyUsage.requestCount})`,
          successCount: sql<number>`sum(${dailyUsage.successCount})`,
          errorCount: sql<number>`sum(${dailyUsage.errorCount})`,
          totalTokens: sql<number>`sum(${dailyUsage.totalTokens})`,
          estimatedCost: sql<string>`sum(${dailyUsage.estimatedCost})`,
        })
        .from(dailyUsage)
        .where(gte(dailyUsage.date, since))
        .groupBy(dailyUsage.date)
        .orderBy(asc(dailyUsage.date)),
      db
        .select({
          model: dailyUsage.model,
          requestCount: sql<number>`sum(${dailyUsage.requestCount})`,
        })
        .from(dailyUsage)
        .where(gte(dailyUsage.date, since))
        .groupBy(dailyUsage.model)
        .orderBy(desc(sql`sum(${dailyUsage.requestCount})`))
        .limit(6),
    ]);
    const successRate =
      todayStats.requests > 0 ? `${Math.round((todayStats.success / todayStats.requests) * 100)}%` : "0%";
    const requestTrend = recentUsage.map((row) => ({
      label: shortDate(row.date),
      value: numberValue(row.requestCount),
    }));
    const successTrend = recentUsage.map((row) => {
      const requests = numberValue(row.requestCount);
      const success = numberValue(row.successCount);
      return {
        label: shortDate(row.date),
        value: requests ? Math.round((success / requests) * 100) : 0,
      };
    });
    const tokenTrend = recentUsage.map((row) => ({
      label: shortDate(row.date),
      value: numberValue(row.totalTokens),
    }));
    const modelBreakdown = modelRows.map((row) => ({
      label: row.model,
      value: numberValue(row.requestCount),
    }));

    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-5">
          <StatCard label="Today requests" value={todayStats.requests} />
          <StatCard label="Today tokens" value={todayStats.tokens} />
          <StatCard label="Estimated cost" value={`$${Number(todayStats.cost).toFixed(4)}`} />
          <StatCard label="Success rate" value={successRate} />
          <StatCard label="Avg latency" value={`${Math.round(avgRows[0]?.latency ?? 0)} ms`} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <TrendChart title="Requests over time" points={requestTrend} />
          <TrendChart title="Success rate over time" points={successTrend} formatValue={(value) => `${value}%`} tone="emerald" />
          <TrendChart title="Tokens over time" points={tokenTrend} />
          <BarChart title="Top models by requests" points={modelBreakdown} />
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 px-4 py-3">
            <h2 className="font-medium">Recent errors</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Message</th>
                </tr>
              </thead>
              <tbody>
                {recentErrors.map((item) => (
                  <tr key={item.id} className="border-t border-zinc-800">
                    <td className="px-4 py-3 font-mono text-xs">{item.createdAt.toISOString()}</td>
                    <td className="px-4 py-3">{item.requestedModel}</td>
                    <td className="px-4 py-3">{item.errorType}</td>
                    <td className="px-4 py-3 text-zinc-300">{item.errorMessage}</td>
                  </tr>
                ))}
                {!recentErrors.length ? (
                  <tr>
                    <td className="px-4 py-6 text-zinc-400" colSpan={4}>
                      No errors yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="rounded-lg border border-amber-800 bg-amber-950 p-4 text-amber-100">
        {error instanceof Error ? error.message : "Dashboard unavailable"}
      </div>
    );
  }
}
