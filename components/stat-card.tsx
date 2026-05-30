"use client";

import { usePreferences } from "@/components/preferences-provider";
import type { LocalizedText } from "@/lib/i18n";

export function StatCard({ label, value }: { label: LocalizedText; value: string | number }) {
  const { text } = usePreferences();

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-sm text-zinc-400">{text(label)}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-50">{value}</p>
    </div>
  );
}
