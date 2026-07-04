import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { getGoogleCalendarConnectionStatus } from "@/lib/data/google-calendar";

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in before checking Google Calendar." }, { status: 401 });
  }

  return NextResponse.json(await getGoogleCalendarConnectionStatus(user.id));
}
