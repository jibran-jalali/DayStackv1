import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { fetchNotificationPreferences } from "@/lib/data/reminders";
import { isOneSignalServerConfigured, sendOneSignalNotification } from "@/lib/onesignal/server";

export async function POST(request: Request) {
  if (!isOneSignalServerConfigured()) {
    return NextResponse.json(
      {
        error: "Add NEXT_PUBLIC_ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY before sending test notifications.",
      },
      { status: 503 },
    );
  }

  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "Sign in before sending a test notification.",
      },
      { status: 401 },
    );
  }

  const preferences = await fetchNotificationPreferences(user.id);

  if (!preferences.push_enabled) {
    return NextResponse.json(
      {
        error: "Enable reminders on this browser before sending a test notification.",
      },
      { status: 400 },
    );
  }

  await sendOneSignalNotification({
    body: "Your browser is connected and ready for DayStack reminders.",
    externalIds: [user.id],
    heading: "DayStack test notification",
    url: `${new URL(request.url).origin}/app`,
  });

  return NextResponse.json({
    message: "Test notification sent.",
  });
}
