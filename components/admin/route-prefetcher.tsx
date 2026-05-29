"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const routes = [
  "/dashboard",
  "/dashboard/sources",
  "/dashboard/keys",
  "/dashboard/logs",
  "/dashboard/settings",
];

export function RoutePrefetcher() {
  const router = useRouter();

  useEffect(() => {
    for (const route of routes) {
      router.prefetch(route);
    }
  }, [router]);

  return null;
}
