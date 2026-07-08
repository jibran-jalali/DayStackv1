import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { disconnectGoogleCalendar } from "@/lib/data/google-calendar";
import { rateLimitRequest, rateLimiters } from "@/lib/security";

export async function POST(request: Request) {
  const rateLimitError = rateLimitRequest(request, rateLimiters.calendar);

  if (rateLimitError) {
    return rateLimitError;
  }

  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in before disconnecting Google Calendar." }, { status: 401 });
  }

  await disconnectGoogleCalendar(user.id);

  return NextResponse.json({ ok: true });
}
