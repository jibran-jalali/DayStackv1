import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAutomationUser } from "@/lib/automation-auth";
import { rescheduleTask } from "@/lib/data/daystack";

const rescheduleSchema = z
  .object({
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    propagationMode: z.enum(["owner_only", "owner_and_accepted_copies"]).optional(),
    recurrenceScope: z.enum(["occurrence_only", "this_and_future"]).optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    taskDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((values) => values.endTime > values.startTime, {
    message: "End time must be later than the start time.",
    path: ["endTime"],
  });

const propagationModeSchema = z.enum(["owner_only", "owner_and_accepted_copies"]);
const recurrenceScopeSchema = z.enum(["occurrence_only", "this_and_future"]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { response, user } = await requireAutomationUser(request);

  if (response || !user) {
    return response;
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
  const recurrenceScope = recurrenceScopeSchema.safeParse(parsed.data.recurrenceScope ?? "occurrence_only");
  const { taskId } = await context.params;

  try {
    const task = await rescheduleTask(
      user.id,
      taskId,
      parsed.data,
      propagationMode.success ? propagationMode.data : "owner_only",
      recurrenceScope.success ? recurrenceScope.data : "occurrence_only",
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
