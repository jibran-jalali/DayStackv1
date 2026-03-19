"use client";

import { useEffect, useEffectEvent, useState, useTransition } from "react";

import { updateNotificationPreferences } from "@/lib/client/reminders";
import {
  disableOneSignalPush,
  enableOneSignalPush,
  getOneSignalState,
  loginOneSignalUser,
  observeOneSignalState,
} from "@/lib/onesignal/client";
import { getErrorMessage } from "@/lib/utils";
import type { OneSignalSubscriptionState, UserNotificationPreferencesRecord } from "@/types/daystack";

function createDefaultNotificationState(): OneSignalSubscriptionState {
  return {
    browserLabel: "this browser",
    configured: Boolean(process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID?.trim()),
    isStandalone: false,
    permissionGranted: false,
    permissionStatus: "unsupported",
    platform: "unknown",
    ready: false,
    supportState: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID?.trim() ? "unsupported" : "missing-config",
    supported: false,
    subscribed: false,
    subscriptionId: null,
  };
}

function getPushSupportError(state: OneSignalSubscriptionState) {
  if (state.supportState === "missing-config") {
    return "Add your OneSignal app ID before enabling reminders.";
  }

  if (state.supportState === "needs-install") {
    return "On iPhone and iPad, install DayStack to the Home Screen first. Then open the installed app and enable reminders there.";
  }

  if (state.supportState === "permission-denied") {
    return `Notifications are turned off for ${state.browserLabel}. Re-enable them in the browser's site settings, then try again.`;
  }

  if (state.supportState === "unsupported") {
    return `${state.browserLabel} cannot receive DayStack web push notifications in this context.`;
  }

  if (!state.subscribed) {
    return "Push permission was not granted for this browser.";
  }

  return null;
}

interface UseNotificationSettingsOptions {
  initialPreferences: UserNotificationPreferencesRecord;
  onNotice?: (notice: { message: string; type: "error" | "success" }) => void;
  userId: string;
}

export function useNotificationSettings({
  initialPreferences,
  onNotice,
  userId,
}: UseNotificationSettingsOptions) {
  const [notificationPreferences, setNotificationPreferences] = useState(initialPreferences);
  const [notificationState, setNotificationState] = useState<OneSignalSubscriptionState>(
    createDefaultNotificationState(),
  );
  const [isPending, startTransition] = useTransition();

  const syncPushEnabledPreference = useEffectEvent(async (subscribed: boolean) => {
    if (notificationPreferences.push_enabled === subscribed) {
      return;
    }

    try {
      const nextPreferences = await updateNotificationPreferences({
        push_enabled: subscribed,
      });
      setNotificationPreferences(nextPreferences);
    } catch {
      return;
    }
  });

  const syncOneSignalState = useEffectEvent(async (nextState: OneSignalSubscriptionState) => {
    setNotificationState(nextState);

    if (!nextState.configured || !nextState.ready || !nextState.supported) {
      return;
    }

    await syncPushEnabledPreference(nextState.subscribed);
  });

  useEffect(() => {
    let unsubscribe: () => void = () => {};

    void (async () => {
      try {
        const state = await loginOneSignalUser(userId);
        await syncOneSignalState(state);

        unsubscribe = await observeOneSignalState((nextState) => {
          void syncOneSignalState(nextState);
        });
      } catch {
        const fallbackState = await getOneSignalState().catch(() => createDefaultNotificationState());
        setNotificationState(fallbackState);
      }
    })();

    return () => {
      unsubscribe();
    };
  }, [userId]);

  function toggleReminderSetting(
    key: "remind_5_min_before" | "remind_at_start" | "remind_overdue",
    nextValue: boolean,
  ) {
    startTransition(async () => {
      try {
        const nextPreferences = await updateNotificationPreferences({
          [key]: nextValue,
        });
        setNotificationPreferences(nextPreferences);
        onNotice?.({
          type: "success",
          message: "Reminder settings updated.",
        });
      } catch (error) {
        onNotice?.({
          type: "error",
          message: getErrorMessage(error),
        });
      }
    });
  }

  function togglePushReminders(nextValue: boolean) {
    startTransition(async () => {
      try {
        const nextState = nextValue ? await enableOneSignalPush() : await disableOneSignalPush();
        setNotificationState(nextState);

        if (nextValue) {
          const pushSupportError = getPushSupportError(nextState);

          if (pushSupportError) {
            throw new Error(pushSupportError);
          }
        }

        const nextPreferences = await updateNotificationPreferences({
          push_enabled: nextValue ? nextState.subscribed : false,
        });

        setNotificationPreferences(nextPreferences);
        onNotice?.({
          type: "success",
          message: nextValue ? "Reminders enabled on this browser." : "Reminders paused for this browser.",
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
          throw new Error(payload?.error ?? "The test notification could not be sent.");
        }

        onNotice?.({
          type: "success",
          message: payload?.message ?? "Test notification sent.",
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
    notificationState,
    sendTestNotification,
    setNotificationPreferences,
    togglePushReminders,
    toggleReminderSetting,
  };
}
