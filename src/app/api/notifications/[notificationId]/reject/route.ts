import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { dismissTaskNotification } from "@/lib/data/notifications";

export async function POST(
  _request: Request,
  context: { params: Promise<{ notificationId: string }> },
) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before rejecting a meeting request.",
      },
      { status: 401 },
    );
  }

  const { notificationId } = await context.params;

  try {
    await dismissTaskNotification(user.id, notificationId);

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Meeting request could not be rejected.",
      },
      { status: 400 },
    );
  }
}
