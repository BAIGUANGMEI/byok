"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SectionTab = {
  label: string;
  href: string;
};

const providerTabs: SectionTab[] = [
  { label: "Sources", href: "/dashboard/sources" },
  { label: "Models", href: "/dashboard/models" },
  { label: "Aliases", href: "/dashboard/aliases" },
  { label: "Routing", href: "/dashboard/routing" },
];

const activityTabs: SectionTab[] = [
  { label: "Logs", href: "/dashboard/logs" },
  { label: "Usage", href: "/dashboard/usage" },
];

function SectionTabs({ label, tabs }: { label: string; tabs: SectionTab[] }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-3 border-b border-zinc-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      <nav className="flex flex-wrap gap-2" aria-label={`${label} tabs`}>
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                active
                  ? "border-cyan-300 bg-zinc-100 text-zinc-950"
                  : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-cyan-500 hover:text-cyan-200"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function ProviderTabs() {
  return <SectionTabs label="Provider configuration" tabs={providerTabs} />;
}

export function ActivityTabs() {
  return <SectionTabs label="Activity" tabs={activityTabs} />;
}
