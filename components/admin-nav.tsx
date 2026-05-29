"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href: string;
  paths: readonly string[];
  exact?: boolean;
};

const navItems: readonly NavItem[] = [
  { label: "Overview", href: "/dashboard", paths: ["/dashboard"], exact: true },
  {
    label: "Providers",
    href: "/dashboard/sources",
    paths: ["/dashboard/sources", "/dashboard/models", "/dashboard/aliases", "/dashboard/routing"],
  },
  { label: "Keys", href: "/dashboard/keys", paths: ["/dashboard/keys"] },
  { label: "Activity", href: "/dashboard/logs", paths: ["/dashboard/logs", "/dashboard/usage"] },
  { label: "Docs", href: "/dashboard/docs", paths: ["/dashboard/docs"] },
  { label: "Settings", href: "/dashboard/settings", paths: ["/dashboard/settings"] },
] as const;

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return item.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Dashboard sections">
      {navItems.map((item) => {
        const active = isActive(pathname, item);
        return (
        <Link
          key={item.href}
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
            active
              ? "border-cyan-300 bg-cyan-400 text-zinc-950 shadow-sm shadow-cyan-950/40"
              : "border-zinc-800 text-zinc-300 hover:border-cyan-500 hover:text-cyan-200"
          }`}
        >
          {item.label}
        </Link>
        );
      })}
    </nav>
  );
}
