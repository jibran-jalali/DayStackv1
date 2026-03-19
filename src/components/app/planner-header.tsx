"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Flame, LoaderCircle, LogOut, Plus, Settings2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { useTransition } from "react";

import { NotificationCenter } from "@/components/app/notification-center";
import { ViewToggle, type PlannerViewMode } from "@/components/app/view-toggle";
import { Button } from "@/components/shared/button";
import { logoutOneSignalUser } from "@/lib/onesignal/client";
import { Logo } from "@/components/shared/logo";
import { StatusChip } from "@/components/shared/status-chip";
import { cn, getErrorMessage } from "@/lib/utils";
import type { PlannerDateMode, TaskNotificationAcceptResult } from "@/types/daystack";

interface PlannerHeaderProps {
  activePage: "planner" | "settings";
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
  settingsHighlighted?: boolean;
  settingsHref?: string;
  streak?: number;
  subtitle?: string;
  viewMode?: PlannerViewMode;
}

function getEyebrow(activePage: "planner" | "settings", dateMode?: PlannerDateMode) {
  if (activePage === "settings") {
    return "Preferences";
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
  onViewChange,
  plannerHref = "/app",
  settingsHighlighted,
  settingsHref = "/app/settings",
  streak,
  subtitle,
  viewMode,
}: PlannerHeaderProps) {
  const [isPending, startTransition] = useTransition();

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
          <div className="inline-flex rounded-full border border-border/80 bg-white/92 p-1 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <Link
              href={plannerHref}
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-full px-3.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                activePage === "planner"
                  ? "bg-muted text-foreground shadow-[0_8px_18px_rgba(15,23,42,0.08)]"
                  : "text-secondary-foreground hover:text-foreground",
              )}
            >
              Plan
            </Link>
            <Link
              id="settings-link"
              href={settingsHref}
              className={cn(
                "inline-flex h-9 items-center justify-center gap-2 rounded-full px-3.5 text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                activePage === "settings"
                  ? "bg-muted text-foreground shadow-[0_8px_18px_rgba(15,23,42,0.08)]"
                  : "text-secondary-foreground hover:text-foreground",
                settingsHighlighted &&
                  activePage !== "settings" &&
                  "bg-cyan-50 text-sky-700 shadow-[0_10px_24px_rgba(24,190,239,0.14)]",
              )}
            >
              <Settings2 className="h-4 w-4" />
              <span>Settings</span>
            </Link>
          </div>

          {activePage === "planner" && viewMode && onViewChange ? (
            <ViewToggle value={viewMode} onChange={onViewChange} />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {activePage === "planner" && onAddTask ? (
            <Button size="sm" className="min-w-[8.25rem]" onClick={onAddTask}>
              <Plus className="h-4 w-4" />
              Add Block
            </Button>
          ) : null}

          <NotificationCenter onNotice={onNotice} onTaskAccepted={onTaskAccepted} />

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
