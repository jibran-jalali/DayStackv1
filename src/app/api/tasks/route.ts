import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { createTask } from "@/lib/data/daystack";
import { taskFormSchema } from "@/types/daystack";

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before creating a task.",
      },
      { status: 401 },
    );
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
