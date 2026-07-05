"use client";

import { CalendarDays, CheckCheck } from "lucide-react";

import { NotificationCenter } from "@/components/app/notification-center";
import { buttonVariants } from "@/components/shared/button";
import { formatDateLabel } from "@/lib/daystack";
import type { PlannerNotification, TaskNotificationAcceptResult } from "@/types/daystack";

interface WorkspaceNotificationsContentProps {
  compact?: boolean;
  displayName: string;
  email?: string;
  initialNotifications: PlannerNotification[];
  isActive: boolean;
  onNotice: (notice: { message: string; type: "error" | "success" }) => void;
  onOpenPlanner: () => void;
  onOpenTaskDay: (taskDate: string) => void;
  onTaskAccepted: (result: TaskNotificationAcceptResult) => Promise<void> | void;
  selectedDate?: string;
}

export function WorkspaceNotificationsContent({
  compact = false,
  displayName,
  email,
  initialNotifications,
  isActive,
  onNotice,
  onOpenPlanner,
  onOpenTaskDay,
  onTaskAccepted,
  selectedDate,
}: WorkspaceNotificationsContentProps) {
  if (compact) {
    return (
      <div className="space-y-2.5">
        <NotificationCenter
          compact
          initialNotifications={initialNotifications}
          isActive={isActive}
          limit={40}
          mode="page"
          onNotice={onNotice}
          onOpenDay={onOpenTaskDay}
          onTaskAccepted={onTaskAccepted}
        />

        <section className="mobile-card p-3">
          <div className="flex items-start gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(24,190,239,0.12),rgba(109,40,240,0.1))] text-primary">
              <CheckCheck className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Meeting approvals</p>
              <p className="mt-0.5 text-xs text-secondary-foreground">Accept adds the block. Reject dismisses it.</p>
              <div className="mt-2 grid gap-1.5">
                {selectedDate ? (
                  <div className="rounded-full border border-border/80 bg-muted/35 px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground">
                    Return day: <span className="text-foreground">{formatDateLabel(selectedDate)}</span>
                  </div>
                ) : null}
                <button
                  type="button"
                  className={buttonVariants({ variant: "secondary", size: "sm", className: "h-9 w-full text-xs" })}
                  onClick={onOpenPlanner}
                >
                  <CalendarDays className="h-4 w-4" />
                  Back to plan
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <NotificationCenter
        initialNotifications={initialNotifications}
        isActive={isActive}
        limit={40}
        mode="page"
        onNotice={onNotice}
        onOpenDay={onOpenTaskDay}
        onTaskAccepted={onTaskAccepted}
      />

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <section className="rounded-[22px] border border-border/70 bg-white/82 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <p className="section-label">Plan</p>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{displayName}</p>
              <p className="text-sm text-secondary-foreground">{email ?? "DayStack user"}</p>
            </div>
            {selectedDate ? (
              <div className="rounded-[18px] border border-border/70 bg-muted/35 px-3 py-2.5 text-sm text-secondary-foreground">
                Return day: <span className="font-medium text-foreground">{formatDateLabel(selectedDate)}</span>
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
          </div>
        </section>

        <section className="rounded-[22px] border border-border/70 bg-white/82 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-cyan-50 text-sky-700">
              <CheckCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Approval adds the block immediately</p>
              <p className="mt-1 text-sm text-secondary-foreground">
                Accept adds the meeting block to your schedule. Reject only dismisses it for you.
              </p>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}
