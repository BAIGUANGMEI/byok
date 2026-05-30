export type ModelConsumptionRow = {
  date: string;
  model: string | null;
  inputTokens?: string | number | null;
  inputCacheHitTokens?: string | number | null;
  inputCacheMissTokens?: string | number | null;
  outputTokens?: string | number | null;
  totalTokens?: string | number | null;
  estimatedCost?: string | number | null;
};

export type ModelConsumptionMetric = "tokens" | "cost";

export type ModelConsumptionSeries = {
  id: string;
  label: string;
  total: number;
  points: Array<{
    label: string;
    value: number;
  }>;
};

export type TokenBreakdownPoint = {
  label: string;
  inputTokens: number;
  inputCacheHitTokens: number;
  inputCacheMissTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type TokenConsumptionRow = {
  bucket: string | Date;
  inputTokens?: string | number | null;
  inputCacheHitTokens?: string | number | null;
  inputCacheMissTokens?: string | number | null;
  outputTokens?: string | number | null;
  totalTokens?: string | number | null;
};

export type TokenConsumptionModelRow = {
  bucket: string | Date;
  model: string | null;
  totalTokens?: string | number | null;
};

export type TokenConsumptionPoint = {
  id: string;
  label: string;
  inputCacheHitTokens: number;
  inputCacheMissTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type TokenConsumptionModelSeries = {
  id: string;
  label: string;
  total: number;
  points: Array<{
    id: string;
    label: string;
    value: number;
  }>;
};

function numeric(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeTokenComponents(row: {
  inputTokens?: string | number | null;
  inputCacheHitTokens?: string | number | null;
  inputCacheMissTokens?: string | number | null;
  outputTokens?: string | number | null;
  totalTokens?: string | number | null;
}) {
  const inputTokens = numeric(row.inputTokens);
  const inputCacheHitTokens = numeric(row.inputCacheHitTokens);
  let inputCacheMissTokens = numeric(row.inputCacheMissTokens);
  const outputTokens = numeric(row.outputTokens);

  if (inputCacheHitTokens === 0 && inputCacheMissTokens === 0 && inputTokens > 0) {
    inputCacheMissTokens = inputTokens;
  }

  const componentTotal = inputCacheHitTokens + inputCacheMissTokens + outputTokens;
  const totalTokens = componentTotal > 0 ? componentTotal : numeric(row.totalTokens);

  return { inputCacheHitTokens, inputCacheMissTokens, outputTokens, totalTokens };
}

export function buildTokenConsumptionPoints(
  rows: TokenConsumptionRow[],
  { formatBucket }: { formatBucket: (bucket: string | Date) => string },
): TokenConsumptionPoint[] {
  return rows
    .map((row) => {
      const components = normalizeTokenComponents(row);
      return {
        id: row.bucket instanceof Date ? row.bucket.toISOString() : String(row.bucket),
        label: formatBucket(row.bucket),
        ...components,
      };
    })
    .filter((point) => point.totalTokens > 0);
}

export function buildTokenConsumptionModelSeries(
  rows: TokenConsumptionModelRow[],
  {
    formatBucket,
    bucketIds,
    maxSeries = 5,
  }: {
    formatBucket: (bucket: string | Date) => string;
    bucketIds?: string[];
    maxSeries?: number;
  },
): TokenConsumptionModelSeries[] {
  const normalizedBuckets = bucketIds ?? Array.from(new Set(rows.map((row) => String(row.bucket)))).sort();
  const valuesByModel = new Map<string, Map<string, number>>();
  const totalsByModel = new Map<string, number>();
  const labelsByBucket = new Map<string, string>();

  for (const row of rows) {
    const bucket = row.bucket instanceof Date ? row.bucket.toISOString() : String(row.bucket);
    const model = row.model || "unknown";
    const value = numeric(row.totalTokens);
    labelsByBucket.set(bucket, formatBucket(row.bucket));
    if (!valuesByModel.has(model)) valuesByModel.set(model, new Map());
    const valuesByBucket = valuesByModel.get(model);
    if (!valuesByBucket) continue;
    valuesByBucket.set(bucket, (valuesByBucket.get(bucket) ?? 0) + value);
    totalsByModel.set(model, (totalsByModel.get(model) ?? 0) + value);
  }

  return Array.from(valuesByModel.keys())
    .map((model) => ({ model, total: totalsByModel.get(model) ?? 0 }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total || a.model.localeCompare(b.model))
    .slice(0, maxSeries)
    .map(({ model, total }) => {
      const valuesByBucket = valuesByModel.get(model) ?? new Map<string, number>();
      return {
        id: model,
        label: model,
        total,
        points: normalizedBuckets.map((bucket) => ({
          id: bucket,
          label: labelsByBucket.get(bucket) ?? formatBucket(bucket),
          value: valuesByBucket.get(bucket) ?? 0,
        })),
      };
    });
}

export function buildModelTokenBreakdown(rows: ModelConsumptionRow[], maxSeries = 8): TokenBreakdownPoint[] {
  const valuesByModel = new Map<string, TokenBreakdownPoint>();

  for (const row of rows) {
    const model = row.model || "unknown";
    const existing =
      valuesByModel.get(model) ??
      ({
        label: model,
        inputTokens: 0,
        inputCacheHitTokens: 0,
        inputCacheMissTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      } satisfies TokenBreakdownPoint);
    existing.inputTokens += numeric(row.inputTokens);
    existing.inputCacheHitTokens += numeric(row.inputCacheHitTokens);
    existing.inputCacheMissTokens += numeric(row.inputCacheMissTokens);
    existing.outputTokens += numeric(row.outputTokens);
    existing.totalTokens += numeric(row.totalTokens);
    valuesByModel.set(model, existing);
  }

  for (const point of valuesByModel.values()) {
    const components = normalizeTokenComponents(point);
    point.inputCacheHitTokens = components.inputCacheHitTokens;
    point.inputCacheMissTokens = components.inputCacheMissTokens;
    point.outputTokens = components.outputTokens;
    point.totalTokens = components.totalTokens;
  }

  return Array.from(valuesByModel.values())
    .filter((point) => point.totalTokens > 0)
    .sort((a, b) => b.totalTokens - a.totalTokens || a.label.localeCompare(b.label))
    .slice(0, maxSeries);
}

export function buildModelConsumptionSeries(
  rows: ModelConsumptionRow[],
  {
    formatDate,
    maxSeries = 6,
    metric = "tokens",
  }: {
    formatDate: (date: string) => string;
    maxSeries?: number;
    metric?: ModelConsumptionMetric;
  },
): ModelConsumptionSeries[] {
  const dates = Array.from(new Set(rows.map((row) => row.date))).sort();
  const valuesByModel = new Map<string, Map<string, number>>();
  const totalsByModel = new Map<string, number>();

  for (const row of rows) {
    const model = row.model || "unknown";
    const value = metric === "cost" ? numeric(row.estimatedCost) : numeric(row.totalTokens);
    if (!valuesByModel.has(model)) valuesByModel.set(model, new Map());
    const valuesByDate = valuesByModel.get(model);
    if (!valuesByDate) continue;

    valuesByDate.set(row.date, (valuesByDate.get(row.date) ?? 0) + value);
    totalsByModel.set(model, (totalsByModel.get(model) ?? 0) + value);
  }

  return Array.from(valuesByModel.keys())
    .map((model) => ({ model, total: totalsByModel.get(model) ?? 0 }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total || a.model.localeCompare(b.model))
    .slice(0, maxSeries)
    .map(({ model, total }) => {
      const valuesByDate = valuesByModel.get(model) ?? new Map<string, number>();
      return {
        id: model,
        label: model,
        total,
        points: dates.map((date) => ({
          label: formatDate(date),
          value: valuesByDate.get(date) ?? 0,
        })),
      };
    });
}
