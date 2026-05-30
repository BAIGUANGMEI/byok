import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/admin/dashboard-shell";
import { getAdminSession } from "@/lib/auth/admin-session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/login");

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <DashboardShell email={session.email}>{children}</DashboardShell>
    </main>
  );
}
