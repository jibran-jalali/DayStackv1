import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { syncTaskMentionNotificationsForTask } from "@/lib/data/notifications";

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "You must be signed in to sync mentions.",
      },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        taskId?: string;
      }
    | null;
  const taskId = typeof body?.taskId === "string" ? body.taskId.trim() : "";

  if (!taskId) {
    return NextResponse.json(
      {
        message: "Task id is required.",
      },
      { status: 400 },
    );
  }

  try {
    await syncTaskMentionNotificationsForTask(user.id, taskId);

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Mention synchronization failed.",
      },
      { status: 500 },
    );
  }
}
