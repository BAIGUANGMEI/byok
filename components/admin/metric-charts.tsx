"use client";

import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePreferences } from "@/components/preferences-provider";
import type { LocalizedText } from "@/lib/i18n";
import type {
  ModelConsumptionSeries,
  TokenBreakdownPoint,
  TokenConsumptionModelSeries,
  TokenConsumptionPoint,
} from "@/lib/usage-chart-data";

type TrendPoint = {
  label: string;
  value: number;
};

type BarPoint = {
  label: string;
  value: number;
  detail?: string;
};

type TooltipPayloadItem = {
  color?: string;
  dataKey?: string | number;
  fill?: string;
  name?: string | number;
  value?: string | number;
};

type TokenChartRow = {
  label: string;
  inputCacheHitTokens: number;
  inputCacheMissTokens: number;
  outputTokens: number;
  totalTokens: number;
  [key: string]: string | number;
};

type ModelChartRow = {
  label: string;
  [key: string]: string | number;
};

function chartValue(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number, language: "en" | "zh", suffix = ""): string {
  const locale = language === "zh" ? "zh-CN" : "en-US";
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)}${suffix}`;
}

function formatPercent(value: number, language: "en" | "zh"): string {
  const locale = language === "zh" ? "zh-CN" : "en-US";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1, style: "percent" }).format(value);
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-40 items-center justify-center rounded-md border border-dashed border-zinc-800 text-sm text-zinc-500">
      {label}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  formatValue: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const visiblePayload = payload.filter((item) => chartValue(item.value) > 0);
  if (!visiblePayload.length) return null;
  return (
    <div className="chart-tooltip min-w-56 rounded-md p-3 text-xs">
      <p className="chart-tooltip-title font-medium">{label}</p>
      <div className="mt-2 space-y-1.5">
        {visiblePayload.map((item) => (
          <div key={String(item.dataKey)} className="flex items-center justify-between gap-4">
            <span className="chart-tooltip-muted inline-flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color ?? item.fill }} />
              <span className="truncate">{item.name}</span>
            </span>
            <span className="chart-tooltip-value font-mono">{formatValue(chartValue(item.value))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const codexBlue = "#0a84ff";
const seriesColors = [codexBlue, "#34d399", "#fbbf24", "#a78bfa", "#fb7185", "#60a5fa"];
const tokenLineColors = ["var(--foreground)", "#c084fc", "#22d3ee", "#fb7185", "#65a30d", "#f97316"];
const breakdownColors = {
  inputCacheMiss: codexBlue,
  inputCacheHit: "#34d399",
  output: "#fbbf24",
};

const tokenSegments = [
  {
    key: "inputCacheHitTokens",
    color: breakdownColors.inputCacheHit,
    label: { en: "Input cache hit", zh: "输入命中缓存" },
    shortLabel: { en: "Cache hit", zh: "命中缓存" },
  },
  {
    key: "inputCacheMissTokens",
    color: breakdownColors.inputCacheMiss,
    label: { en: "Input cache miss", zh: "输入未命中" },
    shortLabel: { en: "Cache miss", zh: "未命中" },
  },
  {
    key: "outputTokens",
    color: breakdownColors.output,
    label: { en: "Output tokens", zh: "输出 Token" },
    shortLabel: { en: "Output", zh: "输出" },
  },
] satisfies Array<{
  key: "inputCacheHitTokens" | "inputCacheMissTokens" | "outputTokens";
  color: string;
  label: LocalizedText;
  shortLabel: LocalizedText;
}>;

function chartTone(tone: "cyan" | "emerald" | "amber") {
  if (tone === "emerald") return "#34d399";
  if (tone === "amber") return "#fbbf24";
  return codexBlue;
}

function extractActiveIndex(state: unknown, maxIndex: number): number | null {
  const index = (state as { activeTooltipIndex?: unknown })?.activeTooltipIndex;
  if (typeof index !== "number") return null;
  return Math.min(maxIndex, Math.max(0, index));
}

export function TrendChart({
  title,
  points,
  valueSuffix = "",
  tone = "cyan",
}: {
  title: LocalizedText;
  points: TrendPoint[];
  valueSuffix?: string;
  tone?: "cyan" | "emerald" | "amber";
}) {
  const { language, t, text } = usePreferences();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const formatValue = (value: number) => formatNumber(value, language, valueSuffix);
  const color = chartTone(tone);
  const chartTitle = text(title);
  const chartRows = points.map((point) => ({ label: point.label, value: chartValue(point.value) }));
  const highlightedIndex = activeIndex ?? Math.max(chartRows.length - 1, 0);
  const highlightedRow = chartRows[highlightedIndex];
  const max = Math.max(...chartRows.map((point) => point.value), 1);

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">{chartTitle}</h3>
          <p className="mt-1 font-mono text-2xl font-semibold text-zinc-50">
            {formatValue(highlightedRow?.value ?? 0)}
          </p>
        </div>
        <p className="text-xs text-zinc-500">{highlightedRow?.label ?? ""}</p>
      </div>
      <div className="mt-4 h-48 w-full">
        {chartRows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartRows}
              margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
              onMouseMove={(state) => {
                const nextIndex = extractActiveIndex(state, chartRows.length - 1);
                if (nextIndex !== null) setActiveIndex(nextIndex);
              }}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--chart-muted)", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "var(--chart-grid)" }}
                minTickGap={16}
              />
              <YAxis
                domain={[0, Math.ceil(max * 1.08)]}
                tick={{ fill: "var(--chart-muted)", fontSize: 11 }}
                tickFormatter={(value) => formatValue(Number(value))}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <Tooltip content={<ChartTooltip formatValue={formatValue} />} cursor={{ stroke: color, strokeOpacity: 0.3 }} />
              <Area type="monotone" dataKey="value" name={chartTitle} fill={color} fillOpacity={0.16} stroke="none" />
              <Line
                type="monotone"
                dataKey="value"
                name={chartTitle}
                stroke={color}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5, stroke: "var(--background)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart label={t("noData")} />
        )}
      </div>
    </section>
  );
}

export function BarChart({
  title,
  points,
  valueSuffix = "",
}: {
  title: LocalizedText;
  points: BarPoint[];
  valueSuffix?: string;
}) {
  const { language, t, text } = usePreferences();
  const formatValue = (value: number) => formatNumber(value, language, valueSuffix);
  const chartRows = points
    .filter((point) => chartValue(point.value) > 0)
    .slice(0, 8)
    .map((point) => ({ label: point.label, value: chartValue(point.value), detail: point.detail }));
  const max = Math.max(...chartRows.map((point) => point.value), 1);

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="text-sm font-medium text-zinc-200">{text(title)}</h3>
      <div className="mt-4 h-64 w-full">
        {chartRows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart
              data={chartRows}
              layout="vertical"
              margin={{ top: 4, right: 18, bottom: 4, left: 8 }}
              barCategoryGap="24%"
            >
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, Math.ceil(max * 1.08)]}
                tick={{ fill: "var(--chart-muted)", fontSize: 11 }}
                tickFormatter={(value) => formatValue(Number(value))}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={108}
                tick={{ fill: "var(--chart-muted)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartTooltip formatValue={formatValue} />} cursor={{ fill: "rgb(113 113 122 / 0.12)" }} />
              <Bar dataKey="value" name={text(title)} fill={codexBlue} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} />
            </RechartsBarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart label={t("noData")} />
        )}
      </div>
    </section>
  );
}

export function MultiSeriesTrendChart({
  title,
  series,
  valueSuffix = "",
  className = "",
}: {
  title: LocalizedText;
  series: ModelConsumptionSeries[];
  valueSuffix?: string;
  className?: string;
}) {
  const { language, t, text } = usePreferences();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const formatValue = (value: number) => formatNumber(value, language, valueSuffix);
  const labels = useMemo(() => {
    const seen = new Set<string>();
    const nextLabels: string[] = [];
    for (const item of series) {
      for (const point of item.points) {
        if (seen.has(point.label)) continue;
        seen.add(point.label);
        nextLabels.push(point.label);
      }
    }
    return nextLabels;
  }, [series]);
  const chartSeries = series
    .map((item, index) => ({
      id: item.id,
      label: item.label,
      dataKey: `series${index}`,
      color: seriesColors[index % seriesColors.length],
      valueLookup: new Map(item.points.map((point) => [point.label, chartValue(point.value)])),
    }))
    .filter((item) => labels.some((label) => chartValue(item.valueLookup.get(label)) > 0));
  const chartRows: ModelChartRow[] = labels.map((label) => {
    const row: ModelChartRow = { label };
    for (const item of chartSeries) {
      row[item.dataKey] = chartValue(item.valueLookup.get(label));
    }
    return row;
  });
  const values = chartRows.flatMap((row) => chartSeries.map((item) => chartValue(row[item.dataKey])));
  const max = Math.max(...values, 1);
  const hasData = chartRows.length > 0 && chartSeries.length > 0;
  const highlightedIndex = activeIndex ?? Math.max(chartRows.length - 1, 0);
  const highlightedRow = chartRows[highlightedIndex];
  const highlightedRows = chartSeries
    .map((item) => ({
      id: item.id,
      label: item.label,
      color: item.color,
      value: chartValue(highlightedRow?.[item.dataKey]),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const highlightedTotal = highlightedRows.reduce((sum, row) => sum + row.value, 0);

  return (
    <section className={`rounded-lg border border-zinc-800 bg-zinc-900 p-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">{text(title)}</h3>
          <p className="mt-1 font-mono text-2xl font-semibold text-zinc-50">{formatValue(highlightedTotal)}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {highlightedRow?.label ?? text({ en: "No period selected", zh: "未选择时间点" })}
          </p>
        </div>
        <p className="text-xs text-zinc-500">{text({ en: "Hover or tap the chart for details", zh: "悬停或点击图表查看明细" })}</p>
      </div>
      <div className="mt-4 h-72 w-full">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartRows}
              margin={{ top: 16, right: 18, bottom: 8, left: 4 }}
              onMouseMove={(state) => {
                const nextIndex = extractActiveIndex(state, chartRows.length - 1);
                if (nextIndex !== null) setActiveIndex(nextIndex);
              }}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--chart-muted)", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "var(--chart-grid)" }}
                minTickGap={16}
              />
              <YAxis
                domain={[0, Math.ceil(max * 1.08)]}
                tick={{ fill: "var(--chart-muted)", fontSize: 11 }}
                tickFormatter={(value) => formatValue(Number(value))}
                tickLine={false}
                axisLine={false}
                width={58}
              />
              <Tooltip content={<ChartTooltip formatValue={formatValue} />} cursor={{ stroke: "var(--chart-muted)", strokeDasharray: "4 6" }} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ color: "var(--chart-muted)", fontSize: 12, paddingBottom: 8 }}
              />
              {chartSeries.map((item) => (
                <Line
                  key={item.id}
                  type="monotone"
                  dataKey={item.dataKey}
                  name={item.label}
                  stroke={item.color}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, stroke: "var(--background)", strokeWidth: 2 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart label={t("noData")} />
        )}
      </div>
      {hasData ? (
        <div className="mt-3 grid gap-2 border-t border-zinc-800 pt-3 sm:grid-cols-2 lg:grid-cols-3">
          {highlightedRows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 rounded-md bg-zinc-950 px-3 py-2 text-xs">
              <span className="flex min-w-0 items-center gap-2 text-zinc-300">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                <span className="truncate">{row.label}</span>
              </span>
              <span className="font-mono text-zinc-100">{formatValue(row.value)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function TokenConsumptionBarChart({
  title,
  points,
  modelSeries = [],
  unit,
  unitOptions = [],
  onUnitChange,
  loading = false,
  className = "",
}: {
  title: LocalizedText;
  points: TokenConsumptionPoint[];
  modelSeries?: TokenConsumptionModelSeries[];
  unit?: string;
  unitOptions?: Array<{ value: string; label: LocalizedText }>;
  onUnitChange?: (value: string) => void;
  loading?: boolean;
  className?: string;
}) {
  const { language, t, text } = usePreferences();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const formatValue = (value: number) => formatNumber(value, language);
  const visiblePoints = points.slice(-48);
  const hasData = visiblePoints.length > 0;
  const highlightedIndex = activeIndex ?? Math.max(visiblePoints.length - 1, 0);
  const activePoint = visiblePoints[highlightedIndex];
  const activeTotal = activePoint?.totalTokens ?? 0;
  const modelLineSeries = modelSeries
    .map((series, index) => {
      const valuesByBucket = new Map(series.points.map((point) => [point.id, chartValue(point.value)]));
      const values = visiblePoints.map((point) => valuesByBucket.get(point.id) ?? 0);
      return {
        id: series.id,
        label: series.label,
        dataKey: `modelLine${index}`,
        color: tokenLineColors[(index + 1) % tokenLineColors.length],
        values,
        total: values.reduce((sum, value) => sum + value, 0),
      };
    })
    .filter((series) => series.total > 0);
  const lineSeries = hasData ? modelLineSeries : [];
  const chartRows: TokenChartRow[] = visiblePoints.map((point, index) => {
    const row: TokenChartRow = {
      label: point.label,
      inputCacheHitTokens: point.inputCacheHitTokens,
      inputCacheMissTokens: point.inputCacheMissTokens,
      outputTokens: point.outputTokens,
      totalTokens: point.totalTokens,
    };
    for (const series of modelLineSeries) {
      row[series.dataKey] = chartValue(series.values[index]);
    }
    return row;
  });
  const max = Math.max(
    ...visiblePoints.map((point) => chartValue(point.totalTokens)),
    ...lineSeries.flatMap((series) => series.values),
    1,
  );
  const chartTitle = text(title);
  const tickTarget = unit === "week" ? 8 : unit === "day" ? 6 : 7;
  const tickStep = visiblePoints.length <= tickTarget ? 1 : Math.ceil(visiblePoints.length / tickTarget);
  const xAxisTicks = visiblePoints
    .map((point, index) => ({ point, index }))
    .filter(({ index }) => index === 0 || index === visiblePoints.length - 1 || index % tickStep === 0)
    .map(({ point }) => point.label);
  const lineDetailRows = lineSeries.map((series) => {
    const value = chartValue(series.values[highlightedIndex]);
    return {
      id: series.id,
      label: series.label,
      color: series.color,
      value,
      ratio: activeTotal > 0 ? value / activeTotal : 0,
    };
  });
  const componentRows = tokenSegments.map((segment) => {
    const value = activePoint ? chartValue(activePoint[segment.key]) : 0;
    return {
      ...segment,
      value,
      ratio: activeTotal > 0 ? value / activeTotal : 0,
    };
  });

  return (
    <section className={`rounded-lg border border-zinc-800 bg-zinc-900 p-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">{chartTitle}</h3>
          <p className="mt-1 font-mono text-2xl font-semibold text-zinc-50">{formatValue(activeTotal)}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {activePoint?.label ?? text({ en: "No period selected", zh: "未选择时间段" })}
            {loading ? ` · ${text({ en: "Loading", zh: "加载中" })}` : ""}
          </p>
        </div>
        {unitOptions.length ? (
          <div className="flex flex-wrap gap-2">
            {unitOptions.map((option) => {
              const selected = option.value === unit;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onUnitChange?.(option.value)}
                  className={`rounded-md border px-3 py-2 text-xs font-medium transition ${
                    selected ? "codex-selected" : "codex-hover border-zinc-700 text-zinc-300"
                  }`}
                >
                  {text(option.label)}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="mt-4 h-[340px] w-full">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartRows}
              margin={{ top: 16, right: 18, bottom: 10, left: 4 }}
              onMouseMove={(state) => {
                const nextIndex = extractActiveIndex(state, visiblePoints.length - 1);
                if (nextIndex !== null) setActiveIndex(nextIndex);
              }}
              onMouseLeave={() => setActiveIndex(null)}
              barCategoryGap="28%"
            >
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false} />
              <XAxis
                dataKey="label"
                ticks={xAxisTicks}
                tick={{ fill: "var(--chart-muted)", fontSize: 11 }}
                tickLine={{ stroke: "var(--chart-muted)" }}
                axisLine={{ stroke: "var(--chart-grid)" }}
                interval={0}
                minTickGap={14}
              />
              <YAxis
                domain={[0, Math.ceil(max * 1.08)]}
                tick={{ fill: "var(--chart-muted)", fontSize: 11 }}
                tickFormatter={(value) => formatValue(Number(value))}
                tickLine={false}
                axisLine={false}
                width={58}
              />
              <Tooltip
                content={<ChartTooltip formatValue={formatValue} />}
                cursor={{ fill: "rgb(113 113 122 / 0.12)" }}
                wrapperStyle={{ outline: "none" }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ color: "var(--chart-muted)", fontSize: 12, paddingBottom: 8 }}
              />
              {tokenSegments.map((segment) => (
                <Bar
                  key={segment.key}
                  dataKey={segment.key}
                  name={text(segment.shortLabel)}
                  stackId="tokens"
                  fill={segment.color}
                  radius={segment.key === "outputTokens" ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  maxBarSize={34}
                  isAnimationActive={false}
                />
              ))}
              {lineSeries.map((series) => (
                <Line
                  key={series.id}
                  type="monotone"
                  dataKey={series.dataKey}
                  name={series.label}
                  stroke={series.color}
                  strokeWidth={2.4}
                  dot={false}
                  activeDot={{ r: 4, stroke: "var(--background)", strokeWidth: 2 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart label={loading ? text({ en: "Loading", zh: "加载中" }) : t("noData")} />
        )}
      </div>
      {hasData ? (
        <div className="mt-3 space-y-3 border-t border-zinc-800 pt-3">
          <div className="grid gap-2 md:grid-cols-3">
            {componentRows.map((segment) => (
              <div key={segment.key} className="rounded-md bg-zinc-950 px-3 py-2">
                <div className="flex items-center justify-between gap-3 text-xs text-zinc-400">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
                    <span className="truncate">{text(segment.shortLabel)}</span>
                  </span>
                  <span className="font-mono">{formatPercent(segment.ratio, language)}</span>
                </div>
                <p className="mt-1 font-mono text-lg font-semibold text-zinc-100">{formatValue(segment.value)}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {lineDetailRows.map((row) => (
              <div key={row.id} className="rounded-md bg-zinc-950 px-3 py-2">
                <div className="flex items-center justify-between gap-3 text-xs text-zinc-400">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <span className="h-0.5 w-5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                    <span className="truncate">{row.label}</span>
                  </span>
                  <span className="font-mono">{formatPercent(row.ratio, language)}</span>
                </div>
                <p className="mt-1 font-mono text-lg font-semibold text-zinc-100">{formatValue(row.value)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function TokenBreakdownChart({
  title,
  points,
  className = "",
}: {
  title: LocalizedText;
  points: TokenBreakdownPoint[];
  className?: string;
}) {
  const { language, t, text } = usePreferences();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const formatValue = (value: number) => formatNumber(value, language);
  const visiblePoints = points.filter((point) => chartValue(point.totalTokens) > 0).slice(0, 8);
  const chartRows = visiblePoints.map((point) => ({
    label: point.label,
    inputCacheHitTokens: point.inputCacheHitTokens,
    inputCacheMissTokens: point.inputCacheMissTokens,
    outputTokens: point.outputTokens,
    totalTokens: point.totalTokens,
  }));
  const highlightedIndex = activeIndex ?? 0;
  const activePoint = visiblePoints[highlightedIndex];
  const max = Math.max(...visiblePoints.map((point) => chartValue(point.totalTokens)), 1);
  const componentRows = tokenSegments.map((segment) => {
    const value = activePoint ? chartValue(activePoint[segment.key]) : 0;
    const total = activePoint ? chartValue(activePoint.totalTokens) : 0;
    return {
      ...segment,
      value,
      ratio: total > 0 ? value / total : 0,
    };
  });

  return (
    <section className={`rounded-lg border border-zinc-800 bg-zinc-900 p-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">{text(title)}</h3>
          <p className="mt-1 font-mono text-2xl font-semibold text-zinc-50">
            {activePoint ? formatValue(activePoint.totalTokens) : "0"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {activePoint?.label ?? text({ en: "No model selected", zh: "未选择模型" })}
          </p>
        </div>
      </div>
      <div className="mt-4 h-[360px] w-full">
        {chartRows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart
              data={chartRows}
              layout="vertical"
              margin={{ top: 16, right: 18, bottom: 8, left: 8 }}
              onMouseMove={(state) => {
                const nextIndex = extractActiveIndex(state, chartRows.length - 1);
                if (nextIndex !== null) setActiveIndex(nextIndex);
              }}
              onMouseLeave={() => setActiveIndex(null)}
              barCategoryGap="22%"
            >
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, Math.ceil(max * 1.08)]}
                tick={{ fill: "var(--chart-muted)", fontSize: 11 }}
                tickFormatter={(value) => formatValue(Number(value))}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={150}
                tick={{ fill: "var(--chart-muted)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={<ChartTooltip formatValue={formatValue} />}
                cursor={{ fill: "rgb(113 113 122 / 0.12)" }}
                wrapperStyle={{ outline: "none" }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ color: "var(--chart-muted)", fontSize: 12, paddingBottom: 8 }}
              />
              {tokenSegments.map((segment) => (
                <Bar
                  key={segment.key}
                  dataKey={segment.key}
                  name={text(segment.shortLabel)}
                  stackId="tokens"
                  fill={segment.color}
                  radius={segment.key === "outputTokens" ? [0, 4, 4, 0] : [0, 0, 0, 0]}
                  maxBarSize={26}
                  isAnimationActive={false}
                />
              ))}
            </RechartsBarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart label={t("noData")} />
        )}
      </div>
      {activePoint ? (
        <div className="mt-3 grid gap-2 border-t border-zinc-800 pt-3 md:grid-cols-3">
          {componentRows.map((segment) => (
            <div key={segment.key} className="rounded-md bg-zinc-950 px-3 py-2">
              <div className="flex items-center justify-between gap-3 text-xs text-zinc-400">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
                  <span className="truncate">{text(segment.shortLabel)}</span>
                </span>
                <span className="font-mono">{formatPercent(segment.ratio, language)}</span>
              </div>
              <p className="mt-1 font-mono text-lg font-semibold text-zinc-100">{formatValue(segment.value)}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
