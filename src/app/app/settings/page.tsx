import { redirect } from "next/navigation";

import { isValidDateKey } from "@/lib/daystack";

export const metadata = {
  title: "Settings",
};

interface SettingsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const requestedDate = Array.isArray(resolvedSearchParams.date)
    ? resolvedSearchParams.date[0]
    : resolvedSearchParams.date;
  const search = new URLSearchParams({
    tab: "settings",
  });

  if (requestedDate && isValidDateKey(requestedDate)) {
    search.set("date", requestedDate);
  }

  redirect(`/app?${search.toString()}`);
}
