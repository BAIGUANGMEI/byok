"use client";

import { useEffect, useState } from "react";
import { BarChart, TokenBreakdownChart, TrendChart } from "@/components/admin/metric-charts";
import { PageHeader } from "@/components/admin/page-header";
import { ActivityTabs } from "@/components/admin/section-tabs";
import { TokenConsumptionPanel } from "@/components/admin/token-consumption-panel";
import { usePreferences } from "@/components/preferences-provider";
import { buildModelTokenBreakdown } from "@/lib/usage-chart-data";

type UsageRow = Record<string, string | number | null>;

function numeric(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function labelFor(row: UsageRow, groupBy: string): string {
  const value = groupBy === "model" ? row.model : groupBy === "source" ? row.sourceId : row.date;
  return String(value || "unknown");
}

function dateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export default function UsagePage() {
  const { language, t, text } = usePreferences();
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [modelDailyRows, setModelDailyRows] = useState<UsageRow[]>([]);
  const [groupBy, setGroupBy] = useState("day");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  async function load(nextGroupBy = groupBy) {
    const response = await fetch(`/api/admin/usage?groupBy=${nextGroupBy}`);
    const body = (await response.json().catch(() => ({ data: [] }))) as { data?: UsageRow[] };
    setRows(body.data ?? []);
  }

  async function loadModelDaily() {
    const response = await fetch(`/api/admin/usage?groupBy=modelDaily&from=${dateDaysAgo(29)}`);
    const body = (await response.json().catch(() => ({ data: [] }))) as { data?: UsageRow[] };
    setModelDailyRows(body.data ?? []);
  }

  useEffect(() => {
    void load();
    void loadModelDaily();
  }, []);

  const keys = rows[0] ? Object.keys(rows[0]) : [];
  const orderedRows = groupBy === "day" ? [...rows].reverse() : rows;
  const totalPages = Math.max(Math.ceil(rows.length / pageSize), 1);
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pagedRows = rows.slice(startIndex, startIndex + pageSize);
  const startRow = rows.length ? startIndex + 1 : 0;
  const endRow = Math.min(startIndex + pageSize, rows.length);
  const requestPoints = orderedRows.map((row) => ({
    label:
      groupBy === "day"
        ? new Date(`${String(row.date)}T00:00:00.000Z`).toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", {
            month: "short",
            day: "numeric",
          })
        : labelFor(row, groupBy),
    value: numeric(row.requestCount),
  }));
  const successPoints = orderedRows.map((row) => {
    const requests = numeric(row.requestCount);
    return {
      label:
        groupBy === "day"
          ? new Date(`${String(row.date)}T00:00:00.000Z`).toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", {
              month: "short",
              day: "numeric",
            })
          : labelFor(row, groupBy),
      value: requests ? Math.round((numeric(row.successCount) / requests) * 100) : 0,
    };
  });
  const tokenPoints = orderedRows.map((row) => ({
    label:
      groupBy === "day"
        ? new Date(`${String(row.date)}T00:00:00.000Z`).toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", {
            month: "short",
            day: "numeric",
          })
        : labelFor(row, groupBy),
    value: numeric(row.totalTokens),
  }));
  const modelTokenBreakdown = buildModelTokenBreakdown(
    modelDailyRows.map((row) => ({
      date: String(row.date),
      model: row.model ? String(row.model) : null,
      inputTokens: row.inputTokens,
      inputCacheHitTokens: row.inputCacheHitTokens,
      inputCacheMissTokens: row.inputCacheMissTokens,
      outputTokens: row.outputTokens,
      totalTokens: row.totalTokens,
      estimatedCost: row.estimatedCost,
    })),
    8,
  );

  return (
    <div className="space-y-4">
      <ActivityTabs />
      <PageHeader
        title={text({ en: "Usage", zh: "用量" })}
        description={text({ en: "Daily, model, and source aggregations.", zh: "按天、模型和来源聚合。" })}
      />
      <div className="flex gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        {["day", "model", "source"].map((value) => (
          <button
            key={value}
            onClick={() => {
              setGroupBy(value);
              setPage(1);
              void load(value);
            }}
            className={`rounded-md px-3 py-2 text-sm ${
              groupBy === value ? "codex-selected" : "codex-hover border border-zinc-700 text-zinc-300"
            }`}
          >
            {text(value === "day" ? { en: "day", zh: "按天" } : value === "model" ? { en: "model", zh: "按模型" } : { en: "source", zh: "按来源" })}
          </button>
        ))}
      </div>
      <TokenConsumptionPanel title={{ en: "Token consumption", zh: "Token 消耗" }} />
      <TokenBreakdownChart title={{ en: "Model token breakdown", zh: "模型 Token 明细" }} points={modelTokenBreakdown} />
      <div className="grid gap-4 lg:grid-cols-3">
        {groupBy === "day" ? (
          <>
            <TrendChart title={{ en: "Requests", zh: "请求数" }} points={requestPoints} />
            <TrendChart title={{ en: "Success rate", zh: "成功率" }} points={successPoints} valueSuffix="%" tone="emerald" />
            <TrendChart title={{ en: "Tokens", zh: "Token" }} points={tokenPoints} tone="amber" />
          </>
        ) : (
          <>
            <BarChart title={{ en: "Requests", zh: "请求数" }} points={requestPoints} />
            <BarChart title={{ en: "Tokens", zh: "Token" }} points={tokenPoints} />
            <BarChart title={{ en: "Success rate", zh: "成功率" }} points={successPoints} valueSuffix="%" />
          </>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-400">
            <tr>
              {keys.map((key) => (
                <th key={key} className="px-4 py-3">
                  {text(
                    key === "date"
                      ? { en: "date", zh: "日期" }
                      : key === "model"
                        ? { en: "model", zh: "模型" }
                        : key === "sourceId"
                          ? { en: "source", zh: "来源" }
                          : key === "requestCount"
                            ? { en: "requests", zh: "请求数" }
                            : key === "successCount"
                              ? { en: "success", zh: "成功" }
                              : key === "errorCount"
                                ? { en: "errors", zh: "错误" }
                                : key === "totalTokens"
                                  ? { en: "tokens", zh: "Token" }
                                  : key === "inputTokens"
                                    ? { en: "input tokens", zh: "输入 Token" }
                                    : key === "inputCacheHitTokens"
                                      ? { en: "input cache hit", zh: "输入命中缓存" }
                                      : key === "inputCacheMissTokens"
                                        ? { en: "input cache miss", zh: "输入未命中" }
                                    : key === "outputTokens"
                                      ? { en: "output tokens", zh: "输出 Token" }
                                      : key === "estimatedCost"
                                        ? { en: "cost", zh: "成本" }
                                        : key,
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row, index) => (
              <tr key={index} className="border-t border-zinc-800">
                {keys.map((key) => (
                  <td key={key} className="px-4 py-3">
                    {String(row[key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td className="px-4 py-6 text-zinc-400">{t("noData")}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <div className="flex flex-col gap-3 border-t border-zinc-800 px-4 py-3 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {text({ en: "Showing", zh: "显示" })} {startRow}-{endRow} / {rows.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(value - 1, 1))}
              disabled={currentPage <= 1}
              className="codex-hover rounded-md border border-zinc-700 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {text({ en: "Previous", zh: "上一页" })}
            </button>
            <span className="min-w-24 text-center">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(value + 1, totalPages))}
              disabled={currentPage >= totalPages}
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
