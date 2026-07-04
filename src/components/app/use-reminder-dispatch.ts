"use client";

import { useEffect } from "react";

import type { UserNotificationPreferencesRecord } from "@/types/daystack";

const DISPATCH_INTERVAL_MS = 60_000;

export function useReminderDispatch(preferences: UserNotificationPreferencesRecord) {
  const shouldDispatch = preferences.push_enabled || preferences.email_enabled;

  useEffect(() => {
    if (!shouldDispatch) {
      return;
    }

    let isDisposed = false;

    async function dispatchReminders() {
      try {
        await fetch("/api/reminders/dispatch", {
          credentials: "same-origin",
          method: "POST",
        });
      } catch {
        // Silent retry on next interval — reminders are best-effort while the app is open.
      }
    }

    void dispatchReminders();

    const intervalId = window.setInterval(() => {
      if (!isDisposed) {
        void dispatchReminders();
      }
    }, DISPATCH_INTERVAL_MS);

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
    };
  }, [shouldDispatch]);
}
