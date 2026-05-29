type TrendPoint = {
  label: string;
  value: number;
};

type BarPoint = {
  label: string;
  value: number;
  detail?: string;
};

function chartValue(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function defaultFormat(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

export function TrendChart({
  title,
  points,
  formatValue = defaultFormat,
  tone = "cyan",
}: {
  title: string;
  points: TrendPoint[];
  formatValue?: (value: number) => string;
  tone?: "cyan" | "emerald" | "amber";
}) {
  const values = points.map((point) => chartValue(point.value));
  const max = Math.max(...values, 1);
  const width = 640;
  const height = 220;
  const padding = { top: 18, right: 18, bottom: 36, left: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const color = tone === "emerald" ? "#34d399" : tone === "amber" ? "#fbbf24" : "#22d3ee";
  const coordinates = values.map((value, index) => {
    const x = padding.left + (points.length <= 1 ? plotWidth : (index / (points.length - 1)) * plotWidth);
    const y = padding.top + plotHeight - (value / max) * plotHeight;
    return { x, y };
  });
  const path = coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath =
    coordinates.length > 0
      ? `${path} L ${coordinates[coordinates.length - 1].x} ${padding.top + plotHeight} L ${coordinates[0].x} ${
          padding.top + plotHeight
        } Z`
      : "";
  const latest = points[points.length - 1]?.value ?? 0;

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
          <p className="mt-1 font-mono text-2xl font-semibold text-zinc-50">{formatValue(latest)}</p>
        </div>
        <p className="text-xs text-zinc-500">{points.length ? points[0].label : ""}</p>
      </div>
      <div className="mt-4 aspect-[16/7] w-full overflow-hidden">
        {points.length ? (
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title} className="h-full w-full">
            <defs>
              <linearGradient id={`trend-${tone}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.28" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.5, 1].map((tick) => {
              const y = padding.top + plotHeight * tick;
              return <line key={tick} x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#27272a" />;
            })}
            <text x={padding.left} y={16} fill="#71717a" fontSize="11">
              {formatValue(max)}
            </text>
            {areaPath ? <path d={areaPath} fill={`url(#trend-${tone})`} /> : null}
            {path ? <path d={path} fill="none" stroke={color} strokeLinecap="round" strokeWidth="3" /> : null}
            {coordinates.map((point, index) => (
              <circle key={`${points[index].label}-${index}`} cx={point.x} cy={point.y} r="3.5" fill={color} />
            ))}
            <text x={padding.left} y={height - 10} fill="#71717a" fontSize="11">
              {points[0]?.label}
            </text>
            <text x={width - padding.right} y={height - 10} fill="#71717a" fontSize="11" textAnchor="end">
              {points[points.length - 1]?.label}
            </text>
          </svg>
        ) : (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed border-zinc-800 text-sm text-zinc-500">
            No data yet.
          </div>
        )}
      </div>
    </section>
  );
}

export function BarChart({
  title,
  points,
  formatValue = defaultFormat,
}: {
  title: string;
  points: BarPoint[];
  formatValue?: (value: number) => string;
}) {
  const visiblePoints = points.filter((point) => chartValue(point.value) > 0).slice(0, 8);
  const max = Math.max(...visiblePoints.map((point) => point.value), 1);

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
      <div className="mt-4 space-y-3">
        {visiblePoints.length ? (
          visiblePoints.map((point, index) => (
            <div key={`${point.label}-${index}`} className="grid gap-2">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-zinc-300">{point.label}</span>
                <span className="font-mono text-zinc-400">{point.detail ?? formatValue(point.value)}</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-800">
                <div
                  className="h-2 rounded-full bg-cyan-400"
                  style={{ width: `${Math.max(4, (chartValue(point.value) / max) * 100)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
            No data yet.
          </div>
        )}
      </div>
    </section>
  );
}
