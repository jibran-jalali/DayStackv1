import { NextResponse } from "next/server";

import { requireAutomationUser } from "@/lib/automation-auth";
import { createTask, fetchTasksForDate } from "@/lib/data/daystack";
import { isValidDateKey } from "@/lib/daystack";
import { taskFormSchema } from "@/types/daystack";

export async function GET(request: Request) {
  const { response, user } = await requireAutomationUser(request);

  if (response || !user) {
    return response;
  }

  const url = new URL(request.url);
  const taskDate = url.searchParams.get("date")?.trim() ?? "";

  if (!isValidDateKey(taskDate)) {
    return NextResponse.json(
      {
        message: "A valid date is required.",
      },
      { status: 400 },
    );
  }

  try {
    const tasks = await fetchTasksForDate(user.id, taskDate);

    return NextResponse.json({
      tasks,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Tasks could not be loaded.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const { response, user } = await requireAutomationUser(request);

  if (response || !user) {
    return response;
  }

  const body = await request.json().catch(() => null);
  const parsed = taskFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: parsed.error.flatten().formErrors[0] ?? "Task details are invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const task = await createTask(user.id, parsed.data);

    return NextResponse.json(
      {
        task,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Task creation failed.",
      },
      { status: 500 },
    );
  }
}
