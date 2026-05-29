import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin-nav";
import { RoutePrefetcher } from "@/components/admin/route-prefetcher";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { getAdminSession } from "@/lib/auth/admin-session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/login");

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <header className="flex flex-col gap-4 border-b border-zinc-800 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">AI Relay Gateway</h1>
              <p className="text-sm text-zinc-400">{session.email}</p>
            </div>
            <SignOutButton />
          </div>
          <AdminNav />
        </header>
        <section className="py-6">{children}</section>
        <RoutePrefetcher />
      </div>
    </main>
  );
}
