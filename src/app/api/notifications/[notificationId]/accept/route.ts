import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { acceptTaskNotification } from "@/lib/data/notifications";

export async function POST(
  _request: Request,
  context: { params: Promise<{ notificationId: string }> },
) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before accepting a notification.",
      },
      { status: 401 },
    );
  }

  const { notificationId } = await context.params;

  try {
    const result = await acceptTaskNotification(user.id, notificationId);

    return NextResponse.json({
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Notification accept failed.",
      },
      { status: 500 },
    );
  }
}
