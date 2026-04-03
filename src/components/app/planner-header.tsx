"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Bell, CalendarDays, Clock3, Flame, LoaderCircle, LogOut, MessageSquareText, Plus, Settings2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { useTransition } from "react";

import { NotificationCenter } from "@/components/app/notification-center";
import { ViewToggle, type PlannerViewMode } from "@/components/app/view-toggle";
import { Button } from "@/components/shared/button";
import { Logo } from "@/components/shared/logo";
import { StatusChip } from "@/components/shared/status-chip";
import { getErrorMessage } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { PlannerDateMode, TaskNotificationAcceptResult } from "@/types/daystack";

interface PlannerHeaderProps {
  activePage: "assistant" | "notifications" | "planner" | "pomodoro" | "settings";
  assistantHref?: string;
  dateLabel: string;
  dateMode?: PlannerDateMode;
  displayName: string;
  email?: string;
  metricIcon?: LucideIcon;
  metricLabel?: string;
  metricTone?: "brand" | "default" | "success" | "warning";
  onAddTask?: () => void;
  onNotice?: (notice: { message: string; type: "error" | "success" }) => void;
  onOpenAssistant?: () => void;
  onOpenNotifications?: () => void;
  onOpenPlanner?: () => void;
  onOpenSettings?: () => void;
  onOpenTaskDay?: (taskDate: string) => void;
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
  activePage: "assistant" | "notifications" | "planner" | "pomodoro" | "settings",
  dateMode?: PlannerDateMode,
) {
  if (activePage === "assistant") {
    return "Assistant";
  }

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
  assistantHref = "/app?tab=assistant",
  dateLabel,
  dateMode,
  displayName,
  email,
  metricIcon,
  metricLabel,
  metricTone = "brand",
  onAddTask,
  onNotice,
  onOpenAssistant,
  onOpenNotifications,
  onOpenPlanner,
  onOpenSettings,
  onOpenTaskDay,
  onSignOutError,
  onTaskAccepted,
  plannerHref = "/app",
  notificationsHref,
  onViewChange,
  pomodoroHref = "/app/pomodoro",
  settingsHref = "/app/settings",
  showNotificationCenter = false,
  streak,
  subtitle,
  viewMode,
}: PlannerHeaderProps) {
  const [isPending, startTransition] = useTransition();

  const navPillClass =
    "ui-pressable inline-flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold shadow-[0_10px_24px_rgba(15,23,42,0.05)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)] active:scale-[0.995]";

  function renderNavPill({
    active = false,
    href,
    icon: Icon,
    label,
    onClick,
  }: {
    active?: boolean;
    href?: string;
    icon: LucideIcon;
    label: string;
    onClick?: () => void;
  }) {
    const className = cn(
      navPillClass,
      active
        ? "border-transparent bg-brand-gradient text-white shadow-[var(--shadow-brand-pill)]"
        : "border-border/80 bg-white/92 text-secondary-foreground hover:bg-white hover:text-foreground",
    );

    if (active) {
      return (
        <span className={className}>
          <Icon className="h-4 w-4" />
          {label}
        </span>
      );
    }

    if (onClick) {
      return (
        <button type="button" className={className} onClick={onClick}>
          <Icon className="h-4 w-4" />
          {label}
        </button>
      );
    }

    return (
      <Link href={href ?? "#"} className={className}>
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    );
  }

  function handleSignOut() {
    startTransition(async () => {
      try {
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
          {viewMode && onViewChange ? (
            <ViewToggle value={viewMode} onChange={onViewChange} />
          ) : (
            renderNavPill({
              active: activePage === "planner",
              href: plannerHref,
              icon: CalendarDays,
              label: "Plan",
              onClick: activePage === "planner" ? undefined : onOpenPlanner,
            })
          )}

          {renderNavPill({
            active: activePage === "assistant",
            href: assistantHref,
            icon: MessageSquareText,
            label: "Assistant",
            onClick: activePage === "assistant" ? undefined : onOpenAssistant,
          })}

          {renderNavPill({
            active: activePage === "notifications",
            href: notificationsHref ?? "/app/notifications",
            icon: Bell,
            label: "Notifications",
            onClick: activePage === "notifications" ? undefined : onOpenNotifications,
          })}

          {renderNavPill({
            active: activePage === "settings",
            href: settingsHref,
            icon: Settings2,
            label: "Settings",
            onClick: activePage === "settings" ? undefined : onOpenSettings,
          })}

          {renderNavPill({
            active: activePage === "pomodoro",
            href: pomodoroHref,
            icon: Clock3,
            label: "Pomodoro",
          })}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {activePage === "planner" && onAddTask ? (
            <>
              <Button size="sm" className="min-w-[8.25rem]" onClick={onAddTask}>
                <Plus className="h-4 w-4" />
                Add Block
              </Button>
            </>
          ) : null}

          {showNotificationCenter ? (
            <NotificationCenter
              openInboxHref={notificationsHref}
              onOpenDay={onOpenTaskDay}
              onOpenInbox={onOpenNotifications}
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
