import { redirect } from "next/navigation";

import { isValidDateKey } from "@/lib/daystack";

export const metadata = {
  title: "Friends",
};

interface FriendsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FriendsPage({ searchParams }: FriendsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const requestedDate = Array.isArray(resolvedSearchParams.date)
    ? resolvedSearchParams.date[0]
    : resolvedSearchParams.date;
  const search = new URLSearchParams({
    tab: "friends",
  });

  if (requestedDate && isValidDateKey(requestedDate)) {
    search.set("date", requestedDate);
  }

  redirect(`/app?${search.toString()}`);
}
