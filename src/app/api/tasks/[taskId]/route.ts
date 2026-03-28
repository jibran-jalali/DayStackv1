import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import { deleteTask, updateTask } from "@/lib/data/daystack";
import { taskFormSchema } from "@/types/daystack";

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

  const body = (await request.json().catch(() => null)) as
    | (Record<string, unknown> & {
        propagationMode?: unknown;
      })
    | null;
  const parsed = taskFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: parsed.error.flatten().formErrors[0] ?? "Task details are invalid.",
      },
      { status: 400 },
    );
  }

  const propagationMode = propagationModeSchema.safeParse(body?.propagationMode);

  if (body?.propagationMode !== undefined && !propagationMode.success) {
    return NextResponse.json(
      {
        message: "A valid propagation mode is required.",
      },
      { status: 400 },
    );
  }

  const { taskId } = await context.params;

  try {
    const task = await updateTask(
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
        message: error instanceof Error ? error.message : "Task update failed.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before deleting a task.",
      },
      { status: 401 },
    );
  }

  const { taskId } = await context.params;

  try {
    const taskDate = await deleteTask(user.id, taskId);

    return NextResponse.json({
      taskDate,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Task deletion failed.",
      },
      { status: 500 },
    );
  }
}
