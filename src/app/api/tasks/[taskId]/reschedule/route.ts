import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import { rescheduleTask } from "@/lib/data/daystack";

const rescheduleSchema = z
  .object({
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    propagationMode: z.enum(["owner_only", "owner_and_accepted_copies"]).optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    taskDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((values) => values.endTime > values.startTime, {
    message: "End time must be later than the start time.",
    path: ["endTime"],
  });

const propagationModeSchema = z.enum(["owner_only", "owner_and_accepted_copies"]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before updating a task.",
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = rescheduleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: parsed.error.flatten().formErrors[0] ?? "Reschedule details are invalid.",
      },
      { status: 400 },
    );
  }

  const propagationMode = propagationModeSchema.safeParse(parsed.data.propagationMode ?? "owner_only");

  const { taskId } = await context.params;

  try {
    const task = await rescheduleTask(
      user.id,
      taskId,
      parsed.data,
      propagationMode.success ? propagationMode.data : "owner_only",
    );

    return NextResponse.json({
      task,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Task reschedule failed.",
      },
      { status: 500 },
    );
  }
}
