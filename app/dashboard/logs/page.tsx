"use client";

import { useEffect, useState } from "react";
import { BarChart, TrendChart } from "@/components/admin/metric-charts";
import { ActivityTabs } from "@/components/admin/section-tabs";
import { StatCard } from "@/components/stat-card";

type LogRow = {
  id: string;
  createdAt: string;
  requestedModel: string;
  resolvedModel?: string | null;
  status: string;
  errorType?: string | null;
  errorMessage?: string | null;
  totalTokens?: number | null;
  totalLatencyMs?: number | null;
  estimatedCost?: string | null;
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

function hourLabel(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
  });
}

export default function LogsPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [status, setStatus] = useState("");
  const [model, setModel] = useState("");

  async function load() {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (model) params.set("model", model);
    const response = await fetch(`/api/admin/logs?${params.toString()}`);
    const body = (await response.json().catch(() => ({ data: [] }))) as { data?: LogRow[] };
    setRows(body.data ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  const requestCount = rows.length;
  const successCount = rows.filter((row) => row.status === "success").length;
  const errorCount = rows.filter((row) => row.status === "error").length;
  const successRate = requestCount ? Math.round((successCount / requestCount) * 100) : 0;
  const totalTokens = rows.reduce((sum, row) => sum + numeric(row.totalTokens), 0);
  const totalCost = rows.reduce((sum, row) => sum + numeric(row.estimatedCost), 0);
  const latencyRows = rows.filter((row) => row.totalLatencyMs !== null && row.totalLatencyMs !== undefined);
  const avgLatency = latencyRows.length
    ? Math.round(latencyRows.reduce((sum, row) => sum + numeric(row.totalLatencyMs), 0) / latencyRows.length)
    : 0;
  const hourlyRequests = Array.from(
    rows.reduce((map, row) => {
      const key = hourKey(row.createdAt);
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, value]) => ({ label: hourLabel(key), value }));
  const statusPoints = [
    { label: "success", value: successCount, detail: `${successRate}%` },
    { label: "error", value: errorCount, detail: `${100 - successRate}%` },
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
      <div>
        <h2 className="text-xl font-semibold">Request Logs</h2>
        <p className="text-sm text-zinc-400">Newest 100 requests by default.</p>
      </div>
      <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <input
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          placeholder="Model"
          value={model}
          onChange={(event) => setModel(event.target.value)}
        />
        <select
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">Any status</option>
          <option value="success">success</option>
          <option value="error">error</option>
        </select>
        <button onClick={load} className="rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-zinc-950">
          Filter
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Requests" value={requestCount} />
        <StatCard label="Success rate" value={`${successRate}%`} />
        <StatCard label="Errors" value={errorCount} />
        <StatCard label="Tokens" value={totalTokens} />
        <StatCard label="Cost" value={`$${totalCost.toFixed(4)}`} />
        <StatCard label="Avg latency" value={`${avgLatency} ms`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <TrendChart title="Recent request activity" points={hourlyRequests} />
        <BarChart title="Status split" points={statusPoints} />
        <BarChart title="Models by request count" points={modelPoints} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-400">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Requested</th>
              <th className="px-4 py-3">Resolved</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Tokens</th>
              <th className="px-4 py-3">Cost</th>
              <th className="px-4 py-3">Error</th>
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
                <td className="px-4 py-3">{row.estimatedCost ?? ""}</td>
                <td className="px-4 py-3 text-zinc-300">{row.errorType ? `${row.errorType}: ${row.errorMessage}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
