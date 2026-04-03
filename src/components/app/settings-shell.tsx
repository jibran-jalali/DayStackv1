"use client";

import Link from "next/link";
import { Bell, Mail } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EmailSettingsPanel } from "@/components/app/email-settings-panel";
import { PlannerHeader } from "@/components/app/planner-header";
import { useNotificationSettings } from "@/components/app/use-notification-settings";
import { buttonVariants } from "@/components/shared/button";
import { formatDateLabel } from "@/lib/daystack";
import type { UserNotificationPreferencesRecord } from "@/types/daystack";

interface SettingsShellProps {
  displayName: string;
  email?: string;
  initialNotificationPreferences: UserNotificationPreferencesRecord;
  returnDate?: string;
}

type NoticeState =
  | {
      type: "success" | "error";
      message: string;
    }
  | null;

function getPlannerHref(returnDate?: string) {
  if (!returnDate) {
    return "/app";
  }

  return `/app?date=${returnDate}`;
}

function getSettingsHref(returnDate?: string) {
  if (!returnDate) {
    return "/app/settings";
  }

  return `/app/settings?date=${returnDate}`;
}

function getAssistantHref(returnDate?: string) {
  if (!returnDate) {
    return "/app?tab=assistant";
  }

  return `/app?tab=assistant&date=${returnDate}`;
}

function getNotificationsHref(returnDate?: string) {
  if (!returnDate) {
    return "/app/notifications";
  }

  return `/app/notifications?date=${returnDate}`;
}

export function SettingsShell({
  displayName,
  email,
  initialNotificationPreferences,
  returnDate,
}: SettingsShellProps) {
  const [notice, setNotice] = useState<NoticeState>(null);

  const {
    isNotificationPending,
    notificationPreferences,
    sendTestNotification,
    toggleEmailReminders,
    toggleMeetingMentionEmails,
    updateEmailReminderLeadMinutes,
  } = useNotificationSettings({
    initialPreferences: initialNotificationPreferences,
    onNotice: setNotice,
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
  const assistantHref = useMemo(() => getAssistantHref(returnDate), [returnDate]);
  const notificationsHref = useMemo(() => getNotificationsHref(returnDate), [returnDate]);
  const settingsHref = useMemo(() => getSettingsHref(returnDate), [returnDate]);
  const activeChannelCount = [
    notificationPreferences.email_enabled,
    notificationPreferences.meeting_mention_email_enabled,
  ].filter(Boolean).length;

  return (
    <main className="container-shell min-h-screen py-4 sm:py-6">
      <div className="space-y-4 sm:space-y-5">
        <PlannerHeader
          activePage="settings"
          assistantHref={assistantHref}
          dateLabel="Notifications & reminders"
          displayName={displayName}
          email={email}
          metricIcon={activeChannelCount > 0 ? Mail : Bell}
          metricLabel={activeChannelCount > 0 ? `${activeChannelCount} channel${activeChannelCount === 1 ? "" : "s"} on` : "All alerts off"}
          metricTone={activeChannelCount > 0 ? "brand" : "default"}
          notificationsHref={notificationsHref}
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
                Notification settings
              </h1>
              <p className="mt-1.5 text-sm text-secondary-foreground">
                Configure email reminders, meeting-tag emails, and a quick delivery test from one place.
              </p>
            </div>

            <div className="mt-4 space-y-4">
              <EmailSettingsPanel
                key={`email-settings-${notificationPreferences.email_reminder_lead_minutes}`}
                accountEmail={email}
                isBusy={isNotificationPending}
                onSendTest={sendTestNotification}
                onSaveLeadMinutes={updateEmailReminderLeadMinutes}
                onToggleEmail={toggleEmailReminders}
                onToggleMeetingMentionEmail={toggleMeetingMentionEmails}
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
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-cyan-50 text-sky-700">
                  <Mail className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Email uses your account address</p>
                  <p className="mt-1 text-sm text-secondary-foreground">
                    DayStack sends reminder and meeting-tag emails to {email ?? "your signed-in email"} once those toggles are enabled.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
