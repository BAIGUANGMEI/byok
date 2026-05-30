"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePreferences } from "@/components/preferences-provider";
import type { LocalizedText } from "@/lib/i18n";

type SectionTab = {
  label: LocalizedText;
  href: string;
};

const providerTabs: SectionTab[] = [
  { label: { en: "Sources", zh: "来源" }, href: "/dashboard/sources" },
  { label: { en: "Models", zh: "模型" }, href: "/dashboard/models" },
  { label: { en: "Aliases", zh: "别名" }, href: "/dashboard/aliases" },
  { label: { en: "Routing", zh: "路由" }, href: "/dashboard/routing" },
];

const activityTabs: SectionTab[] = [
  { label: { en: "Logs", zh: "日志" }, href: "/dashboard/logs" },
  { label: { en: "Usage", zh: "用量" }, href: "/dashboard/usage" },
];

function SectionTabs({ label, tabs }: { label: LocalizedText; tabs: SectionTab[] }) {
  const pathname = usePathname();
  const { text } = usePreferences();
  const sectionLabel = text(label);

  return (
    <div className="flex flex-col gap-3 border-b border-zinc-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-semibold uppercase text-zinc-500">{sectionLabel}</p>
      <nav className="flex flex-wrap gap-2" aria-label={`${sectionLabel} tabs`}>
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                active
                  ? "codex-selected"
                  : "codex-hover border-zinc-800 bg-zinc-900 text-zinc-300"
              }`}
            >
              {text(tab.label)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function ProviderTabs() {
  return <SectionTabs label={{ en: "Provider configuration", zh: "供应商配置" }} tabs={providerTabs} />;
}

export function ActivityTabs() {
  return <SectionTabs label={{ en: "Activity", zh: "活动" }} tabs={activityTabs} />;
}
