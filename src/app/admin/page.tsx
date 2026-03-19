import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { SetupNotice } from "@/components/shared/setup-notice";
import { fetchAdminDashboardSnapshot } from "@/lib/admin/data";
import { isAdminConfigured, requireAdminAuthentication } from "@/lib/admin/auth";
import { isDatabaseConfigured } from "@/lib/env";
import type { AdminDashboardSnapshot } from "@/types/admin";

export const metadata = {
  title: "Admin",
};

export const dynamic = "force-dynamic";

function AdminErrorState({
  description,
  title,
}: {
  description: ReactNode;
  title: string;
}) {
  return (
    <main className="container-shell min-h-screen py-6">
      <div className="glass-panel rounded-[30px] p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-amber-100 p-3 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <p className="section-label text-amber-700/80">Admin dashboard unavailable</p>
            <h1 className="font-display text-2xl font-semibold text-foreground">{title}</h1>
            <div className="max-w-2xl text-sm leading-7 text-secondary-foreground">{description}</div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default async function AdminPage() {
  if (!isDatabaseConfigured()) {
    return (
      <main className="container-shell min-h-screen py-6">
        <SetupNotice
          showAction={false}
          eyebrow="Database environment required"
          title="Set POSTGRES_URL before opening /admin."
          description="The internal admin route needs the main DayStack database to be configured."
        />
      </main>
    );
  }

  if (!isAdminConfigured()) {
    return (
      <main className="container-shell min-h-screen py-6">
        <SetupNotice
          showAction={false}
          eyebrow="Admin environment required"
          title="Set ADMIN_USERNAME and ADMIN_PASSWORD before opening /admin."
          description={
            <>
              This internal route is protected by a separate admin session. Add <code>ADMIN_USERNAME</code>,{" "}
              <code>ADMIN_PASSWORD</code>, and optionally <code>ADMIN_SESSION_SECRET</code> to enable it.
            </>
          }
        />
      </main>
    );
  }

  await requireAdminAuthentication();

  let snapshot: AdminDashboardSnapshot | null = null;

  try {
    snapshot = await fetchAdminDashboardSnapshot();
  } catch (error) {
    console.error("Admin dashboard bootstrap failed:", error);

    return (
      <AdminErrorState
        title="The admin dashboard could not be loaded."
        description="Check the server logs for the underlying error, then refresh the page."
      />
    );
  }

  return <AdminDashboard initialSnapshot={snapshot} />;
}
