import { redirect } from "next/navigation";

import { isValidDateKey } from "@/lib/daystack";

export const metadata = {
  title: "Dashboard",
};

interface SettingsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const requestedDate = Array.isArray(resolvedSearchParams.date)
    ? resolvedSearchParams.date[0]
    : resolvedSearchParams.date;

  if (requestedDate && isValidDateKey(requestedDate)) {
    redirect(`/app?date=${requestedDate}`);
  }

  redirect("/app");
}
