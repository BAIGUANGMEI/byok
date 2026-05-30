"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PreferenceControls } from "@/components/preference-controls";
import { usePreferences } from "@/components/preferences-provider";

export default function LoginPage() {
  const router = useRouter();
  const { text } = usePreferences();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "invalid") {
      setError(text({ en: "Invalid email or password", zh: "邮箱或密码不正确" }));
    }
  }, [text]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message ?? text({ en: "Login failed", zh: "登录失败" }));
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-8 text-zinc-100">
      <form
        action="/api/admin/login"
        method="post"
        onSubmit={submit}
        className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-xl"
      >
        <div className="mb-5 flex justify-end">
          <PreferenceControls />
        </div>
        <h1 className="text-xl font-semibold">BYOK</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {text({ en: "Sign in with the single admin account.", zh: "使用单一管理员账号登录。" })}
        </p>
        <label className="mt-6 block text-sm font-medium text-zinc-300">
          {text({ en: "Email", zh: "邮箱" })}
          <input
            className="codex-focus mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            name="email"
            autoComplete="email"
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-zinc-300">
          {text({ en: "Password", zh: "密码" })}
          <input
            className="codex-focus mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            name="password"
            autoComplete="current-password"
          />
        </label>
        {error ? <p className="mt-4 rounded-md bg-red-950 px-3 py-2 text-sm text-red-200">{error}</p> : null}
        <button
          type="submit"
          className="codex-button mt-6 w-full rounded-md px-4 py-2 text-sm font-semibold"
          disabled={loading}
        >
          {loading ? text({ en: "Signing in...", zh: "登录中..." }) : text({ en: "Sign in", zh: "登录" })}
        </button>
      </form>
    </main>
  );
}
