"use client";

import { useState, useTransition } from "react";

import { updateNotificationPreferences } from "@/lib/client/reminders";
import { getErrorMessage } from "@/lib/utils";
import type { UserNotificationPreferencesRecord } from "@/types/daystack";

interface UseNotificationSettingsOptions {
  initialPreferences: UserNotificationPreferencesRecord;
  onNotice?: (notice: { message: string; type: "error" | "success" }) => void;
}

export function useNotificationSettings({
  initialPreferences,
  onNotice,
}: UseNotificationSettingsOptions) {
  const [notificationPreferences, setNotificationPreferences] = useState(initialPreferences);
  const [isPending, startTransition] = useTransition();

  function toggleEmailReminders(nextValue: boolean) {
    startTransition(async () => {
      try {
        const nextPreferences = await updateNotificationPreferences({
          email_enabled: nextValue,
        });
        setNotificationPreferences(nextPreferences);
        onNotice?.({
          type: "success",
          message: nextValue ? "Email reminders enabled." : "Email reminders turned off.",
        });
      } catch (error) {
        onNotice?.({
          type: "error",
          message: getErrorMessage(error),
        });
      }
    });
  }

  function toggleMeetingMentionEmails(nextValue: boolean) {
    startTransition(async () => {
      try {
        const nextPreferences = await updateNotificationPreferences({
          meeting_mention_email_enabled: nextValue,
        });
        setNotificationPreferences(nextPreferences);
        onNotice?.({
          type: "success",
          message: nextValue ? "Meeting mention emails enabled." : "Meeting mention emails turned off.",
        });
      } catch (error) {
        onNotice?.({
          type: "error",
          message: getErrorMessage(error),
        });
      }
    });
  }

  function updateEmailReminderLeadMinutes(nextValue: number) {
    startTransition(async () => {
      try {
        const nextPreferences = await updateNotificationPreferences({
          email_reminder_lead_minutes: nextValue,
        });
        setNotificationPreferences(nextPreferences);
        onNotice?.({
          type: "success",
          message: "Email reminder timing updated.",
        });
      } catch (error) {
        onNotice?.({
          type: "error",
          message: getErrorMessage(error),
        });
      }
    });
  }

  function sendTestNotification() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/notifications/test", {
          method: "POST",
        });

        const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? "The test email could not be sent.");
        }

        onNotice?.({
          type: "success",
          message: payload?.message ?? "Test email sent.",
        });
      } catch (error) {
        onNotice?.({
          type: "error",
          message: getErrorMessage(error),
        });
      }
    });
  }

  return {
    isNotificationPending: isPending,
    notificationPreferences,
    sendTestNotification,
    setNotificationPreferences,
    toggleEmailReminders,
    toggleMeetingMentionEmails,
    updateEmailReminderLeadMinutes,
  };
}
