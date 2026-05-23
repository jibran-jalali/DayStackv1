import { getAppBaseUrl, isWebPushConfigured } from "@/lib/env";
import { isEmailServerConfigured, sendTaskReminderEmail } from "@/lib/email/server";
import {
  deleteStaleMutableReminders,
  fetchDueTaskReminders,
  isEmailReminderType,
  isPushReminderType,
  syncTaskRemindersForActiveUsers,
  updateTaskReminderStatus,
} from "@/lib/data/reminders";
import { sendTaskReminderPush } from "@/lib/push/server";

declare global {
  var __daystack_scheduler_active: boolean | undefined;
  var __daystack_scheduler_interval: NodeJS.Timeout | undefined;
}

export function startBackgroundScheduler() {
  // Prevent running in the browser client or double-running in dev mode
  if (typeof window !== "undefined") return;
  if (globalThis.__daystack_scheduler_active) return;
  
  globalThis.__daystack_scheduler_active = true;

  console.log("[DayStack Scheduler] Starting server-side background reminder loop (runs every 30s)...");

  const runScheduler = async () => {
    try {
      const emailConfigured = isEmailServerConfigured();
      const pushConfigured = isWebPushConfigured();

      if (!emailConfigured && !pushConfigured) {
        return; // No notification channel is configured
      }

      const appBaseUrl = getAppBaseUrl();
      const now = new Date();

      // 1. Clean stale mutable rows, then sync future reminders for active users
      await deleteStaleMutableReminders(now);
      await syncTaskRemindersForActiveUsers(now);

      // 2. Fetch pending due reminders (limit to 50 per run)
      const reminders = await fetchDueTaskReminders({ limit: 50, nowIso: now.toISOString() });

      if (reminders.length > 0) {
        console.log(`[DayStack Scheduler] Found ${reminders.length} due reminders to dispatch.`);
      }

      for (const dueReminder of reminders) {
        const reminderId = dueReminder.reminder.id;
        try {
          await updateTaskReminderStatus(reminderId, "processing");

          if (dueReminder.task.status === "completed") {
            await updateTaskReminderStatus(reminderId, "skipped");
            continue;
          }

          if (isEmailReminderType(dueReminder.reminder.reminder_type)) {
            if (!dueReminder.preferences.email_enabled) {
              await updateTaskReminderStatus(reminderId, "skipped");
              continue;
            }

            if (!emailConfigured || !dueReminder.recipient.email) {
              await updateTaskReminderStatus(reminderId, "failed");
              continue;
            }

            const url = new URL("/app", appBaseUrl);
            url.searchParams.set("date", dueReminder.task.task_date);

            await sendTaskReminderEmail({
              appUrl: url.toString(),
              leadMinutes: dueReminder.preferences.email_reminder_lead_minutes,
              recipient: dueReminder.recipient,
              task: dueReminder.task,
            });

            await updateTaskReminderStatus(reminderId, "sent", {
              sentAt: new Date().toISOString(),
            });
            console.log(`[DayStack Scheduler] Email reminder sent for task: "${dueReminder.task.title}"`);
          } else if (isPushReminderType(dueReminder.reminder.reminder_type)) {
            if (!dueReminder.preferences.push_enabled) {
              await updateTaskReminderStatus(reminderId, "skipped");
              continue;
            }

            if (!pushConfigured) {
              await updateTaskReminderStatus(reminderId, "failed");
              continue;
            }

            const result = await sendTaskReminderPush(dueReminder);

            if (result.sent === 0) {
              const status = result.skipped ? "skipped" : "failed";
              await updateTaskReminderStatus(reminderId, status);
              console.log(`[DayStack Scheduler] Push reminder ${status} for task: "${dueReminder.task.title}"`);
              continue;
            }

            await updateTaskReminderStatus(reminderId, "sent", {
              sentAt: new Date().toISOString(),
            });
            console.log(`[DayStack Scheduler] Push reminder sent successfully for task: "${dueReminder.task.title}"`);
          } else {
            await updateTaskReminderStatus(reminderId, "skipped");
          }
        } catch (error) {
          console.error(`[DayStack Scheduler] Error dispatching reminder ${reminderId}:`, error);
          await updateTaskReminderStatus(reminderId, "failed");
        }
      }
    } catch (error) {
      console.error("[DayStack Scheduler] Run error:", error);
    }
  };

  // Run immediately on startup, then every 30 seconds
  void runScheduler();
  globalThis.__daystack_scheduler_interval = setInterval(runScheduler, 30_000);
}
