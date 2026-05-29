import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { disconnectGoogleCalendar } from "@/lib/data/google-calendar";

export async function POST() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in before disconnecting Google Calendar." }, { status: 401 });
  }

  await disconnectGoogleCalendar(user.id);

  return NextResponse.json({ ok: true });
}
