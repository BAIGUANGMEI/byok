import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-zinc-800 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-normal text-zinc-100">{title}</h2>
        {description ? <p className="mt-1 text-sm text-zinc-400">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
