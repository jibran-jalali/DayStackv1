"use client";

import { BellRing, Send, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/shared/button";
import { StatusChip } from "@/components/shared/status-chip";
import { getCurrentPushSubscription, getPushSupportState, type PushSupportState } from "@/lib/client/push";
import { cn } from "@/lib/utils";

interface PushSettingsPanelProps {
  compact?: boolean;
  isBusy: boolean;
  onSendTest: () => void;
  onTogglePush: (nextValue: boolean) => void;
  pushEnabled: boolean;
}

function getSupportMessage(supportState: PushSupportState) {
  if (supportState === "blocked") {
    return "Push keys are missing on this deployment.";
  }

  if (supportState === "denied") {
    return "Notifications are blocked for this site.";
  }

  if (supportState === "unsupported") {
    return "This browser does not support web push.";
  }

  return "Works on iPhone Home Screen app and desktop browsers.";
}

export function PushSettingsPanel({
  compact = false,
  isBusy,
  onSendTest,
  onTogglePush,
  pushEnabled,
}: PushSettingsPanelProps) {
  const [supportState, setSupportState] = useState<PushSupportState>("configured");
  const [hasDeviceSubscription, setHasDeviceSubscription] = useState(false);

  useEffect(() => {
    let isMounted = true;

    Promise.resolve()
      .then(async () => {
        const nextSupportState = getPushSupportState();

        if (!isMounted) {
          return;
        }

        setSupportState(nextSupportState);

        if (nextSupportState !== "configured") {
          setHasDeviceSubscription(false);
          return;
        }

        const subscription = await getCurrentPushSubscription();

        if (isMounted) {
          setHasDeviceSubscription(Boolean(subscription));
        }
      })
      .catch(() => {
        if (isMounted) {
          setHasDeviceSubscription(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [pushEnabled]);

  const canUsePush = supportState === "configured";

  return (
    <section
      className={cn(
        "rounded-[18px] border border-border/70 bg-white/78 shadow-[0_10px_24px_rgba(15,23,42,0.04)]",
        compact ? "p-3" : "p-4",
      )}
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/70">
            Push reminders
          </p>
          <p className={cn("mt-1.5 text-secondary-foreground", compact ? "text-xs" : "text-sm")}>
            5-minute task alerts on this device.
          </p>
        </div>
        <StatusChip
          label={pushEnabled ? "Push on" : "Push off"}
          tone={pushEnabled ? "brand" : "default"}
          icon={pushEnabled ? BellRing : Smartphone}
          className={cn("shrink-0", compact && "px-2 py-1 text-[10px]")}
        />
      </div>

      <button
        suppressHydrationWarning
        type="button"
        className={cn(
          "mt-3 flex w-full items-center justify-between gap-3 rounded-[16px] border border-border/70 bg-white/72 px-3 text-left transition-[transform,box-shadow,border-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
          compact ? "py-2" : "py-2.5",
          isBusy || !canUsePush
            ? "cursor-not-allowed opacity-60"
            : "hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(15,23,42,0.05)]",
        )}
        onClick={() => onTogglePush(!pushEnabled)}
        disabled={isBusy || !canUsePush}
        aria-pressed={pushEnabled}
      >
        <span>
          <span className="block text-sm font-medium text-foreground">Push task reminders</span>
          <span className={cn("block text-xs text-secondary-foreground", compact && "line-clamp-1")}>
            {getSupportMessage(supportState)}
          </span>
        </span>
        <span
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
            pushEnabled ? "bg-brand-gradient shadow-[var(--shadow-brand-sm)]" : "bg-border",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_4px_10px_rgba(15,23,42,0.14)] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
              pushEnabled ? "translate-x-[1.35rem]" : "translate-x-0.5",
            )}
          />
        </span>
      </button>

      <div className="mt-3 flex flex-col gap-1.5 sm:flex-row">
        <Button
          size="sm"
          className={compact ? "h-9 text-xs" : undefined}
          disabled={isBusy || !pushEnabled || !hasDeviceSubscription}
          onClick={onSendTest}
        >
          <Send className="h-4 w-4" />
          Send test push
        </Button>
        <p className="text-xs text-secondary-foreground sm:flex sm:items-center">
          {hasDeviceSubscription ? "This device is connected." : "Enable push on each device you use."}
        </p>
      </div>
    </section>
  );
}
