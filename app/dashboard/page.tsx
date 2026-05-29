import { desc, eq, gte, sql } from "drizzle-orm";
import { StatCard } from "@/components/stat-card";
import { getDb } from "@/lib/db/client";
import { dailyUsage, requestLogs } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const [todayStats] = await db
      .select({
        requests: sql<number>`coalesce(sum(${dailyUsage.requestCount}), 0)`,
        tokens: sql<number>`coalesce(sum(${dailyUsage.totalTokens}), 0)`,
        cost: sql<string>`coalesce(sum(${dailyUsage.estimatedCost}), 0)`,
        success: sql<number>`coalesce(sum(${dailyUsage.successCount}), 0)`,
        errors: sql<number>`coalesce(sum(${dailyUsage.errorCount}), 0)`,
      })
      .from(dailyUsage)
      .where(eq(dailyUsage.date, today));
    const recentErrors = await db
      .select()
      .from(requestLogs)
      .where(eq(requestLogs.status, "error"))
      .orderBy(desc(requestLogs.createdAt))
      .limit(10);
    const avgRows = await db
      .select({ latency: sql<number>`coalesce(avg(${requestLogs.totalLatencyMs}), 0)` })
      .from(requestLogs)
      .where(gte(requestLogs.createdAt, new Date(`${today}T00:00:00.000Z`)));
    const successRate =
      todayStats.requests > 0 ? `${Math.round((todayStats.success / todayStats.requests) * 100)}%` : "0%";

    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-5">
          <StatCard label="Today requests" value={todayStats.requests} />
          <StatCard label="Today tokens" value={todayStats.tokens} />
          <StatCard label="Estimated cost" value={`$${Number(todayStats.cost).toFixed(4)}`} />
          <StatCard label="Success rate" value={successRate} />
          <StatCard label="Avg latency" value={`${Math.round(avgRows[0]?.latency ?? 0)} ms`} />
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
