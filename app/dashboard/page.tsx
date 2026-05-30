import Link from "next/link";
import { asc, desc, eq, gte, sql } from "drizzle-orm";
import { BarChart, TokenBreakdownChart, TrendChart } from "@/components/admin/metric-charts";
import { PageHeader } from "@/components/admin/page-header";
import { TokenConsumptionPanel } from "@/components/admin/token-consumption-panel";
import { LocalizedText } from "@/components/localized-text";
import { StatCard } from "@/components/stat-card";
import { getDb } from "@/lib/db/client";
import { dailyUsage, requestLogs } from "@/lib/db/schema";
import { buildModelTokenBreakdown } from "@/lib/usage-chart-data";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const ERROR_PAGE_SIZE = 10;

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

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function dashboardHref(errorPage: number): string {
  return errorPage > 1 ? `/dashboard?errorPage=${errorPage}` : "/dashboard";
}

export default async function DashboardPage({ searchParams }: PageProps) {
  try {
    const params = (await searchParams) ?? {};
    const errorPage = parsePage(firstParam(params.errorPage));
    const errorOffset = (errorPage - 1) * ERROR_PAGE_SIZE;
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const since = dateDaysAgo(13);
    const [[todayStats], recentErrors, [errorTotalRow], avgRows, recentUsage, modelRows, modelUsageRows] = await Promise.all([
      db
        .select({
          requests: sql<number>`coalesce(sum(${dailyUsage.requestCount}), 0)`,
          tokens: sql<number>`coalesce(sum(${dailyUsage.totalTokens}), 0)`,
          inputTokens: sql<number>`coalesce(sum(${dailyUsage.inputTokens}), 0)`,
          inputCacheHitTokens: sql<number>`coalesce(sum(${dailyUsage.inputCacheHitTokens}), 0)`,
          inputCacheMissTokens: sql<number>`coalesce(sum(${dailyUsage.inputCacheMissTokens}), 0)`,
          outputTokens: sql<number>`coalesce(sum(${dailyUsage.outputTokens}), 0)`,
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
        .limit(ERROR_PAGE_SIZE)
        .offset(errorOffset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(requestLogs)
        .where(eq(requestLogs.status, "error")),
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
      db
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
        .where(gte(dailyUsage.date, since))
        .groupBy(dailyUsage.date, dailyUsage.model)
        .orderBy(asc(dailyUsage.date)),
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
    const tokenBreakdown = buildModelTokenBreakdown(modelUsageRows, 8);
    const errorTotal = errorTotalRow?.total ?? 0;
    const errorTotalPages = Math.max(Math.ceil(errorTotal / ERROR_PAGE_SIZE), 1);
    const errorStart = errorTotal ? errorOffset + 1 : 0;
    const errorEnd = Math.min(errorOffset + recentErrors.length, errorTotal);

    return (
      <div className="space-y-6">
        <PageHeader
          title={<LocalizedText value={{ en: "Overview", zh: "概览" }} />}
          description={<LocalizedText value={{ en: "Daily gateway health, usage, and model consumption.", zh: "每日网关健康状态、用量和模型消耗。" }} />}
        />
        <div className="grid gap-4 md:grid-cols-5">
          <StatCard label={{ en: "Today requests", zh: "今日请求" }} value={todayStats.requests} />
          <StatCard label={{ en: "Today tokens", zh: "今日 Token" }} value={todayStats.tokens} />
          <StatCard label={{ en: "Input tokens", zh: "输入 Token" }} value={todayStats.inputTokens} />
          <StatCard label={{ en: "Output tokens", zh: "输出 Token" }} value={todayStats.outputTokens} />
          <StatCard label={{ en: "Input cache hit", zh: "输入命中缓存" }} value={todayStats.inputCacheHitTokens} />
          <StatCard label={{ en: "Input cache miss", zh: "输入未命中" }} value={todayStats.inputCacheMissTokens} />
          <StatCard label={{ en: "Estimated cost", zh: "预估成本" }} value={`$${Number(todayStats.cost).toFixed(4)}`} />
          <StatCard label={{ en: "Success rate", zh: "成功率" }} value={successRate} />
          <StatCard label={{ en: "Avg latency", zh: "平均延迟" }} value={`${Math.round(avgRows[0]?.latency ?? 0)} ms`} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <TokenConsumptionPanel
            title={{ en: "Token consumption", zh: "Token 消耗" }}
            className="lg:col-span-2"
          />
          <TokenBreakdownChart
            title={{ en: "Model token breakdown", zh: "模型 Token 明细" }}
            points={tokenBreakdown}
            className="lg:col-span-2"
          />
          <TrendChart title={{ en: "Requests over time", zh: "请求趋势" }} points={requestTrend} />
          <TrendChart title={{ en: "Success rate over time", zh: "成功率趋势" }} points={successTrend} valueSuffix="%" tone="emerald" />
          <TrendChart title={{ en: "Tokens over time", zh: "Token 趋势" }} points={tokenTrend} />
          <BarChart title={{ en: "Top models by requests", zh: "模型请求排行" }} points={modelBreakdown} />
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 px-4 py-3">
            <h2 className="font-medium">
              <LocalizedText value={{ en: "Recent errors", zh: "近期错误" }} />
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-zinc-400">
                <tr>
                  <th className="px-4 py-3"><LocalizedText value={{ en: "Time", zh: "时间" }} /></th>
                  <th className="px-4 py-3"><LocalizedText value={{ en: "Model", zh: "模型" }} /></th>
                  <th className="px-4 py-3"><LocalizedText value={{ en: "Type", zh: "类型" }} /></th>
                  <th className="px-4 py-3"><LocalizedText value={{ en: "Message", zh: "消息" }} /></th>
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
                      <LocalizedText value={{ en: "No errors yet.", zh: "暂无错误。" }} />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-zinc-800 px-4 py-3 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <LocalizedText value={{ en: "Showing", zh: "显示" }} /> {errorStart}-{errorEnd} / {errorTotal}
            </span>
            <div className="flex items-center gap-2">
              {errorPage > 1 ? (
                <Link href={dashboardHref(errorPage - 1)} className="codex-hover rounded-md border border-zinc-700 px-3 py-2">
                  <LocalizedText value={{ en: "Previous", zh: "上一页" }} />
                </Link>
              ) : (
                <span className="rounded-md border border-zinc-700 px-3 py-2 opacity-50">
                  <LocalizedText value={{ en: "Previous", zh: "上一页" }} />
                </span>
              )}
              <span className="min-w-24 text-center">
                <LocalizedText value={{ en: "Page", zh: "第" }} /> {Math.min(errorPage, errorTotalPages)} / {errorTotalPages}
              </span>
              {errorPage < errorTotalPages ? (
                <Link href={dashboardHref(errorPage + 1)} className="codex-hover rounded-md border border-zinc-700 px-3 py-2">
                  <LocalizedText value={{ en: "Next", zh: "下一页" }} />
                </Link>
              ) : (
                <span className="rounded-md border border-zinc-700 px-3 py-2 opacity-50">
                  <LocalizedText value={{ en: "Next", zh: "下一页" }} />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="rounded-lg border border-amber-800 bg-amber-950 p-4 text-amber-100">
        <LocalizedText
          value={{
            en: error instanceof Error ? error.message : "Dashboard unavailable",
            zh: error instanceof Error ? error.message : "仪表盘暂不可用",
          }}
        />
      </div>
    );
  }
}
