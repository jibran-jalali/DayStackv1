import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import { syncGoogleCalendarEventsToDayStack } from "@/lib/data/google-calendar";
import { isValidDateKey } from "@/lib/daystack";
import { requireSameOriginRequest } from "@/lib/security";

const calendarSyncSchema = z.object({
  taskDate: z.string().trim().refine(isValidDateKey, "A valid sync date is required."),
});

export async function POST(request: Request) {
  const sameOriginError = requireSameOriginRequest(request);

  if (sameOriginError) {
    return sameOriginError;
  }

  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in before syncing Google Calendar." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = calendarSyncSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "A valid sync date is required." }, { status: 400 });
  }

  try {
    return NextResponse.json(await syncGoogleCalendarEventsToDayStack(user.id, parsed.data.taskDate));
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Google Calendar sync failed.",
      },
      { status: 500 },
    );
  }
}
