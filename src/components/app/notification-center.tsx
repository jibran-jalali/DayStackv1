"use client";

import Link from "next/link";
import { Bell, BellRing, Check, CheckCheck, Clock3, ExternalLink, Inbox, LoaderCircle, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Button, buttonVariants } from "@/components/shared/button";
import { StatusChip } from "@/components/shared/status-chip";
import {
  acceptTaskNotification,
  fetchTaskNotifications,
  markTaskNotificationsRead,
  rejectTaskNotification,
} from "@/lib/client/notifications";
import { formatClockTime, formatDateLabel } from "@/lib/daystack";
import { cn, getErrorMessage } from "@/lib/utils";
import type { PlannerNotification, TaskNotificationAcceptResult } from "@/types/daystack";

interface NotificationCenterProps {
  compact?: boolean;
  initialNotifications?: PlannerNotification[];
  isActive?: boolean;
  limit?: number;
  mode?: "button" | "page";
  onNotice?: (notice: { message: string; type: "error" | "success" }) => void;
  onOpenDay?: (taskDate: string) => void;
  onOpenInbox?: () => void;
  onTaskAccepted?: (result: TaskNotificationAcceptResult) => Promise<void> | void;
  openInboxHref?: string;
}
function getStatusTone(status: PlannerNotification["status"]) {
  if (status === "accepted") {
    return "success" as const;
  }

  if (status === "pending") {
    return "brand" as const;
  }

  return "default" as const;
}

function getStatusLabel(status: PlannerNotification["status"]) {
  if (status === "accepted") {
    return "Added";
  }

  if (status === "expired") {
    return "Expired";
  }

  if (status === "dismissed") {
    return "Dismissed";
  }

  return "Pending";
}

