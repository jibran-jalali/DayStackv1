import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { isWebPushConfigured } from "@/lib/env";
import { sendUserPushNotification } from "@/lib/push/server";

export async function POST() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before sending a test push.",
      },
      { status: 401 },
    );
  }

  if (!isWebPushConfigured()) {
    return NextResponse.json(
      {
        message: "Configure VAPID push keys before sending push notifications.",
      },
      { status: 503 },
    );
  }

  const result = await sendUserPushNotification(user.id, {
    body: "",
    tag: `test-push-${user.id}`,
    title: "Sample block starts in 5 minutes",
    url: "/app?tab=settings",
  });

  if (result.sent === 0) {
    return NextResponse.json(
      {
        message: result.skipped
          ? "No active push subscription was found for this account."
          : "Your saved push subscription could not receive notifications. Re-enable push notifications on this device.",
      },
      { status: result.skipped ? 404 : 502 },
    );
  }

  return NextResponse.json({
    message: "Test push sent.",
  });
}
