"use client";

import Link from "next/link";
import { Bell, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PlannerHeader } from "@/components/app/planner-header";
import { ReminderSettingsPanel } from "@/components/app/reminder-settings-panel";
import { useNotificationSettings } from "@/components/app/use-notification-settings";
import { buttonVariants } from "@/components/shared/button";
import { formatDateKey, formatDateLabel } from "@/lib/daystack";
import type { UserNotificationPreferencesRecord } from "@/types/daystack";

interface SettingsShellProps {
  displayName: string;
  email?: string;
  initialNotificationPreferences: UserNotificationPreferencesRecord;
  returnDate?: string;
  userId: string;
}

type NoticeState =
  | {
      type: "success" | "error";
      message: string;
    }
  | null;

function getBrowserStatusContent(
  state: ReturnType<typeof useNotificationSettings>["notificationState"],
) {
  switch (state.supportState) {
    case "needs-install":
      return {
        icon: Smartphone,
        title: "Install DayStack on iPhone first",
        body: "Web push on iPhone and iPad works from the Home Screen app, not from a normal browser tab.",
        tone: "brand" as const,
      };
    case "permission-denied":
      return {
        icon: ShieldAlert,
        title: "Notifications are blocked",
        body: `Allow notifications for DayStack in ${state.browserLabel} settings, then return here.`,
        tone: "warning" as const,
      };
    case "unsupported":
      return {
        icon: ShieldAlert,
        title: "Push is unavailable here",
        body: `${state.browserLabel} cannot receive DayStack web push notifications in this context.`,
        tone: "default" as const,
      };
    case "subscribed":
      return {
        icon: ShieldCheck,
        title: "This browser is ready",
        body: "Test notification sends a push to this subscribed browser only.",
        tone: "success" as const,
      };
    case "available":
      return {
        icon: ShieldCheck,
        title: "This browser can receive reminders",
        body: "Enable reminders to subscribe this device and start sending task nudges here.",
        tone: "brand" as const,
      };
    default:
      return {
        icon: ShieldCheck,
        title: "Reminders need setup",
        body: "Connect browser notifications here once your device supports push and OneSignal is configured.",
        tone: "default" as const,
      };
  }
}

function getPlannerHref(returnDate?: string) {
  const todayDate = formatDateKey(new Date());

  if (!returnDate || returnDate === todayDate) {
    return "/app";
  }

  return `/app?date=${returnDate}`;
}

function getSettingsHref(returnDate?: string) {
  const todayDate = formatDateKey(new Date());

  if (!returnDate || returnDate === todayDate) {
    return "/app/settings";
  }

  return `/app/settings?date=${returnDate}`;
}

export function SettingsShell({
  displayName,
  email,
  initialNotificationPreferences,
  returnDate,
  userId,
}: SettingsShellProps) {
  const [notice, setNotice] = useState<NoticeState>(null);

  const {
    isNotificationPending,
    notificationPreferences,
    notificationState,
    sendTestNotification,
    togglePushReminders,
    toggleReminderSetting,
  } = useNotificationSettings({
    initialPreferences: initialNotificationPreferences,
    onNotice: setNotice,
    userId,
  });

  useEffect(() => {
    if (notice?.type !== "success") {
      return;
    }

    const timer = window.setTimeout(() => {
      setNotice(null);
    }, 2400);

    return () => window.clearTimeout(timer);
  }, [notice]);

  const plannerHref = useMemo(() => getPlannerHref(returnDate), [returnDate]);
  const settingsHref = useMemo(() => getSettingsHref(returnDate), [returnDate]);
  const remindersActive = notificationPreferences.push_enabled && notificationState.subscribed;
  const browserStatus = useMemo(() => getBrowserStatusContent(notificationState), [notificationState]);

  return (
    <main className="container-shell min-h-screen py-4 sm:py-6">
      <div className="space-y-4 sm:space-y-5">
        <PlannerHeader
          activePage="settings"
          dateLabel="Notifications & reminders"
          displayName={displayName}
          email={email}
          metricIcon={Bell}
          metricLabel={remindersActive ? "Reminders on" : "Reminders off"}
          metricTone={remindersActive ? "brand" : "default"}
          plannerHref={plannerHref}
          settingsHref={settingsHref}
          subtitle="Manage how DayStack nudges the plan."
          onNotice={setNotice}
          onSignOutError={(message) =>
            setNotice({
              type: "error",
              message,
            })
          }
        />

        {notice ? (
          <div className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center px-4">
            <div
              aria-live="polite"
              className={`pointer-events-auto min-w-[16rem] rounded-full border px-4 py-2.5 text-sm shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl ${
                notice.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-danger"
              }`}
            >
              {notice.message}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <section className="glass-panel p-4 sm:p-5">
            <div className="border-b border-border/70 pb-4">
              <p className="section-label">Notifications</p>
              <h1 className="mt-1 font-display text-2xl font-semibold text-foreground sm:text-[2rem]">
                Reminder preferences
              </h1>
              <p className="mt-1.5 text-sm text-secondary-foreground">
                Choose which reminders show up on this browser and test the connection in one place.
              </p>
            </div>

            <div className="mt-4">
              <ReminderSettingsPanel
                isBusy={isNotificationPending}
                notificationState={notificationState}
                onSendTest={sendTestNotification}
                onTogglePush={togglePushReminders}
                onToggleSetting={toggleReminderSetting}
                preferences={notificationPreferences}
              />
            </div>
          </section>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <section className="rounded-[22px] border border-border/70 bg-white/82 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
              <p className="section-label">Account</p>
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{displayName}</p>
                  <p className="text-sm text-secondary-foreground">{email ?? "Focused operator"}</p>
                </div>
                {returnDate ? (
                  <div className="rounded-[18px] border border-border/70 bg-muted/35 px-3 py-2.5 text-sm text-secondary-foreground">
                    Selected day: <span className="font-medium text-foreground">{formatDateLabel(returnDate)}</span>
                  </div>
                ) : null}
                <Link href={plannerHref} className={buttonVariants({ variant: "secondary", size: "sm", className: "w-full" })}>
                  Back to plan
                </Link>
              </div>
            </section>

            <section className="rounded-[22px] border border-border/70 bg-white/82 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
              <div className="flex items-start gap-3">
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${
                    browserStatus.tone === "success"
                      ? "bg-emerald-100 text-emerald-700"
                      : browserStatus.tone === "warning"
                        ? "bg-amber-100 text-amber-700"
                        : browserStatus.tone === "brand"
                          ? "bg-cyan-50 text-sky-700"
                          : "bg-muted text-secondary-foreground"
                  }`}
                >
                  <browserStatus.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{browserStatus.title}</p>
                  <p className="mt-1 text-sm text-secondary-foreground">{browserStatus.body}</p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
