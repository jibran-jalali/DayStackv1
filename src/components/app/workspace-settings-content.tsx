"use client";

import { CalendarDays, LogOut, Mail } from "lucide-react";

import { ActionFeedbackPanel } from "@/components/app/action-feedback-panel";
import { AutomationKeysPanel } from "@/components/app/automation-keys-panel";
import { EmailSettingsPanel } from "@/components/app/email-settings-panel";
import { buttonVariants } from "@/components/shared/button";
import { formatDateLabel } from "@/lib/daystack";
import type { UserNotificationPreferencesRecord } from "@/types/daystack";

interface WorkspaceSettingsContentProps {
  actionSoundsEnabled: boolean;
  compact?: boolean;
  displayName: string;
  email?: string;
  isBusy: boolean;
  notificationPreferences: UserNotificationPreferencesRecord;
  onNotice?: (notice: { message: string; type: "error" | "success" }) => void;
  onOpenPlanner: () => void;
  onSignOut?: () => void;
  onSendTest: () => void;
  onSaveLeadMinutes: (nextValue: number) => void;
  onToggleActionSounds: (nextValue: boolean) => void;
  onToggleEmail: (nextValue: boolean) => void;
  onToggleMeetingMentionEmail: (nextValue: boolean) => void;
  selectedDate?: string;
}

export function WorkspaceSettingsContent({
  actionSoundsEnabled,
  compact = false,
  displayName,
  email,
  isBusy,
  notificationPreferences,
  onNotice,
  onOpenPlanner,
  onSignOut,
  onSendTest,
  onSaveLeadMinutes,
  onToggleActionSounds,
  onToggleEmail,
  onToggleMeetingMentionEmail,
  selectedDate,
}: WorkspaceSettingsContentProps) {
  if (compact) {
    return (
      <div className="space-y-3.5">
        <EmailSettingsPanel
          accountEmail={email}
          isBusy={isBusy}
          onSendTest={onSendTest}
          onSaveLeadMinutes={onSaveLeadMinutes}
          onToggleEmail={onToggleEmail}
          onToggleMeetingMentionEmail={onToggleMeetingMentionEmail}
          preferences={notificationPreferences}
        />

        <ActionFeedbackPanel enabled={actionSoundsEnabled} onToggle={onToggleActionSounds} />
        <AutomationKeysPanel compact onNotice={onNotice} />

        <section className="mobile-card p-4">
          <p className="section-label">Account</p>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{displayName}</p>
              <p className="text-sm text-secondary-foreground">{email ?? "Focused operator"}</p>
            </div>
            {selectedDate ? (
              <div className="rounded-[18px] border border-border/70 bg-muted/35 px-3 py-2.5 text-sm text-secondary-foreground">
                Selected day: <span className="font-medium text-foreground">{formatDateLabel(selectedDate)}</span>
              </div>
            ) : null}
            <div className="grid gap-2">
              <button
                type="button"
                className={buttonVariants({ variant: "secondary", size: "sm", className: "w-full" })}
                onClick={onOpenPlanner}
              >
                <CalendarDays className="h-4 w-4" />
                Back to plan
              </button>
              {onSignOut ? (
                <button
                  type="button"
                  className={buttonVariants({ variant: "ghost", size: "sm", className: "w-full" })}
                  onClick={onSignOut}
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
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
            accountEmail={email}
            isBusy={isBusy}
            onSendTest={onSendTest}
            onSaveLeadMinutes={onSaveLeadMinutes}
            onToggleEmail={onToggleEmail}
            onToggleMeetingMentionEmail={onToggleMeetingMentionEmail}
            preferences={notificationPreferences}
          />

          <ActionFeedbackPanel enabled={actionSoundsEnabled} onToggle={onToggleActionSounds} />
          <AutomationKeysPanel onNotice={onNotice} />
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
            {selectedDate ? (
              <div className="rounded-[18px] border border-border/70 bg-muted/35 px-3 py-2.5 text-sm text-secondary-foreground">
                Selected day: <span className="font-medium text-foreground">{formatDateLabel(selectedDate)}</span>
              </div>
            ) : null}
            <button
              type="button"
              className={buttonVariants({ variant: "secondary", size: "sm", className: "w-full" })}
              onClick={onOpenPlanner}
            >
              <CalendarDays className="h-4 w-4" />
              Back to plan
            </button>
            {onSignOut ? (
              <button
                type="button"
                className={buttonVariants({ variant: "ghost", size: "sm", className: "w-full" })}
                onClick={onSignOut}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            ) : null}
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
  );
}
