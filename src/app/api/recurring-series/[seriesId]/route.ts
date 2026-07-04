import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import { deleteRecurringSeries, updateRecurringSeries } from "@/lib/data/daystack";
import { taskFormSchema } from "@/types/daystack";

const deleteRecurringSeriesSchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date."),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ seriesId: string }> },
) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before updating a recurring block.",
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = taskFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: parsed.error.flatten().formErrors[0] ?? "Recurring block details are invalid.",
      },
      { status: 400 },
    );
  }

  if (parsed.data.blockMode !== "recurring") {
    return NextResponse.json(
      {
        message: "Recurring blocks must stay in recurring mode.",
      },
      { status: 400 },
    );
  }

  const { seriesId } = await context.params;

  try {
    await updateRecurringSeries(user.id, seriesId, parsed.data);

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Recurring block update failed.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ seriesId: string }> },
) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before deleting a recurring block.",
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = deleteRecurringSeriesSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: parsed.error.flatten().formErrors[0] ?? "A valid start date is required.",
      },
      { status: 400 },
    );
  }

  const { seriesId } = await context.params;

  try {
    await deleteRecurringSeries(user.id, seriesId, parsed.data.fromDate);

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Recurring block deletion failed.",
      },
      { status: 500 },
    );
  }
}
