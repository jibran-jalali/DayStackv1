"use client";

import { BellRing, Share, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/shared/button";
import { getPushSupportState } from "@/lib/client/push";
import { isIosDevice, needsIosHomeScreenInstall } from "@/lib/client/device";
import { cn } from "@/lib/utils";

const DISMISS_STORAGE_KEY = "daystack-push-setup-dismissed-at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24;

interface PushReminderSetupBannerProps {
  className?: string;
  isBusy?: boolean;
  onEnablePush: () => void;
  pushEnabled: boolean;
  urgent?: boolean;
}

function wasDismissedRecently() {
  if (typeof window === "undefined") {
    return false;
  }

  const raw = window.localStorage.getItem(DISMISS_STORAGE_KEY);

  if (!raw) {
    return false;
  }

  const dismissedAt = Number(raw);

  if (!Number.isFinite(dismissedAt)) {
    return false;
  }

  return Date.now() - dismissedAt < DISMISS_TTL_MS;
}

export function PushReminderSetupBanner({
  className,
  isBusy = false,
  onEnablePush,
  pushEnabled,
  urgent = false,
}: PushReminderSetupBannerProps) {
  const [isDismissed, setIsDismissed] = useState(true);
  const [needsHomeScreen, setNeedsHomeScreen] = useState(false);
  const [canEnablePush, setCanEnablePush] = useState(false);

  useEffect(() => {
    setIsDismissed(wasDismissedRecently());
    setNeedsHomeScreen(needsIosHomeScreenInstall());
    setCanEnablePush(getPushSupportState() === "configured");
  }, [pushEnabled]);

  if (pushEnabled || isDismissed) {
    return null;
  }

  function handleDismiss() {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    setIsDismissed(true);
  }

  const title = urgent ? "Turn on 5-minute reminders" : "Get a push before every block";
  const description = needsHomeScreen
    ? isIosDevice()
      ? "On iPhone: Share → Add to Home Screen, open DayStack from your home screen, then enable reminders below."
      : "Install DayStack to your home screen, then enable reminders."
    : "You will get one alert 5 minutes before each task, even when the app is closed. Overlapping or back-to-back tasks each get their own notification.";

  return (
    <section
      className={cn(
        "mobile-content-surface relative overflow-hidden p-3.5",
        urgent && "ring-2 ring-brand/20",
        className,
      )}
    >
      <button
        type="button"
        className="absolute right-2 top-2 rounded-full p-1 text-secondary-foreground/70 transition-colors hover:bg-white/70 hover:text-foreground"
        onClick={handleDismiss}
        aria-label="Dismiss reminder setup"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-[var(--shadow-brand-sm)]">
          {needsHomeScreen ? <Share className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-secondary-foreground">{description}</p>
          {!needsHomeScreen ? (
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Button
                size="sm"
                className="h-9 text-xs"
                disabled={isBusy || !canEnablePush}
                onClick={onEnablePush}
              >
                Enable push reminders
              </Button>
              <Button size="sm" variant="ghost" className="h-9 text-xs" onClick={handleDismiss}>
                Not now
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
