"use client";

import { useEffect, useState } from "react";
import { ActivityTabs } from "@/components/admin/section-tabs";

type LogRow = {
  id: string;
  createdAt: string;
  requestedModel: string;
  resolvedModel?: string | null;
  status: string;
  errorType?: string | null;
  errorMessage?: string | null;
  totalTokens?: number | null;
  estimatedCost?: string | null;
};

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
