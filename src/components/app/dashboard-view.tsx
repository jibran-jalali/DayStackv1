"use client";

import { memo, type ReactNode } from "react";
import { ArrowRight, CalendarRange, Flame, Gauge, Sparkles, Video } from "lucide-react";

import { Button, buttonVariants } from "@/components/shared/button";
import { StatusChip } from "@/components/shared/status-chip";
import { formatClockTime, getTaskWindow } from "@/lib/daystack";
import { cn } from "@/lib/utils";
import type { DashboardSummary, PlannerDateMode, PlannerTask } from "@/types/daystack";

interface DashboardViewProps {
  dateLabel: string;
  dateMode: PlannerDateMode;
  isPending: boolean;
  now: Date;
  onAddTask: () => void;
  onEditTask: (task: PlannerTask) => void;
  streak: number;
  summary: DashboardSummary;
  taskDate: string;
  tasks: PlannerTask[];
}

function DashboardCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[18px] border border-border/75 bg-white/84 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] sm:rounded-[24px] sm:p-6 sm:shadow-[0_16px_34px_rgba(15,23,42,0.05)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

function SectionLabel({
  icon: Icon,
  title,
}: {
  icon: typeof Gauge;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-secondary-foreground sm:h-8 sm:w-8">
        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </span>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/70">{title}</p>
    </div>
  );
}

function getProgressLine(summary: DashboardSummary, dateMode: PlannerDateMode) {
  if (summary.totalTasks === 0) {
    return dateMode === "future" ? "No blocks are planned for this day yet." : "No tasks planned yet.";
  }

  if (dateMode === "future") {
    return `${summary.totalTasks} task${summary.totalTasks === 1 ? "" : "s"} planned for this day.`;
  }

  if (summary.successfulDay) {
    return "The day is moving in the right direction.";
  }

  if (summary.incompleteTasks === 1) {
    return "One task left to turn the day.";
  }

  return `${summary.incompleteTasks} task${summary.incompleteTasks === 1 ? "" : "s"} still open.`;
}

function getStreakLine(streak: number, dateMode: PlannerDateMode) {
  if (streak === 0) {
    return dateMode === "future" ? "A strong day starts the chain." : "A strong finish today starts the chain.";
  }

  if (dateMode === "future") {
    return "Keep planning around the streak, not around urgency.";
  }

  return "Clear the 70% line to keep the chain intact.";
}

function DashboardViewComponent({
  dateLabel,
  dateMode,
  isPending,
  now,
  onAddTask,
  onEditTask,
  streak,
  summary,
  taskDate,
  tasks,
}: DashboardViewProps) {
  const { nextTask } = getTaskWindow(tasks, now, taskDate);
  const progressLine = getProgressLine(summary, dateMode);
  const streakLine = getStreakLine(streak, dateMode);

  return (
    <div className="mx-auto max-w-6xl space-y-3 sm:space-y-5">
      <div className="grid gap-3 sm:gap-5 xl:grid-cols-[1.25fr_0.82fr]">
        <DashboardCard className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(24,190,239,0.08),transparent)]" />
          <SectionLabel icon={Gauge} title="Today Progress" />
          <div className="relative mt-3 sm:mt-5">
            <p className="text-sm font-medium text-secondary-foreground">{dateLabel}</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3 sm:mt-3 sm:gap-4">
              <div>
                <p className="font-display text-4xl font-semibold text-foreground sm:text-[3.5rem]">
                  {summary.completionRate}%
                </p>
                <p className="mt-1 text-sm font-medium text-foreground sm:mt-2 sm:text-base">
                  {summary.completedTasks} of {summary.totalTasks || 0} completed
                </p>
              </div>
              <StatusChip
                label={`${summary.incompleteTasks} left`}
                tone={summary.incompleteTasks === 0 ? "success" : "default"}
              />
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted sm:mt-5 sm:h-3">
              <div
                className="h-full rounded-full bg-brand-gradient transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ width: `${summary.completionRate}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-secondary-foreground sm:mt-4 sm:text-sm">{progressLine}</p>
          </div>
        </DashboardCard>

        <DashboardCard className="flex min-h-[12rem] flex-col justify-between sm:min-h-[18rem]">
          <div>
            <SectionLabel icon={Flame} title="Current Streak" />
            <div className="mt-3 flex items-end justify-between gap-3 sm:mt-5 sm:gap-4">
              <div>
                <p className="font-display text-4xl font-semibold text-foreground sm:text-[3.5rem]">{streak}</p>
                <p className="mt-1 text-sm font-medium text-foreground sm:mt-2 sm:text-base">
                  {streak === 1 ? "day active" : "days active"}
                </p>
              </div>
              <StatusChip
                label={streak > 0 ? "Live streak" : "Start today"}
                tone={streak > 0 ? "success" : "default"}
              />
            </div>
          </div>
          <p className="mt-4 text-xs text-secondary-foreground sm:mt-6 sm:text-sm">{streakLine}</p>
        </DashboardCard>
      </div>

      <DashboardCard className="min-h-[13rem] sm:min-h-[17rem]">
        <SectionLabel icon={Sparkles} title="Next Task" />
        {nextTask ? (
          <div className="mt-3 flex h-full flex-col justify-between gap-4 sm:mt-5 sm:gap-6 lg:flex-row lg:items-end">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-display text-2xl font-semibold text-foreground sm:text-[2.4rem]">
                  {nextTask.title}
                </p>
                <StatusChip
                  label={nextTask.task_type === "meeting" ? "Meeting" : "Task"}
                  tone={nextTask.task_type === "meeting" ? "brand" : "default"}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary-foreground sm:mt-4 sm:gap-x-4 sm:gap-y-2 sm:text-sm">
                <span className="inline-flex items-center gap-1.5">
                  {nextTask.task_type === "meeting" ? (
                    <Video className="h-4 w-4 text-primary" />
                  ) : (
                    <CalendarRange className="h-4 w-4" />
                  )}
                  {formatClockTime(nextTask.start_time)} to {formatClockTime(nextTask.end_time)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => onEditTask(nextTask)} disabled={isPending}>
                <ArrowRight className="h-4 w-4" />
                Open block
              </Button>
              {nextTask.task_type === "meeting" && nextTask.meeting_link ? (
                <a
                  href={nextTask.meeting_link}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "ghost", size: "sm", className: "h-10 px-4" })}
                >
                  <Video className="h-4 w-4" />
                  Join
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-[16px] border border-dashed border-border/80 bg-muted/35 px-4 py-5 sm:mt-5 sm:rounded-[20px] sm:px-5 sm:py-8">
            <p className="text-base font-semibold text-foreground sm:text-lg">Nothing is queued next.</p>
            <p className="mt-1.5 max-w-2xl text-xs text-secondary-foreground sm:mt-2 sm:text-sm">
              Add one clear block so the next move is obvious the moment you come back.
            </p>
            <Button size="sm" className="mt-4" onClick={onAddTask} disabled={isPending}>
              <CalendarRange className="h-4 w-4" />
              Add the next block
            </Button>
          </div>
        )}
      </DashboardCard>
    </div>
  );
}

function areDashboardViewPropsEqual(left: DashboardViewProps, right: DashboardViewProps) {
  return (
    left.dateLabel === right.dateLabel &&
    left.dateMode === right.dateMode &&
    left.isPending === right.isPending &&
    left.now.getTime() === right.now.getTime() &&
    left.streak === right.streak &&
    left.summary === right.summary &&
    left.taskDate === right.taskDate &&
    left.tasks === right.tasks
  );
}

export const DashboardView = memo(DashboardViewComponent, areDashboardViewPropsEqual);
