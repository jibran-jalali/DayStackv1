import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import { markTaskNotificationsRead } from "@/lib/data/notifications";

const readSchema = z.object({
  notificationIds: z.array(z.string().uuid()).max(50),
});

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before updating notifications.",
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = readSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "A valid notification id list is required.",
      },
      { status: 400 },
    );
  }

  try {
    const count = await markTaskNotificationsRead(user.id, parsed.data.notificationIds);

    return NextResponse.json({
      count,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Notification update failed.",
      },
      { status: 500 },
    );
  }
}
