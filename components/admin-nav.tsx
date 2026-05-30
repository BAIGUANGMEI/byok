"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePreferences } from "@/components/preferences-provider";
import type { LocalizedText } from "@/lib/i18n";

type NavIcon = "overview" | "providers" | "keys" | "activity" | "docs" | "settings";

type NavItem = {
  label: LocalizedText;
  icon: NavIcon;
  href: string;
  paths: readonly string[];
  exact?: boolean;
};

const navItems: readonly NavItem[] = [
  { label: { en: "Overview", zh: "概览" }, icon: "overview", href: "/dashboard", paths: ["/dashboard"], exact: true },
  {
    label: { en: "Providers", zh: "供应商" },
    icon: "providers",
    href: "/dashboard/sources",
    paths: ["/dashboard/sources", "/dashboard/models", "/dashboard/aliases", "/dashboard/routing"],
  },
  { label: { en: "Keys", zh: "密钥" }, icon: "keys", href: "/dashboard/keys", paths: ["/dashboard/keys"] },
  { label: { en: "Activity", zh: "活动" }, icon: "activity", href: "/dashboard/logs", paths: ["/dashboard/logs", "/dashboard/usage"] },
  { label: { en: "Docs", zh: "文档" }, icon: "docs", href: "/dashboard/docs", paths: ["/dashboard/docs"] },
  { label: { en: "Settings", zh: "设置" }, icon: "settings", href: "/dashboard/settings", paths: ["/dashboard/settings"] },
] as const;

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return item.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function NavIcon({ icon }: { icon: NavIcon }) {
  const common = {
    className: "h-4 w-4 shrink-0",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };

  if (icon === "overview") {
    return (
      <svg aria-hidden="true" {...common}>
        <path d="M4 13h6V4H4z" />
        <path d="M14 20h6v-9h-6z" />
        <path d="M4 20h6v-4H4z" />
        <path d="M14 8h6V4h-6z" />
      </svg>
    );
  }
  if (icon === "providers") {
    return (
      <svg aria-hidden="true" {...common}>
        <path d="M12 4v5" />
        <path d="M6 15v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        <path d="M4 20h4v-5H4z" />
        <path d="M10 20h4v-5h-4z" />
        <path d="M16 20h4v-5h-4z" />
      </svg>
    );
  }
  if (icon === "keys") {
    return (
      <svg aria-hidden="true" {...common}>
        <circle cx="8" cy="12" r="3" />
        <path d="M11 12h9" />
        <path d="M17 12v3" />
        <path d="M14 12v2" />
      </svg>
    );
  }
  if (icon === "activity") {
    return (
      <svg aria-hidden="true" {...common}>
        <path d="M4 14h4l2-7 4 10 2-6h4" />
      </svg>
    );
  }
  if (icon === "docs") {
    return (
      <svg aria-hidden="true" {...common}>
        <path d="M6 4h9l3 3v13H6z" />
        <path d="M14 4v4h4" />
        <path d="M9 13h6" />
        <path d="M9 17h4" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="M3 12h3" />
      <path d="M18 12h3" />
      <path d="m5 5 2.2 2.2" />
      <path d="m16.8 16.8 2.2 2.2" />
      <path d="m19 5-2.2 2.2" />
      <path d="m7.2 16.8-2.2 2.2" />
    </svg>
  );
}

export function AdminNav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const { text } = usePreferences();

  return (
    <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0" aria-label="Dashboard sections">
      {navItems.map((item) => {
        const active = isActive(pathname, item);
        const label = text(item.label);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={label}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-3 py-2 text-sm font-medium transition lg:w-full ${
              collapsed ? "lg:flex lg:h-10 lg:items-center lg:justify-center lg:px-0" : ""
            } ${
              active
                ? "codex-selected"
                : "codex-hover border-zinc-800 text-zinc-300"
            }`}
          >
            <NavIcon icon={item.icon} />
            <span className={collapsed ? "lg:hidden" : ""}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
