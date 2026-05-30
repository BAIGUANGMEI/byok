"use client";

import { useEffect, useState } from "react";
import { AdminNav } from "@/components/admin-nav";
import { RoutePrefetcher } from "@/components/admin/route-prefetcher";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { usePreferences } from "@/components/preferences-provider";

const sidebarStorageKey = "dashboard-sidebar-collapsed";

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      {collapsed ? <path d="m9 18 6-6-6-6" /> : <path d="m15 18-6-6 6-6" />}
    </svg>
  );
}

export function DashboardShell({ children, email }: { children: React.ReactNode; email: string }) {
  const { text } = usePreferences();
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(sidebarStorageKey) === "true");
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(sidebarStorageKey, String(collapsed));
  }, [collapsed, ready]);

  const toggleLabel = text(
    collapsed
      ? { en: "Expand sidebar", zh: "展开侧边栏" }
      : { en: "Collapse sidebar", zh: "收起侧边栏" },
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col lg:flex-row">
      <aside
        className={`relative border-b border-zinc-800 px-4 py-4 transition-[width] duration-200 lg:sticky lg:top-0 lg:flex lg:h-screen lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r lg:py-6 ${
          collapsed ? "lg:w-[72px] lg:px-3" : "lg:w-56"
        }`}
      >
        <button
          type="button"
          aria-label={toggleLabel}
          title={toggleLabel}
          onClick={() => setCollapsed((value) => !value)}
          className="codex-hover absolute right-[-16px] top-6 z-20 hidden h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-zinc-300 shadow-lg shadow-black/30 transition lg:flex"
        >
          <SidebarToggleIcon collapsed={collapsed} />
        </button>
        <div className={`flex flex-wrap items-start justify-between gap-3 lg:flex-col ${collapsed ? "lg:items-center" : ""}`}>
          <div className={collapsed ? "lg:text-center" : ""}>
            <h1 className="text-2xl font-semibold">
              <span className={collapsed ? "hidden lg:inline" : "hidden"}>B</span>
              <span className={collapsed ? "lg:hidden" : ""}>BYOK</span>
            </h1>
            <p className={`mt-1 max-w-48 truncate text-sm text-zinc-400 ${collapsed ? "lg:hidden" : ""}`}>{email}</p>
          </div>
        </div>
        <div className="mt-4 lg:mt-6">
          <AdminNav collapsed={collapsed} />
        </div>
        <div className={`mt-4 lg:mt-auto ${collapsed ? "lg:hidden" : ""}`}>
          <SignOutButton />
        </div>
      </aside>
      <section className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">{children}</section>
      <RoutePrefetcher />
    </div>
  );
}
