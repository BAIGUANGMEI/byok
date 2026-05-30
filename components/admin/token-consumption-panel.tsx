"use client";

import { useEffect, useMemo, useState } from "react";
import { TokenConsumptionBarChart } from "@/components/admin/metric-charts";
import { usePreferences } from "@/components/preferences-provider";
import type { LocalizedText } from "@/lib/i18n";
import {
  buildTokenConsumptionModelSeries,
  buildTokenConsumptionPoints,
  type TokenConsumptionModelRow,
  type TokenConsumptionRow,
} from "@/lib/usage-chart-data";

type TokenUnit = "hour" | "day" | "week";

const unitOptions: Array<{ value: TokenUnit; label: LocalizedText }> = [
  { value: "hour", label: { en: "Hourly", zh: "按小时" } },
  { value: "day", label: { en: "Daily", zh: "按天" } },
  { value: "week", label: { en: "Weekly", zh: "按周" } },
];

function rangeStart(unit: TokenUnit): string {
  const date = new Date();
  if (unit === "hour") date.setHours(date.getHours() - 24);
  if (unit === "day") date.setDate(date.getDate() - 30);
  if (unit === "week") date.setDate(date.getDate() - 84);
  return date.toISOString();
}

function formatBucket(value: string | Date, unit: TokenUnit, language: "en" | "zh"): string {
  const date = value instanceof Date ? value : new Date(value);
  const locale = language === "zh" ? "zh-CN" : "en-US";
  if (unit === "hour") {
    return date.toLocaleString(locale, { month: "numeric", day: "numeric", hour: "numeric" });
  }
  return date.toLocaleDateString(locale, { month: "numeric", day: "numeric" });
}

export function TokenConsumptionPanel({
  title,
  className = "",
}: {
  title: LocalizedText;
  className?: string;
}) {
  const { language } = usePreferences();
  const [unit, setUnit] = useState<TokenUnit>("hour");
  const [rows, setRows] = useState<TokenConsumptionRow[]>([]);
  const [modelRows, setModelRows] = useState<TokenConsumptionModelRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      const params = new URLSearchParams({
        groupBy: "tokenBuckets",
        unit,
        from: rangeStart(unit),
      });
      try {
        const response = await fetch(`/api/admin/usage?${params.toString()}`, { signal: controller.signal });
        const body = (await response.json().catch(() => ({ data: [], models: [] }))) as {
          data?: TokenConsumptionRow[];
          models?: TokenConsumptionModelRow[];
        };
        setRows(body.data ?? []);
        setModelRows(body.models ?? []);
      } catch {
        if (!controller.signal.aborted) {
          setRows([]);
          setModelRows([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [unit]);

  const points = useMemo(
    () =>
      buildTokenConsumptionPoints(rows, {
        formatBucket: (bucket) => formatBucket(bucket, unit, language),
      }),
    [language, rows, unit],
  );
  const modelSeries = useMemo(
    () =>
      buildTokenConsumptionModelSeries(modelRows, {
        bucketIds: points.map((point) => point.id),
        formatBucket: (bucket) => formatBucket(bucket, unit, language),
        maxSeries: 5,
      }),
    [language, modelRows, points, unit],
  );

  return (
    <TokenConsumptionBarChart
      title={title}
      points={points}
      modelSeries={modelSeries}
      unit={unit}
      unitOptions={unitOptions}
      onUnitChange={(value) => setUnit(value as TokenUnit)}
      loading={loading}
      className={className}
    />
  );
}
