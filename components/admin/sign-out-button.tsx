"use client";

import { useRouter } from "next/navigation";
import { usePreferences } from "@/components/preferences-provider";

export function SignOutButton() {
  const router = useRouter();
  const { t } = usePreferences();

  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className="codex-hover w-full rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-300"
    >
      {t("signOut")}
    </button>
  );
}
