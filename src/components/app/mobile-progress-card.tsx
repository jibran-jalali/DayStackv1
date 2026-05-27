"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarRange, Check, Sparkles, Video } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatClockTime } from "@/lib/daystack";
import { playUiActionSound } from "@/lib/ui-feedback";
import type { DashboardSummary, PlannerDateMode, PlannerTask } from "@/types/daystack";

interface MobileProgressCardProps {
  completionRate: number;
  dateMode: PlannerDateMode;
  isPending?: boolean;
  onSelectMode?: () => void;
  showSelectButton?: boolean;
  streak: number;
  summary: DashboardSummary;
  taskCount: number;
  nextTask?: PlannerTask | null;
  onCompleteTask?: (task: PlannerTask) => void;
  onAddTask?: () => void;
}

function ProgressRing({ value }: { value: number }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="mobile-progress-ring" aria-hidden>
      <svg className="mobile-progress-ring__svg" viewBox="0 0 72 72">
        <defs>
          <linearGradient id="mobile-progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#18beef" />
            <stop offset="48%" stopColor="#6d28f0" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <circle className="mobile-progress-ring__track" cx="36" cy="36" r={radius} />
        <circle
          className="mobile-progress-ring__value"
          cx="36"
          cy="36"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="mobile-progress-ring__label">{value}%</span>
    </div>
  );
}

export function MobileProgressCard({
  completionRate,
  dateMode,
  isPending,
  onSelectMode,
  showSelectButton,
  streak,
  summary,
  taskCount,
  nextTask,
  onCompleteTask,
  onAddTask,
}: MobileProgressCardProps) {
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const completionTimerRef = useRef<number | null>(null);
  const isCompletingNextBlock = Boolean(completingTaskId);

  useEffect(() => {
    if (!nextTask || nextTask.id !== completingTaskId) {
      if (completingTaskId && typeof window !== "undefined") {
        window.navigator.vibrate?.([10, 22, 10]);
      }

      setCompletingTaskId(null);
    }
  }, [completingTaskId, nextTask]);

  useEffect(() => {
    return () => {
      if (completionTimerRef.current !== null) {
        window.clearTimeout(completionTimerRef.current);
      }
    };
  }, []);

  function playCompletionFeedback() {
    if (typeof window !== "undefined" && "navigator" in window) {
      window.navigator.vibrate?.([16, 28, 18, 40, 26]);
    }

    void playUiActionSound("complete").catch(() => {
      return;
    });
  }

  function handleCompleteNextTask(task: PlannerTask) {
    if (isPending || task.status === "completed" || completingTaskId) {
      return;
    }

    setCompletingTaskId(task.id);
    playCompletionFeedback();
    completionTimerRef.current = window.setTimeout(() => {
      onCompleteTask?.(task);
      completionTimerRef.current = null;
    }, 340);
  }

  return (
    <section className={cn("mobile-hero-card mobile-stagger-1", isCompletingNextBlock && "mobile-hero-card--handoff")}>
      <div className="mobile-hero-card__glow" aria-hidden />
      <div className="mobile-hero-card__accent" aria-hidden />

      <div className="relative flex items-center justify-between gap-3">
        <p className="text-sm font-bold tracking-tight text-foreground">Activity Ring</p>
        {showSelectButton && onSelectMode ? (
          <button type="button" className="mobile-card-icon-btn" onClick={onSelectMode} disabled={isPending}>
            Select
          </button>
        ) : null}
      </div>

      <div className="relative mt-4 flex items-center gap-4">
        <ProgressRing value={completionRate} />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Move</p>
          <p className="mt-0.5 text-lg font-black tracking-tight text-primary">
            {dateMode === "future" ? summary.totalTasks : summary.completedTasks}
            <span className="text-sm font-black">/{summary.totalTasks || 0} BLOCKS</span>
          </p>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-secondary-foreground">{summary.summaryLine}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="mobile-stat-pill text-left">
          <p className="mobile-stat-pill__label">{dateMode === "future" ? "Planned" : "Done"}</p>
          <p className="mobile-stat-pill__value">
            {dateMode === "future" ? summary.totalTasks : `${summary.completedTasks}/${summary.totalTasks || 0}`}
          </p>
        </div>
        <div className="mobile-stat-pill text-left">
          <p className="mobile-stat-pill__label">{streak > 0 ? "Streak" : "Blocks"}</p>
          <p className="mobile-stat-pill__value">{streak > 0 ? `${streak}D` : taskCount}</p>
        </div>
      </div>

      <div className="my-4 border-t border-border/50" />

      <div className="mt-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-secondary-foreground/60">
          <Sparkles className="h-3 w-3 text-primary animate-pulse" />
          <span>Next Block</span>
        </div>
        {nextTask ? (
          <div
            key={nextTask.id}
            aria-live="polite"
            className={cn(
              "mobile-next-block-row mt-2 flex items-center justify-between gap-3",
              completingTaskId === nextTask.id && "mobile-next-block-row--complete",
            )}
          >
            <div className="min-w-0">
              <p className="line-clamp-2 pr-1 font-display text-sm font-semibold leading-5 text-foreground">
                {nextTask.title}
              </p>
              <p className="mt-0.5 text-xs text-secondary-foreground flex items-center gap-1">
                {nextTask.task_type === "meeting" ? (
                  <Video className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <CalendarRange className="h-3.5 w-3.5" />
                )}
                {formatClockTime(nextTask.start_time)} - {formatClockTime(nextTask.end_time)}
              </p>
            </div>
            <button
              type="button"
              className={cn(
                "mobile-complete-tick shrink-0",
                completingTaskId === nextTask.id && "mobile-complete-tick--active",
              )}
              onClick={() => handleCompleteNextTask(nextTask)}
              disabled={isPending || nextTask.status === "completed" || completingTaskId === nextTask.id}
              aria-label={`Mark ${nextTask.title} complete`}
            >
              <span className="mobile-complete-tick__burst" aria-hidden />
              <Check className="relative z-10 h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-secondary-foreground italic">Nothing queued next.</p>
            {onAddTask ? (
              <button
                type="button"
                className="mobile-text-btn"
                onClick={onAddTask}
                disabled={isPending}
              >
                Add Block
              </button>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
