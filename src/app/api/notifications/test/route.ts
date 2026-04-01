import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { formatDateKey } from "@/lib/daystack";
import { getAppBaseUrl } from "@/lib/env";
import { isEmailServerConfigured, sendTaskReminderEmail } from "@/lib/email/server";

export async function POST(request: Request) {
  if (!isEmailServerConfigured()) {
    return NextResponse.json(
      {
        error: "Configure SMTP email before sending a test email.",
      },
      { status: 503 },
    );
  }

  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "Sign in before sending a test email.",
      },
      { status: 401 },
    );
  }

  if (!user.email) {
    return NextResponse.json(
      {
        error: "Your account needs an email address before a test email can be sent.",
      },
      { status: 400 },
    );
  }

  const now = new Date();
  const startTime = now.toTimeString().slice(0, 5);
  const end = new Date(now.getTime() + 30 * 60 * 1000);
  const endTime = end.toTimeString().slice(0, 5);
  const appUrl = new URL("/app", process.env.NEXTAUTH_URL?.trim() ? getAppBaseUrl() : new URL(request.url).origin).toString();

  await sendTaskReminderEmail({
    appUrl,
    leadMinutes: 15,
    recipient: {
      email: user.email,
      full_name: user.full_name,
    },
    task: {
      end_time: endTime,
      meeting_link: null,
      start_time: startTime,
      task_date: formatDateKey(now),
      task_type: "generic",
      title: "DayStack test reminder",
    },
  });

  return NextResponse.json({
    message: "Test email sent.",
  });
}
