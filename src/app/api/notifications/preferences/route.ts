import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import { fetchNotificationPreferences, updateNotificationPreferences } from "@/lib/data/reminders";

const preferenceUpdateSchema = z
  .object({
    email_enabled: z.boolean().optional(),
    meeting_mention_email_enabled: z.boolean().optional(),
    email_reminder_lead_minutes: z.number().int().min(0).max(1440).optional(),
  })
  .refine((values) => Object.values(values).some((value) => value !== undefined), {
    message: "At least one notification preference must be provided.",
  });

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before loading notification preferences.",
      },
      { status: 401 },
    );
  }

  try {
    const preferences = await fetchNotificationPreferences(user.id);

    return NextResponse.json({
      preferences,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Preference load failed.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before updating notification preferences.",
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = preferenceUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: parsed.error.flatten().formErrors[0] ?? "Preference update is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const preferences = await updateNotificationPreferences(user.id, parsed.data);

    return NextResponse.json({
      preferences,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Preference update failed.",
      },
      { status: 500 },
    );
  }
}
