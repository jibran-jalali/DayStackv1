"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, Clock3, Flame, LoaderCircle, LogOut, Plus } from "lucide-react";
import { signOut } from "next-auth/react";
import { useTransition } from "react";

import { NotificationCenter } from "@/components/app/notification-center";
import { ViewToggle, type PlannerViewMode } from "@/components/app/view-toggle";
import { Button } from "@/components/shared/button";
import { logoutOneSignalUser } from "@/lib/onesignal/client";
import { Logo } from "@/components/shared/logo";
import { StatusChip } from "@/components/shared/status-chip";
import { getErrorMessage } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { PlannerDateMode, TaskNotificationAcceptResult } from "@/types/daystack";

interface PlannerHeaderProps {
  activePage: "notifications" | "planner" | "pomodoro" | "settings";
  dateLabel: string;
  dateMode?: PlannerDateMode;
  displayName: string;
  email?: string;
  metricIcon?: LucideIcon;
  metricLabel?: string;
  metricTone?: "brand" | "default" | "success" | "warning";
  onAddTask?: () => void;
  onNotice?: (notice: { message: string; type: "error" | "success" }) => void;
  onSignOutError: (message: string) => void;
  onTaskAccepted?: (result: TaskNotificationAcceptResult) => Promise<void> | void;
  onViewChange?: (value: PlannerViewMode) => void;
  plannerHref?: string;
  notificationsHref?: string;
  pomodoroHref?: string;
  settingsHighlighted?: boolean;
  settingsHref?: string;
  showNotificationCenter?: boolean;
  streak?: number;
  subtitle?: string;
  viewMode?: PlannerViewMode;
}

function getEyebrow(
  activePage: "notifications" | "planner" | "pomodoro" | "settings",
  dateMode?: PlannerDateMode,
) {
  if (activePage === "settings") {
    return "Preferences";
  }

  if (activePage === "notifications") {
    return "Inbox";
  }

  if (activePage === "pomodoro") {
    return "Focus timer";
  }

  if (dateMode === "future") {
    return "Planned day";
  }

  if (dateMode === "past") {
    return "Past day";
  }

  return "Today";
}

export function PlannerHeader({
  activePage,
  dateLabel,
  dateMode,
  displayName,
  email,
  metricIcon,
  metricLabel,
  metricTone = "brand",
  onAddTask,
  onNotice,
  onSignOutError,
  onTaskAccepted,
  plannerHref = "/app",
  notificationsHref,
  onViewChange,
  pomodoroHref = "/app/pomodoro",
  showNotificationCenter = false,
  streak,
  subtitle,
  viewMode,
}: PlannerHeaderProps) {
  const [isPending, startTransition] = useTransition();

  const navPillClass =
    "inline-flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-[transform,opacity,box-shadow,background-color,border-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]";

  function handleSignOut() {
    startTransition(async () => {
      try {
        await logoutOneSignalUser().catch(() => undefined);

        await signOut({
          redirect: false,
          callbackUrl: "/login",
        });

        window.location.assign("/login");
      } catch (error) {
        onSignOutError(getErrorMessage(error));
      }
    });
  }

  return (
    <header className="glass-panel sticky top-4 z-30 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Logo priority href="/app" className="shrink-0" />
          <div className="min-w-0">
            <p className="section-label">{getEyebrow(activePage, dateMode)}</p>
            <p className="truncate text-sm font-medium text-secondary-foreground">{dateLabel}</p>
            {subtitle ? <p className="mt-0.5 truncate text-xs text-secondary-foreground/80">{subtitle}</p> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {metricLabel ? <StatusChip label={metricLabel} tone={metricTone} icon={metricIcon} /> : null}
          {typeof streak === "number" ? (
            <StatusChip
              label={`${streak} day${streak === 1 ? "" : "s"}`}
              tone={streak > 0 ? "success" : "default"}
              icon={Flame}
            />
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {activePage === "planner" && viewMode && onViewChange ? (
            <>
              <ViewToggle value={viewMode} onChange={onViewChange} />
              <Link
                href={pomodoroHref}
                className={cn(
                  navPillClass,
                  "border-border/80 bg-white/92 text-secondary-foreground hover:-translate-y-0.5 hover:bg-white hover:text-foreground hover:shadow-[0_16px_32px_rgba(15,23,42,0.09)]",
                )}
              >
                <Clock3 className="h-4 w-4" />
                Pomodoro
              </Link>
            </>
          ) : null}

          {activePage === "pomodoro" ? (
            <>
              <Link
                href={plannerHref}
                className={cn(
                  navPillClass,
                  "border-border/80 bg-white/92 text-secondary-foreground hover:-translate-y-0.5 hover:bg-white hover:text-foreground hover:shadow-[0_16px_32px_rgba(15,23,42,0.09)]",
                )}
              >
                <CalendarDays className="h-4 w-4" />
                Plan
              </Link>
              <span
                className={cn(
                  navPillClass,
                  "border-transparent bg-brand-gradient text-white shadow-[0_14px_28px_rgba(23,102,214,0.2)]",
                )}
              >
                <Clock3 className="h-4 w-4" />
                Pomodoro
              </span>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {activePage === "planner" && onAddTask ? (
            <Button size="sm" className="min-w-[8.25rem]" onClick={onAddTask}>
              <Plus className="h-4 w-4" />
              Add Block
            </Button>
          ) : null}

          {showNotificationCenter ? (
            <NotificationCenter
              openInboxHref={notificationsHref}
              onNotice={onNotice}
              onTaskAccepted={onTaskAccepted}
            />
          ) : null}

          <div className="flex items-center gap-2 rounded-full border border-border/80 bg-white/92 px-2 py-1.5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(24,190,239,0.16),rgba(109,40,240,0.16))] text-sm font-semibold text-foreground">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden min-w-0 xl:block">
              <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
              <p className="truncate text-xs text-secondary-foreground">{email ?? "Focused operator"}</p>
            </div>
            <Button size="sm" variant="ghost" className="h-8 px-3" onClick={handleSignOut} disabled={isPending} aria-label="Logout">
              {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
