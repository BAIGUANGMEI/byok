"use client";

import { useEffect, useState } from "react";
import { BarChart, TrendChart } from "@/components/admin/metric-charts";
import { PageHeader } from "@/components/admin/page-header";
import { ActivityTabs } from "@/components/admin/section-tabs";
import { usePreferences } from "@/components/preferences-provider";
import { StatCard } from "@/components/stat-card";

type LogRow = {
  id: string;
  createdAt: string;
  requestedModel: string;
  resolvedModel?: string | null;
  status: string;
  errorType?: string | null;
  errorMessage?: string | null;
  inputTokens?: number | null;
  inputCacheHitTokens?: number | null;
  inputCacheMissTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  totalLatencyMs?: number | null;
  estimatedCost?: string | null;
};

type LogSummary = {
  requestCount: number;
  successCount: number;
  errorCount: number;
  inputTokens: number;
  inputCacheHitTokens: number;
  inputCacheMissTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: string;
  avgLatencyMs: number;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function numeric(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hourKey(value: string): string {
  const date = new Date(value);
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

export default function LogsPage() {
  const { language, text } = usePreferences();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [summary, setSummary] = useState<LogSummary>({
    requestCount: 0,
    successCount: 0,
    errorCount: 0,
    inputTokens: 0,
    inputCacheHitTokens: 0,
    inputCacheMissTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCost: "0",
    avgLatencyMs: 0,
  });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [model, setModel] = useState("");

  async function load(nextPage = pagination.page) {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(pagination.pageSize));
    if (status) params.set("status", status);
    if (model) params.set("model", model);
    try {
      const response = await fetch(`/api/admin/logs?${params.toString()}`);
      const body = (await response.json().catch(() => ({ data: [] }))) as {
        data?: LogRow[];
        summary?: LogSummary;
        pagination?: Pagination;
      };
      setRows(body.data ?? []);
      if (body.summary) setSummary(body.summary);
      if (body.pagination) setPagination(body.pagination);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1);
  }, []);

  const requestCount = summary.requestCount;
  const successCount = summary.successCount;
  const errorCount = summary.errorCount;
  const successRate = requestCount ? Math.round((successCount / requestCount) * 100) : 0;
  const errorRate = requestCount ? Math.round((errorCount / requestCount) * 100) : 0;
  const totalTokens = summary.totalTokens;
  const inputTokens = summary.inputTokens;
  const inputCacheHitTokens = summary.inputCacheHitTokens;
  const inputCacheMissTokens = summary.inputCacheMissTokens;
  const outputTokens = summary.outputTokens;
  const totalCost = numeric(summary.estimatedCost);
  const avgLatency = Math.round(summary.avgLatencyMs);
  const startRow = pagination.total ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const endRow = Math.min(pagination.page * pagination.pageSize, pagination.total);
  const hourlyRequests = Array.from(
    rows.reduce((map, row) => {
      const key = hourKey(row.createdAt);
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, value]) => ({
      label: new Date(key).toLocaleString(language === "zh" ? "zh-CN" : "en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
      }),
      value,
    }));
  const statusPoints = [
    { label: text({ en: "success", zh: "成功" }), value: successCount, detail: `${successRate}%` },
    { label: text({ en: "error", zh: "错误" }), value: errorCount, detail: `${errorRate}%` },
  ];
  const modelPoints = Array.from(
    rows.reduce((map, row) => {
      map.set(row.requestedModel, (map.get(row.requestedModel) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  )
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));

  return (
    <div className="space-y-4">
      <ActivityTabs />
      <PageHeader
        title={text({ en: "Request Logs", zh: "请求日志" })}
        description={text({ en: "Paginated request activity with filter-wide totals.", zh: "分页查看请求活动，指标按筛选结果汇总。" })}
      />
      <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <input
          className="codex-focus rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          placeholder={text({ en: "Model", zh: "模型" })}
          value={model}
          onChange={(event) => setModel(event.target.value)}
        />
        <select
          className="codex-focus rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">{text({ en: "Any status", zh: "任意状态" })}</option>
          <option value="success">{text({ en: "success", zh: "成功" })}</option>
          <option value="error">{text({ en: "error", zh: "错误" })}</option>
        </select>
        <button
          onClick={() => {
            setPagination((current) => ({ ...current, page: 1 }));
            void load(1);
          }}
          className="codex-button rounded-md px-3 py-2 text-sm font-semibold"
          disabled={loading}
        >
          {loading ? text({ en: "Loading", zh: "加载中" }) : text({ en: "Filter", zh: "筛选" })}
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label={{ en: "Requests", zh: "请求数" }} value={requestCount} />
        <StatCard label={{ en: "Success rate", zh: "成功率" }} value={`${successRate}%`} />
        <StatCard label={{ en: "Tokens", zh: "Token" }} value={totalTokens} />
        <StatCard label={{ en: "Input tokens", zh: "输入 Token" }} value={inputTokens} />
        <StatCard label={{ en: "Output tokens", zh: "输出 Token" }} value={outputTokens} />
        <StatCard label={{ en: "Cache hit input", zh: "输入命中缓存" }} value={inputCacheHitTokens} />
        <StatCard label={{ en: "Cache miss input", zh: "输入未命中" }} value={inputCacheMissTokens} />
        <StatCard label={{ en: "Errors", zh: "错误数" }} value={errorCount} />
        <StatCard label={{ en: "Cost", zh: "成本" }} value={`$${totalCost.toFixed(4)}`} />
        <StatCard label={{ en: "Avg latency", zh: "平均延迟" }} value={`${avgLatency} ms`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <TrendChart title={{ en: "Recent request activity", zh: "近期请求活动" }} points={hourlyRequests} />
        <BarChart title={{ en: "Status split", zh: "状态分布" }} points={statusPoints} />
        <BarChart title={{ en: "Models by request count", zh: "模型请求数" }} points={modelPoints} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-400">
            <tr>
              <th className="px-4 py-3">{text({ en: "Time", zh: "时间" })}</th>
              <th className="px-4 py-3">{text({ en: "Requested", zh: "请求模型" })}</th>
              <th className="px-4 py-3">{text({ en: "Resolved", zh: "解析模型" })}</th>
              <th className="px-4 py-3">{text({ en: "Status", zh: "状态" })}</th>
              <th className="px-4 py-3">{text({ en: "Tokens", zh: "Token" })}</th>
              <th className="px-4 py-3">{text({ en: "Input", zh: "输入" })}</th>
              <th className="px-4 py-3">{text({ en: "Input cache hit", zh: "输入命中缓存" })}</th>
              <th className="px-4 py-3">{text({ en: "Input cache miss", zh: "输入未命中" })}</th>
              <th className="px-4 py-3">{text({ en: "Output", zh: "输出" })}</th>
              <th className="px-4 py-3">{text({ en: "Cost", zh: "成本" })}</th>
              <th className="px-4 py-3">{text({ en: "Error", zh: "错误" })}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-zinc-800">
                <td className="px-4 py-3 font-mono text-xs">{new Date(row.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3">{row.requestedModel}</td>
                <td className="px-4 py-3">{row.resolvedModel}</td>
                <td className="px-4 py-3">{row.status}</td>
                <td className="px-4 py-3">{row.totalTokens ?? ""}</td>
                <td className="px-4 py-3">{row.inputTokens ?? ""}</td>
                <td className="px-4 py-3">{row.inputCacheHitTokens ?? ""}</td>
                <td className="px-4 py-3">{row.inputCacheMissTokens ?? ""}</td>
                <td className="px-4 py-3">{row.outputTokens ?? ""}</td>
                <td className="px-4 py-3">{row.estimatedCost ?? ""}</td>
                <td className="px-4 py-3 text-zinc-300">{row.errorType ? `${row.errorType}: ${row.errorMessage}` : ""}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td className="px-4 py-6 text-zinc-400" colSpan={11}>
                  {text({ en: "No requests found.", zh: "没有找到请求。" })}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <div className="flex flex-col gap-3 border-t border-zinc-800 px-4 py-3 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {text({ en: "Showing", zh: "显示" })} {startRow}-{endRow} / {pagination.total}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load(Math.max(pagination.page - 1, 1))}
              disabled={loading || pagination.page <= 1}
              className="codex-hover rounded-md border border-zinc-700 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {text({ en: "Previous", zh: "上一页" })}
            </button>
            <span className="min-w-24 text-center">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              type="button"
              onClick={() => void load(Math.min(pagination.page + 1, pagination.totalPages))}
              disabled={loading || pagination.page >= pagination.totalPages}
              className="codex-hover rounded-md border border-zinc-700 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {text({ en: "Next", zh: "下一页" })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
