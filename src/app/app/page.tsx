import { PlannerShell } from "@/components/app/planner-shell";
import { SetupNotice } from "@/components/shared/setup-notice";
import { fetchDashboardSnapshot, fetchProfile } from "@/lib/data/daystack";
import { getSessionUser } from "@/lib/auth";
import { deriveDisplayName, formatDateKey, isValidDateKey } from "@/lib/daystack";
import { isAuthConfigured, isDatabaseConfigured } from "@/lib/env";

export const metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

function isSchemaMissingError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { message?: string };

  return (
    maybeError.message?.includes("does not exist") === true ||
    maybeError.message?.includes("column") === true
  );
}

interface AppPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AppPage({ searchParams }: AppPageProps) {
  if (!isDatabaseConfigured() || !isAuthConfigured()) {
    return (
      <main className="container-shell min-h-screen py-10">
        <SetupNotice />
      </main>
    );
  }

  const user = await getSessionUser();

  if (!user) {
    return null;
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const requestedDate = Array.isArray(resolvedSearchParams.date)
    ? resolvedSearchParams.date[0]
    : resolvedSearchParams.date;
  const taskDate = requestedDate && isValidDateKey(requestedDate) ? requestedDate : formatDateKey(new Date());

  try {
    const [snapshot, profile] = await Promise.all([
      fetchDashboardSnapshot(user.id, taskDate),
      fetchProfile(user.id),
    ]);

    return (
      <PlannerShell
        userId={user.id}
        email={user.email}
        displayName={deriveDisplayName(profile?.full_name, user.email)}
        initialSnapshot={snapshot}
      />
    );
  } catch (error) {
    console.error("DayStack dashboard bootstrap failed:", error);

    if (isSchemaMissingError(error)) {
      return (
        <main className="container-shell min-h-screen py-10">
          <SetupNotice
            showAction={false}
            eyebrow="Database schema missing"
            title="Your Postgres connection is loaded, but DayStack&rsquo;s tables are not in this database yet."
            description={
              <>
                Run DayStack&rsquo;s database migrations before opening the planner. The app needs{" "}
                <code>users</code>, <code>tasks</code>, <code>task_participants</code>,{" "}
                <code>daily_summaries</code>, <code>user_notification_preferences</code>,{" "}
                <code>task_reminders</code>, and <code>task_notifications</code> before it can load live data.
              </>
            }
          />
        </main>
      );
    }

    return (
      <main className="container-shell min-h-screen py-10">
        <SetupNotice
          showAction={false}
          eyebrow="Dashboard load failed"
          title="DayStack reached Postgres, but the dashboard data could not be loaded."
          description="Check the terminal for the server-side error details, then retry the page."
        />
      </main>
    );
  }
}
