import { Bell, BellOff, CheckCircle2, LoaderCircle, Send, ShieldAlert, Smartphone } from "lucide-react";

import { Button } from "@/components/shared/button";
import { StatusChip } from "@/components/shared/status-chip";
import { cn } from "@/lib/utils";
import type { OneSignalSubscriptionState, UserNotificationPreferencesRecord } from "@/types/daystack";

interface ReminderSettingsPanelProps {
  isBusy: boolean;
  isHighlighted?: boolean;
  notificationState: OneSignalSubscriptionState;
  onSendTest: () => void;
  onTogglePush: (nextValue: boolean) => void;
  onToggleSetting: (
    key: "remind_5_min_before" | "remind_at_start" | "remind_overdue",
    nextValue: boolean,
  ) => void;
  preferences: UserNotificationPreferencesRecord;
}

function getSupportContent(
  notificationState: OneSignalSubscriptionState,
  isPushEnabled: boolean,
) {
  if (!notificationState.configured) {
    return {
      body: "Push is not connected for this deployment yet.",
      label: "Setup",
      steps: ["Add the OneSignal App ID and REST API key in your environment settings."],
      tone: "default" as const,
      title: "Reminders need OneSignal",
    };
  }

  if (notificationState.supportState === "needs-install") {
    return {
      body: "iPhone and iPad web push works from the installed web app, not from a normal browser tab.",
      label: "Home Screen",
      steps: [
        "Open DayStack in Safari.",
        "Tap Share, then choose Add to Home Screen.",
        "Open the installed DayStack app and enable reminders there.",
      ],
      tone: "brand" as const,
      title: "Install DayStack first",
    };
  }

  if (notificationState.supportState === "permission-denied") {
    return {
      body: `Notifications are currently turned off for ${notificationState.browserLabel}.`,
      label: "Permission off",
      steps: ["Open the browser's site settings, allow notifications for DayStack, then return here."],
      tone: "warning" as const,
      title: "Browser permission is blocked",
    };
  }

  if (notificationState.supportState === "unsupported") {
    return {
      body: `${notificationState.browserLabel} cannot receive DayStack web push notifications in this context.`,
      label: "Unavailable",
      steps: ["Try the installed iPhone app or a push-capable browser on desktop or Android."],
      tone: "default" as const,
      title: "Push is not available here",
    };
  }

  if (isPushEnabled) {
    return {
      body: "This browser is subscribed and ready to receive DayStack reminder pushes.",
      label: "Ready",
      steps: ["Use Test notification to confirm the connection before relying on reminders."],
      tone: "success" as const,
      title: "Reminders are active",
    };
  }

  return {
    body: `Push is available on ${notificationState.browserLabel} once you turn reminders on.`,
    label: "Available",
    steps: ["Enable reminders when you want DayStack to nudge the schedule on this device."],
    tone: "brand" as const,
    title: "This browser can receive reminders",
  };
}

function ToggleRow({
  checked,
  description,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  disabled: boolean;
  label: string;
  onChange: (nextValue: boolean) => void;
}) {
  return (
    <button
      suppressHydrationWarning
      type="button"
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-[16px] border border-border/70 bg-white/72 px-3 py-2.5 text-left transition-[transform,box-shadow,border-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
        disabled ? "cursor-not-allowed opacity-60" : "hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(15,23,42,0.05)]",
      )}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      aria-pressed={checked}
    >
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block text-xs text-secondary-foreground">{description}</span>
      </span>
      <span
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-brand-gradient shadow-[0_10px_18px_rgba(23,102,214,0.18)]" : "bg-border",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_4px_10px_rgba(15,23,42,0.14)] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
            checked ? "translate-x-[1.35rem]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

export function ReminderSettingsPanel({
  isBusy,
  isHighlighted,
  notificationState,
  onSendTest,
  onTogglePush,
  onToggleSetting,
  preferences,
}: ReminderSettingsPanelProps) {
  const isPushReady =
    notificationState.configured &&
    (notificationState.supportState === "available" || notificationState.supportState === "subscribed");
  const isPushEnabled = preferences.push_enabled && notificationState.subscribed;
  const supportContent = getSupportContent(notificationState, isPushEnabled);
  const canTogglePush =
    isPushEnabled ||
    notificationState.supportState === "available" ||
    notificationState.supportState === "subscribed";

  return (
    <section
      id="reminder-settings-panel"
      className={cn(
        "rounded-[18px] border border-border/70 bg-white/78 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-[box-shadow,border-color,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        isHighlighted && "border-primary/30 shadow-[0_18px_36px_rgba(24,190,239,0.12)]",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/70">Reminders</p>
          <p className="mt-2 text-sm text-secondary-foreground">{supportContent.body}</p>
        </div>
        <StatusChip
          label={isPushEnabled ? "On" : "Off"}
          tone={isPushEnabled ? "brand" : "default"}
          icon={isPushEnabled ? Bell : BellOff}
          className="shrink-0"
        />
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Button
          size="sm"
          className="w-full sm:w-auto"
          disabled={isBusy || !canTogglePush}
          onClick={() => onTogglePush(!isPushEnabled)}
        >
          {isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : isPushEnabled ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          {isPushEnabled ? "Pause reminders" : "Enable reminders"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="w-full sm:w-auto"
          disabled={isBusy || !isPushEnabled}
          onClick={onSendTest}
        >
          <Send className="h-4 w-4" />
          Test notification
        </Button>
      </div>

      <div
        className={cn(
          "mt-3 rounded-[18px] border px-3.5 py-3.5",
          supportContent.tone === "success" && "border-emerald-200 bg-emerald-50/72",
          supportContent.tone === "brand" && "border-cyan-200 bg-cyan-50/72",
          supportContent.tone === "warning" && "border-amber-200 bg-amber-50/82",
          supportContent.tone === "default" && "border-border/75 bg-muted/45",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              supportContent.tone === "success" && "bg-emerald-100 text-emerald-700",
              supportContent.tone === "brand" && "bg-cyan-100 text-sky-700",
              supportContent.tone === "warning" && "bg-amber-100 text-amber-700",
              supportContent.tone === "default" && "bg-white text-secondary-foreground",
            )}
          >
            {supportContent.tone === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : supportContent.tone === "warning" ? (
              <ShieldAlert className="h-4 w-4" />
            ) : (
              <Smartphone className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/70">
              {supportContent.label}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">{supportContent.title}</p>
            {supportContent.steps.length > 0 ? (
              <ol className="mt-2 space-y-1.5 text-sm leading-6 text-secondary-foreground">
                {supportContent.steps.map((step, index) => (
                  <li key={step} className="flex gap-2">
                    <span className="font-semibold text-foreground/70">{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <ToggleRow
          checked={preferences.remind_5_min_before}
          description="Catch the block before it begins."
          disabled={isBusy || !isPushReady}
          label="5 min before"
          onChange={(nextValue) => onToggleSetting("remind_5_min_before", nextValue)}
        />
        <ToggleRow
          checked={preferences.remind_at_start}
          description="Nudge the exact start time."
          disabled={isBusy || !isPushReady}
          label="At start"
          onChange={(nextValue) => onToggleSetting("remind_at_start", nextValue)}
        />
        <ToggleRow
          checked={preferences.remind_overdue}
          description="Flag unfinished blocks once they run over."
          disabled={isBusy || !isPushReady}
          label="Overdue"
          onChange={(nextValue) => onToggleSetting("remind_overdue", nextValue)}
        />
      </div>
    </section>
  );
}
