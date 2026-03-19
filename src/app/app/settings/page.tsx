import { SettingsShell } from "@/components/app/settings-shell";
import { SetupNotice } from "@/components/shared/setup-notice";
import { fetchProfile } from "@/lib/data/daystack";
import { fetchNotificationPreferences } from "@/lib/data/reminders";
import { getSessionUser } from "@/lib/auth";
import { deriveDisplayName, isValidDateKey } from "@/lib/daystack";
import { isAuthConfigured, isDatabaseConfigured } from "@/lib/env";

export const metadata = {
  title: "Settings",
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

interface SettingsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
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
  const returnDate = requestedDate && isValidDateKey(requestedDate) ? requestedDate : undefined;

  try {
    const [profile, notificationPreferences] = await Promise.all([
      fetchProfile(user.id),
      fetchNotificationPreferences(user.id),
    ]);

    return (
      <SettingsShell
        userId={user.id}
        email={user.email}
        displayName={deriveDisplayName(profile?.full_name, user.email)}
        initialNotificationPreferences={notificationPreferences}
        returnDate={returnDate}
      />
    );
  } catch (error) {
    console.error("DayStack settings bootstrap failed:", error);

    if (isSchemaMissingError(error)) {
      return (
        <main className="container-shell min-h-screen py-10">
          <SetupNotice
            showAction={false}
            eyebrow="Database schema missing"
            title="Your Postgres connection is loaded, but DayStack&rsquo;s tables are not in this database yet."
            description={
              <>
                Run DayStack&rsquo;s database migrations before opening settings. This page needs <code>users</code>,{" "}
                <code>user_notification_preferences</code>, <code>task_reminders</code>, and{" "}
                <code>task_notifications</code> before reminders and mentions can be managed here.
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
          eyebrow="Settings load failed"
          title="DayStack reached Postgres, but reminder settings could not be loaded."
          description="Check the terminal for the server-side error details, then retry the page."
        />
      </main>
    );
  }
}
