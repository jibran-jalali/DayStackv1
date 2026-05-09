import { redirect } from "next/navigation";

import { FriendsShell } from "@/components/app/friends-shell";
import { SetupNotice } from "@/components/shared/setup-notice";
import { getSessionUser } from "@/lib/auth";
import { fetchFriendsSnapshot } from "@/lib/data/friends";
import { deriveDisplayName, isValidDateKey } from "@/lib/daystack";
import { isAuthConfigured, isDatabaseConfigured } from "@/lib/env";

export const metadata = {
  title: "Friends",
};

export const dynamic = "force-dynamic";

interface FriendsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FriendsPage({ searchParams }: FriendsPageProps) {
  if (!isDatabaseConfigured() || !isAuthConfigured()) {
    return (
      <main className="container-shell min-h-screen py-10">
        <SetupNotice />
      </main>
    );
  }

  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const requestedDate = Array.isArray(resolvedSearchParams.date)
    ? resolvedSearchParams.date[0]
    : resolvedSearchParams.date;
  const returnDate = requestedDate && isValidDateKey(requestedDate) ? requestedDate : undefined;
  const snapshot = await fetchFriendsSnapshot(user.id);

  return (
    <FriendsShell
      displayName={deriveDisplayName(user.full_name, user.email)}
      email={user.email}
      initialSnapshot={snapshot}
      returnDate={returnDate}
    />
  );
}
