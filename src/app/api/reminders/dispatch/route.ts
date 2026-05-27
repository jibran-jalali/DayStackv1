import { NextResponse } from "next/server";

import {
  deleteStaleMutableReminders,
  fetchDueTaskReminders,
  isEmailReminderType,
  isPushReminderType,
  syncTaskRemindersForActiveUsers,
  syncTaskRemindersForUser,
  updateTaskReminderStatus,
} from "@/lib/data/reminders";
import { getSessionUser } from "@/lib/auth";
import { getAppBaseUrl, isWebPushConfigured } from "@/lib/env";
import { isEmailServerConfigured, sendTaskReminderEmail } from "@/lib/email/server";
import { sendTaskReminderPush } from "@/lib/push/server";

export const runtime = "nodejs";

function getBaseAppUrl(request: Request) {
  if (process.env.NEXTAUTH_URL?.trim()) {
    return getAppBaseUrl();
  }

  return new URL(request.url).origin;
}

function buildPlannerAppUrl(baseUrl: string, taskDate: string) {
  const url = new URL("/app", baseUrl);
  url.searchParams.set("date", taskDate);
  return url.toString();
}

async function processReminder(
  dueReminder: Awaited<ReturnType<typeof fetchDueTaskReminders>>[number],
  options: {
    appBaseUrl: string;
    emailConfigured: boolean;
    pushConfigured: boolean;
    userId?: string;
  },
) {
  const statusOptions = options.userId ? { userId: options.userId } : undefined;

  await updateTaskReminderStatus(dueReminder.reminder.id, "processing", statusOptions);

  if (dueReminder.task.status === "completed") {
    await updateTaskReminderStatus(dueReminder.reminder.id, "skipped", statusOptions);
    return "skipped" as const;
  }

  if (isEmailReminderType(dueReminder.reminder.reminder_type)) {
    if (!dueReminder.preferences.email_enabled) {
      await updateTaskReminderStatus(dueReminder.reminder.id, "skipped", statusOptions);
      return "skipped" as const;
    }

    if (!options.emailConfigured || !dueReminder.recipient.email) {
      await updateTaskReminderStatus(dueReminder.reminder.id, "failed", statusOptions);
      return "failed" as const;
    }

    await sendTaskReminderEmail({
      appUrl: buildPlannerAppUrl(options.appBaseUrl, dueReminder.task.task_date),
      leadMinutes: dueReminder.preferences.email_reminder_lead_minutes,
      recipient: dueReminder.recipient,
      task: dueReminder.task,
    });

    await updateTaskReminderStatus(dueReminder.reminder.id, "sent", {
      ...statusOptions,
      sentAt: new Date().toISOString(),
    });
    return "sent" as const;
  }

  if (isPushReminderType(dueReminder.reminder.reminder_type)) {
    if (!dueReminder.preferences.push_enabled) {
      await updateTaskReminderStatus(dueReminder.reminder.id, "skipped", statusOptions);
      return "skipped" as const;
    }

    if (!options.pushConfigured) {
      await updateTaskReminderStatus(dueReminder.reminder.id, "failed", statusOptions);
      return "failed" as const;
    }

    const result = await sendTaskReminderPush(dueReminder);

    if (result.sent === 0) {
      const status = result.skipped ? "skipped" : "failed";
      await updateTaskReminderStatus(dueReminder.reminder.id, status, statusOptions);
      return status;
    }

    await updateTaskReminderStatus(dueReminder.reminder.id, "sent", {
      ...statusOptions,
      sentAt: new Date().toISOString(),
    });
    return "sent" as const;
  }

  await updateTaskReminderStatus(dueReminder.reminder.id, "skipped", statusOptions);
  return "skipped" as const;
}

async function dispatchDueReminders({
  appBaseUrl,
  emailConfigured,
  limit,
  pushConfigured,
  userId,
}: {
  appBaseUrl: string;
  emailConfigured: boolean;
  limit: number;
  pushConfigured: boolean;
  userId?: string;
}) {
  const now = new Date();

  await deleteStaleMutableReminders(now);

  const syncedUsers = userId
    ? await syncTaskRemindersForUser(userId, undefined, now).then(() => 1)
    : await syncTaskRemindersForActiveUsers(now);

  const reminders = await fetchDueTaskReminders({
    limit,
    nowIso: now.toISOString(),
    userId,
  });
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const dueReminder of reminders) {
    try {
      const result = await processReminder(dueReminder, {
        appBaseUrl,
        emailConfigured,
        pushConfigured,
        userId,
      });

      if (result === "sent") {
        sent += 1;
      } else if (result === "failed") {
        failed += 1;
      } else {
        skipped += 1;
      }
    } catch {
      await updateTaskReminderStatus(dueReminder.reminder.id, "failed", userId ? { userId } : undefined);
      failed += 1;
    }
  }

  return {
    failed,
    processed: reminders.length,
    sent,
    skipped,
    syncedUsers,
  };
}

async function handleReminderDispatchRequest(request: Request, options: { allowSession: boolean }) {
  const emailConfigured = isEmailServerConfigured();
  const pushConfigured = isWebPushConfigured();

  if (!emailConfigured && !pushConfigured) {
    return NextResponse.json(
      {
        error: "No reminder delivery channel is configured on the server.",
      },
      { status: 503 },
    );
  }

  const cronSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  const isCronRequest = Boolean(cronSecret && authorization === `Bearer ${cronSecret}`);
  const appBaseUrl = getBaseAppUrl(request);

  if (isCronRequest) {
    return NextResponse.json(
      await dispatchDueReminders({
        appBaseUrl,
        emailConfigured,
        limit: 100,
        pushConfigured,
      }),
    );
  }

  if (!options.allowSession) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "Sign in before dispatching reminders.",
      },
      { status: 401 },
    );
  }

  return NextResponse.json(
    await dispatchDueReminders({
      appBaseUrl,
      emailConfigured,
      limit: 20,
      pushConfigured,
      userId: user.id,
    }),
  );
}

/** Vercel Cron invokes scheduled routes with GET + `Authorization: Bearer CRON_SECRET`. */
export async function GET(request: Request) {
  return handleReminderDispatchRequest(request, { allowSession: false });
}

export async function POST(request: Request) {
  return handleReminderDispatchRequest(request, { allowSession: true });
}
