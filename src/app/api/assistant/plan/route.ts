import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { planDay } from "@/lib/assistant/planner";
import { createTask } from "@/lib/data/daystack";
import { formatDateKey } from "@/lib/daystack";

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.date || !body.startTime || !body.endTime || !Array.isArray(body.tasks)) {
    return NextResponse.json({ message: "Missing or invalid fields." }, { status: 400 });
  }

  try {
    const result = await planDay({
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      tasks: body.tasks,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Planning failed.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.tasks)) {
    return NextResponse.json({ message: "Missing tasks array." }, { status: 400 });
  }

  const today = formatDateKey(new Date());
  const created: Array<{ title: string; id: string }> = [];
  const errors: Array<{ title: string; error: string }> = [];

  for (const task of body.tasks) {
    try {
      const result = await createTask(user.id, {
        blockMode: "one_time",
        title: task.title,
        taskDate: body.date ?? today,
        startTime: task.startTime,
        endTime: task.endTime,
        taskType: "generic",
        weekdays: [],
        participants: [],
      });

      created.push({ title: task.title, id: result.id });
    } catch (error) {
      errors.push({
        title: task.title,
        error: error instanceof Error ? error.message : "Failed",
      });
    }
  }

  return NextResponse.json({ created, errors });
}
