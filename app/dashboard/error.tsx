"use client";

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-lg border border-red-900 bg-red-950 p-4 text-red-100">
      <h2 className="font-semibold">Page failed to load</h2>
      <p className="mt-2 text-sm text-red-200">{error.message}</p>
      <button onClick={reset} className="mt-4 rounded-md bg-red-200 px-3 py-2 text-sm font-semibold text-red-950">
        Retry
      </button>
    </div>
  );
}
