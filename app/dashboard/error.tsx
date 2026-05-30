"use client";

import { usePreferences } from "@/components/preferences-provider";

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  const { text } = usePreferences();

  return (
    <div className="rounded-lg border border-red-900 bg-red-950 p-4 text-red-100">
      <h2 className="font-semibold">{text({ en: "Page failed to load", zh: "页面加载失败" })}</h2>
      <p className="mt-2 text-sm text-red-200">{error.message}</p>
      <button onClick={reset} className="mt-4 rounded-md bg-red-200 px-3 py-2 text-sm font-semibold text-red-950">
        {text({ en: "Retry", zh: "重试" })}
      </button>
    </div>
  );
}
