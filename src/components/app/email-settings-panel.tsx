"use client";

import { Mail, MailCheck, MailMinus, Send } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/shared/button";
import { Input } from "@/components/shared/input";
import { StatusChip } from "@/components/shared/status-chip";
import { cn } from "@/lib/utils";
import type { UserNotificationPreferencesRecord } from "@/types/daystack";

interface EmailSettingsPanelProps {
  accountEmail?: string;
  isBusy: boolean;
  onSendTest: () => void;
  onSaveLeadMinutes: (nextValue: number) => void;
  onToggleEmail: (nextValue: boolean) => void;
  onToggleMeetingMentionEmail: (nextValue: boolean) => void;
  preferences: UserNotificationPreferencesRecord;
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
          checked ? "bg-brand-gradient shadow-[var(--shadow-brand-sm)]" : "bg-border",
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

export function EmailSettingsPanel({
  accountEmail,
  isBusy,
  onSendTest,
  onSaveLeadMinutes,
  onToggleEmail,
  onToggleMeetingMentionEmail,
  preferences,
}: EmailSettingsPanelProps) {
  const [leadMinutesInput, setLeadMinutesInput] = useState(() => `${preferences.email_reminder_lead_minutes}`);
  const [leadMinutesError, setLeadMinutesError] = useState("");

  function handleSaveLeadMinutes() {
    const parsed = Number.parseInt(leadMinutesInput, 10);

    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1440) {
      setLeadMinutesError("Use a number from 0 to 1440.");
      return;
    }

    setLeadMinutesError("");
    onSaveLeadMinutes(parsed);
  }

  const emailDeliveryActive = preferences.email_enabled || preferences.meeting_mention_email_enabled;

  return (
    <section className="rounded-[18px] border border-border/70 bg-white/78 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/70">Email delivery</p>
          <p className="mt-2 text-sm text-secondary-foreground">
            Email reminders and meeting mention emails are off by default. When enabled, DayStack sends them to{" "}
            <span className="font-medium text-foreground">{accountEmail ?? "your account email"}</span>.
          </p>
        </div>
        <StatusChip
          label={emailDeliveryActive ? "Email on" : "Email off"}
          tone={emailDeliveryActive ? "brand" : "default"}
          icon={emailDeliveryActive ? MailCheck : MailMinus}
          className="shrink-0"
        />
      </div>

      <div className="mt-4 space-y-2">
        <ToggleRow
          checked={preferences.email_enabled}
          description="Send one pre-start email for every scheduled block, including blocked time."
          disabled={isBusy}
          label="Email block reminders"
          onChange={onToggleEmail}
        />
        <ToggleRow
          checked={preferences.meeting_mention_email_enabled}
          description="Send an email when someone tags you in a meeting block."
          disabled={isBusy}
          label="Email meeting tags"
          onChange={onToggleMeetingMentionEmail}
        />
      </div>

      <div className="mt-4 rounded-[18px] border border-border/70 bg-muted/35 p-3.5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
            <Mail className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Email reminder timing</p>
            <p className="mt-1 text-sm text-secondary-foreground">
              Choose how many minutes before each block DayStack should send the reminder email. Use <span className="font-medium text-foreground">0</span> to send it right at start time.
            </p>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                type="number"
                min={0}
                max={1440}
                step={1}
                value={leadMinutesInput}
                error={leadMinutesError}
                className="h-11 w-full sm:max-w-[12rem]"
                onChange={(event) => {
                  setLeadMinutesInput(event.target.value);
                  if (leadMinutesError) {
                    setLeadMinutesError("");
                  }
                }}
              />
              <Button size="sm" variant="secondary" disabled={isBusy} onClick={handleSaveLeadMinutes}>
                Save timing
              </Button>
              <Button size="sm" disabled={isBusy} onClick={onSendTest}>
                <Send className="h-4 w-4" />
                Send test email
              </Button>
            </div>

            {leadMinutesError ? <p className="mt-2 text-xs font-medium text-danger">{leadMinutesError}</p> : null}
            {!leadMinutesError ? (
              <p className="mt-2 text-xs text-secondary-foreground">
                Sends a sample reminder email to <span className="font-medium text-foreground">{accountEmail ?? "your account email"}</span>.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
