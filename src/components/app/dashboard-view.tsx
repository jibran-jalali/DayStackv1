"use client";

import type { ReactNode } from "react";
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
        "rounded-[24px] border border-border/75 bg-white/84 p-5 shadow-[0_16px_34px_rgba(15,23,42,0.05)] sm:p-6",
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
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-secondary-foreground">
        <Icon className="h-4 w-4" />
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

export function DashboardView({
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
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.82fr]">
        <DashboardCard className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(24,190,239,0.08),transparent)]" />
          <SectionLabel icon={Gauge} title="Today Progress" />
          <div className="relative mt-5">
            <p className="text-sm font-medium text-secondary-foreground">{dateLabel}</p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-display text-5xl font-semibold text-foreground sm:text-[3.5rem]">
                  {summary.completionRate}%
                </p>
                <p className="mt-2 text-base font-medium text-foreground">
                  {summary.completedTasks} of {summary.totalTasks || 0} completed
                </p>
              </div>
              <StatusChip
                label={`${summary.incompleteTasks} left`}
                tone={summary.incompleteTasks === 0 ? "success" : "default"}
              />
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand-gradient transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ width: `${summary.completionRate}%` }}
              />
            </div>
            <p className="mt-4 text-sm text-secondary-foreground">{progressLine}</p>
          </div>
        </DashboardCard>

        <DashboardCard className="flex min-h-[18rem] flex-col justify-between">
          <div>
            <SectionLabel icon={Flame} title="Current Streak" />
            <div className="mt-5 flex items-end justify-between gap-4">
              <div>
                <p className="font-display text-5xl font-semibold text-foreground sm:text-[3.5rem]">{streak}</p>
                <p className="mt-2 text-base font-medium text-foreground">
                  {streak === 1 ? "day active" : "days active"}
                </p>
              </div>
              <StatusChip
                label={streak > 0 ? "Live streak" : "Start today"}
                tone={streak > 0 ? "success" : "default"}
              />
            </div>
          </div>
          <p className="mt-6 text-sm text-secondary-foreground">{streakLine}</p>
        </DashboardCard>
      </div>

      <DashboardCard className="min-h-[17rem]">
        <SectionLabel icon={Sparkles} title="Next Task" />
        {nextTask ? (
          <div className="mt-5 flex h-full flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-display text-3xl font-semibold text-foreground sm:text-[2.4rem]">
                  {nextTask.title}
                </p>
                <StatusChip
                  label={nextTask.task_type === "meeting" ? "Meeting" : "Task"}
                  tone={nextTask.task_type === "meeting" ? "brand" : "default"}
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-secondary-foreground">
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
          <div className="mt-5 rounded-[20px] border border-dashed border-border/80 bg-muted/35 px-5 py-8">
            <p className="text-lg font-semibold text-foreground">Nothing is queued next.</p>
            <p className="mt-2 max-w-2xl text-sm text-secondary-foreground">
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
