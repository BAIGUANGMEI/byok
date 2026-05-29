"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "invalid") {
      setError("Invalid email or password");
    }
  }, []);

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
      setError(body?.error?.message ?? "Login failed");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <form
        action="/api/admin/login"
        method="post"
        onSubmit={submit}
        className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-xl"
      >
        <h1 className="text-xl font-semibold">AI Relay Gateway</h1>
        <p className="mt-1 text-sm text-zinc-400">Sign in with the single admin account.</p>
        <label className="mt-6 block text-sm font-medium text-zinc-300">
          Email
          <input
            className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-cyan-500"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            name="email"
            autoComplete="email"
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-zinc-300">
          Password
          <input
            className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-cyan-500"
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
          className="mt-6 w-full rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
