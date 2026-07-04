import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { fetchTaskNotifications } from "@/lib/data/notifications";

export async function GET(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before loading notifications.",
      },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") ?? "10", 10) || 10, 1), 25);

  try {
    const notifications = await fetchTaskNotifications(user.id, limit);

    return NextResponse.json({
      notifications,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Notification load failed.",
      },
      { status: 500 },
    );
  }
}
