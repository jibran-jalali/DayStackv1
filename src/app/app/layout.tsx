import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth, getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await getSessionUser();

  if (!user) {
    redirect("/login?disabled=1");
  }

  return (
    <>
      {children}
    </>
  );
}
