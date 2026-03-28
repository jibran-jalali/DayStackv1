import { NotificationsShell } from "@/components/app/notifications-shell";
import { deriveDisplayName, isValidDateKey } from "@/lib/daystack";
import { getSessionUser } from "@/lib/auth";

export const metadata = {
  title: "Notifications",
};

interface NotificationsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const user = await getSessionUser();

  if (!user) {
    return null;
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const requestedDate = Array.isArray(resolvedSearchParams.date)
    ? resolvedSearchParams.date[0]
    : resolvedSearchParams.date;
  const returnDate = requestedDate && isValidDateKey(requestedDate) ? requestedDate : undefined;

  return (
    <NotificationsShell
      displayName={deriveDisplayName(user.full_name, user.email)}
      email={user.email}
      returnDate={returnDate}
    />
  );
}
