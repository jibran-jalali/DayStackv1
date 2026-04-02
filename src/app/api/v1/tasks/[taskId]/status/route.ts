import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAutomationUser } from "@/lib/automation-auth";
import { toggleTaskStatus } from "@/lib/data/daystack";

const statusSchema = z.object({
  status: z.enum(["pending", "completed"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { response, user } = await requireAutomationUser(request);

  if (response || !user) {
    return response;
  }

  const body = await request.json().catch(() => null);
  const parsed = statusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "A valid task status is required.",
      },
      { status: 400 },
    );
  }

  const { taskId } = await context.params;

  try {
    const task = await toggleTaskStatus(user.id, taskId, parsed.data.status);

    return NextResponse.json({
      task,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Task status update failed.",
      },
      { status: 500 },
    );
  }
}
