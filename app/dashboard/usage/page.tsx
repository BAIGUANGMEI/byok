"use client";

import { useEffect, useState } from "react";
import { ActivityTabs } from "@/components/admin/section-tabs";

type UsageRow = Record<string, string | number | null>;

export default function UsagePage() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [groupBy, setGroupBy] = useState("day");

  async function load(nextGroupBy = groupBy) {
    const response = await fetch(`/api/admin/usage?groupBy=${nextGroupBy}`);
    const body = (await response.json().catch(() => ({ data: [] }))) as { data?: UsageRow[] };
    setRows(body.data ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  const keys = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <div className="space-y-4">
      <ActivityTabs />
      <div>
        <h2 className="text-xl font-semibold">Usage</h2>
        <p className="text-sm text-zinc-400">Daily, model, and source aggregations.</p>
      </div>
      <div className="flex gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        {["day", "model", "source"].map((value) => (
          <button
            key={value}
            onClick={() => {
              setGroupBy(value);
              void load(value);
            }}
            className={`rounded-md px-3 py-2 text-sm ${
              groupBy === value ? "bg-cyan-500 text-zinc-950" : "border border-zinc-700 text-zinc-300"
            }`}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-400">
            <tr>
              {keys.map((key) => (
                <th key={key} className="px-4 py-3">
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
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
                <td className="px-4 py-6 text-zinc-400">No usage yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