export function NotificationCenter({
  compact = false,
  initialNotifications,
  isActive = true,
  limit = 10,
  mode = "button",
  onNotice,
  onOpenDay,
  onOpenInbox,
  onTaskAccepted,
  openInboxHref,
}: NotificationCenterProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [notifications, setNotifications] = useState<PlannerNotification[]>(
    () => initialNotifications ?? [],
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(mode === "page");
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const unreadIds = useMemo(
    () => notifications.filter((notification) => !notification.readAt).map((notification) => notification.id),
    [notifications],
  );
  const unreadCount = unreadIds.length;
  const pendingCount = notifications.filter((notification) => notification.status === "pending").length;
  const isVisible = mode === "page" ? isActive : isOpen;

  const loadNotifications = useCallback(
    async (options?: { silent?: boolean }) => {
      try {
        const nextNotifications = await fetchTaskNotifications(limit);
        setNotifications(nextNotifications);
        setLoadError(null);
      } catch (error) {
        if (!options?.silent) {
          setLoadError(getErrorMessage(error));
        }
      }
    },
    [limit],
  );

  useEffect(() => {
    if (mode === "page" && !isActive) {
      return;
    }

    void loadNotifications();
  }, [isActive, loadNotifications, mode]);

  useEffect(() => {
    if (mode === "page" && !isActive) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadNotifications({ silent: true });
      }
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [isActive, loadNotifications, mode]);

  useEffect(() => {
    if (mode !== "button" || !isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, mode]);

  useEffect(() => {
    if (!isVisible || unreadIds.length === 0) {
      return;
    }

    startTransition(async () => {
      try {
        await markTaskNotificationsRead(unreadIds);
        setNotifications((current) =>
          current.map((notification) =>
            unreadIds.includes(notification.id)
              ? {
                  ...notification,
                  readAt: notification.readAt ?? new Date().toISOString(),
                }
              : notification,
          ),
        );
      } catch {
        return;
      }
    });
  }, [isVisible, unreadIds]);

  async function handleAccept(notificationId: string) {
    setActiveNotificationId(notificationId);

    try {
      const result = await acceptTaskNotification(notificationId);
      await onTaskAccepted?.(result);
      await loadNotifications();

      if (result.outcome === "accepted") {
        onNotice?.({
          type: "success",
          message: "The task was added to your timeline.",
        });
        return;
      }

      if (result.outcome === "already_accepted") {
        onNotice?.({
          type: "success",
          message: "That task is already in your timeline.",
        });
        return;
      }

      onNotice?.({
        type: "error",
        message: "That task was deleted before you accepted it.",
      });
    } catch (error) {
      onNotice?.({
        type: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setActiveNotificationId(null);
    }
  }

  async function handleReject(notificationId: string) {
    setActiveNotificationId(notificationId);

    try {
      await rejectTaskNotification(notificationId);
      await loadNotifications();
      onNotice?.({
        type: "success",
        message: "Meeting request rejected. Nothing was added to your timeline.",
      });
    } catch (error) {
      onNotice?.({
        type: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setActiveNotificationId(null);
    }
  }

  function renderNotificationList(maxHeightClassName: string) {
    if (loadError) {
      return (
        <div className={cn("px-1 py-4 text-sm text-danger", compact && "mobile-card p-4")}>
          {loadError}
        </div>
      );
    }

    if (notifications.length === 0) {
      return (
        <div
          className={cn(
            "px-1 py-4 text-sm text-secondary-foreground",
            compact && "mobile-card flex min-h-[12rem] flex-col items-center justify-center p-5 text-center",
          )}
        >
          {compact ? (
            <>
              <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-secondary-foreground">
                <Inbox className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold text-foreground">Inbox is clear</p>
              <p className="mt-1 max-w-[18rem] text-xs leading-5 text-secondary-foreground">
                Meeting requests will appear here when a friend tags you in a meeting block.
              </p>
            </>
          ) : (
            "Meeting requests will show up here when a friend tags you in a meeting block."
          )}
        </div>
      );
    }

    return (
      <div className={cn("space-y-2.5 overflow-y-auto soft-scrollbar", compact && "space-y-3", maxHeightClassName)}>
        {notifications.map((notification) => {
          const actorName = notification.actor?.fullName ?? "A DayStack user";
          const isPendingAction = activeNotificationId === notification.id;

          return (
            <section
              key={notification.id}
              className={cn(
                "rounded-[20px] border px-3.5 py-3 transition-[border-color,box-shadow,background-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
                compact &&
                  "relative overflow-hidden rounded-[24px] border-white/80 bg-white/94 p-3.5 shadow-[0_16px_36px_rgba(83,78,222,0.1)] backdrop-blur-xl",
                notification.readAt
                  ? "border-border/70 bg-white/82"
                  : compact
                    ? "border-cyan-200/80 bg-[linear-gradient(135deg,rgba(24,190,239,0.12),rgba(109,40,240,0.07)_42%,rgba(255,255,255,0.96)_78%)]"
                    : "border-cyan-200 bg-cyan-50/56",
              )}
            >
              {compact && !notification.readAt ? (
                <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-brand-gradient" />
              ) : null}
              <div className="flex items-start gap-3">
                {compact ? (
                  <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-[0_12px_24px_rgba(83,78,222,0.22)]">
                    <BellRing className="h-4 w-4" />
                  </span>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{actorName}</p>
                      <p className="mt-0.5 text-xs font-medium text-secondary-foreground">sent a meeting request</p>
                    </div>
                    <StatusChip label={getStatusLabel(notification.status)} tone={getStatusTone(notification.status)} />
                  </div>

                  <p className="mt-2 line-clamp-2 text-[15px] font-semibold leading-5 text-foreground">
                    {notification.taskTitle}
                  </p>

                  <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-secondary-foreground">
                    <Clock3 className="h-3.5 w-3.5" />
                    <span>
                      {formatDateLabel(notification.taskDate)} at {formatClockTime(notification.startTime)} to{" "}
                      {formatClockTime(notification.endTime)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap sm:items-center">
                {notification.status === "pending" ? (
                  <>
                    <Button
                      size="sm"
                      className={compact ? "h-11 w-full justify-center rounded-full text-sm sm:w-auto" : undefined}
                      onClick={() => handleAccept(notification.id)}
                      disabled={isPendingAction}
                    >
                      {isPendingAction ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className={compact ? "h-11 w-full justify-center rounded-full text-sm sm:w-auto" : undefined}
                      onClick={() => handleReject(notification.id)}
                      disabled={isPendingAction}
                    >
                      {isPendingAction ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      Reject
                    </Button>
                  </>
                ) : notification.acceptedTaskDate ? (
                  onOpenDay ? (
                    <button
                      suppressHydrationWarning
                      type="button"
                      className={buttonVariants({
                        variant: "secondary",
                        size: "sm",
                        className: compact ? "h-11 w-full justify-center rounded-full text-sm sm:w-auto" : undefined,
                      })}
                      onClick={() => {
                        if (mode === "button") {
                          setIsOpen(false);
                        }

                        onOpenDay(notification.acceptedTaskDate!);
                      }}
                    >
                      <CheckCheck className="h-4 w-4" />
                      Open day
                    </button>
                  ) : (
                    <Link
                      href={`/app?date=${notification.acceptedTaskDate}`}
                      className={buttonVariants({
                        variant: "secondary",
                        size: "sm",
                        className: compact ? "h-11 w-full justify-center rounded-full text-sm sm:w-auto" : undefined,
                      })}
                    >
                      <CheckCheck className="h-4 w-4" />
                      Open day
                    </Link>
                  )
                ) : null}

                {notification.meetingLink ? (
                  <a
                    href={notification.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({
                      variant: "ghost",
                      size: "sm",
                      className: cn("h-10 px-4", compact && "h-11 w-full justify-center rounded-full text-sm sm:w-auto"),
                    })}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Meeting link
                  </a>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  if (mode === "page") {
    if (compact) {
      return (
        <section className="space-y-3">
          <div className="relative overflow-hidden rounded-[26px] border border-white/80 bg-white/88 p-0 shadow-[0_18px_44px_rgba(83,78,222,0.13)] backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_90%_80%_at_20%_0%,rgba(24,190,239,0.22),transparent_62%),radial-gradient(ellipse_90%_80%_at_92%_4%,rgba(109,40,240,0.16),transparent_58%)]" />
            <div className="relative px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mobile-eyebrow">Inbox</p>
                  <h1 className="mt-1 font-display text-xl font-semibold tracking-tight text-foreground">
                    Meeting requests
                  </h1>
                  <p className="mt-1 text-xs leading-5 text-secondary-foreground">
                    Accept adds the block. Reject dismisses it.
                  </p>
                </div>
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-[0_14px_28px_rgba(83,78,222,0.2)]">
                  <Inbox className="h-5 w-5" />
                </span>
              </div>
            </div>
            <div className="relative mx-3 mb-3 grid grid-cols-3 overflow-hidden rounded-[20px] border border-white/80 bg-white/84 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <div className="px-3 py-3 text-center">
                <p className="gradient-text text-base font-semibold">{notifications.length}</p>
                <p className="text-[11px] font-medium text-secondary-foreground">Total</p>
              </div>
              <div className="border-x border-border/60 px-3 py-3 text-center">
                <p className="gradient-text text-base font-semibold">{pendingCount}</p>
                <p className="text-[11px] font-medium text-secondary-foreground">Pending</p>
              </div>
              <div className="px-3 py-3 text-center">
                <p className="gradient-text text-base font-semibold">{unreadCount}</p>
                <p className="text-[11px] font-medium text-secondary-foreground">Unread</p>
              </div>
            </div>
          </div>

          {renderNotificationList("")}
        </section>
      );
    }

    return (
      <section className="glass-panel overflow-hidden p-4 sm:p-5">
        <div className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="section-label">Notifications</p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-foreground sm:text-[2rem]">
              Meeting approvals
            </h1>
            <p className="mt-1.5 text-sm text-secondary-foreground">
              Accept meeting requests into your timeline, or reject them without adding anything.
            </p>
          </div>
          {unreadCount > 0 ? <StatusChip label={`${unreadCount} unread`} tone="brand" /> : null}
        </div>

        <div className="mt-4">{renderNotificationList("max-h-[calc(100vh-16rem)]")}</div>
      </section>
    );
  }

  return (
    <div ref={panelRef} className="relative">
      <Button
        size="sm"
        variant="secondary"
        className="relative h-10 w-10 rounded-full px-0"
        onClick={() => {
          setIsOpen((current) => !current);

          if (!isOpen) {
            void loadNotifications({ silent: true });
          }
        }}
        aria-expanded={isOpen}
        aria-label="Open notifications"
      >
        {unreadCount > 0 ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand-gradient px-1.5 text-[10px] font-semibold text-white shadow-[var(--shadow-brand-sm)]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </Button>

      <div
        className={cn(
          "absolute right-0 top-[calc(100%+0.75rem)] z-40 w-[min(26rem,calc(100vw-2rem))] rounded-[24px] border border-white/75 bg-white/96 p-3 shadow-[0_28px_72px_rgba(15,23,42,0.16)] backdrop-blur-xl transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          isOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
        )}
      >
        <div className="flex flex-col gap-3 border-b border-border/70 px-1 pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="section-label">Notifications</p>
            <p className="mt-1 text-sm text-secondary-foreground">
              {notifications.length > 0 ? `${notifications.length} recent updates` : "No recent mentions yet."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 ? <StatusChip label={`${unreadCount} unread`} tone="brand" /> : null}
            {onOpenInbox ? (
              <button
                suppressHydrationWarning
                type="button"
                className={buttonVariants({ variant: "ghost", size: "sm", className: "h-9 px-3" })}
                onClick={() => {
                  setIsOpen(false);
                  onOpenInbox();
                }}
              >
                <Inbox className="h-4 w-4" />
                Inbox
              </button>
            ) : openInboxHref ? (
              <Link
                href={openInboxHref}
                className={buttonVariants({ variant: "ghost", size: "sm", className: "h-9 px-3" })}
              >
                <Inbox className="h-4 w-4" />
                Inbox
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-3">{renderNotificationList("max-h-[24rem]")}</div>
      </div>
    </div>
  );
}
