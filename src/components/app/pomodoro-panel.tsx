"use client";

import Link from "next/link";
import {
  Clock3,
  ExternalLink,
  Link2Off,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  SquareArrowOutUpRight,
  X,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/shared/button";
import { StatusChip } from "@/components/shared/status-chip";
import { cn } from "@/lib/utils";
import type { PomodoroLinkedTask, PomodoroState } from "@/lib/pomodoro";

interface PomodoroPanelProps {
  formattedRemaining: string;
  onOpenWindow?: () => void;
  onPause: () => void;
  onReset: () => void;
  onResume: () => void;
  onSkipBreak: () => void;
  onStart: () => void;
  onUnlinkTask: () => void;
  state: PomodoroState;
  variant?: "page" | "window";
}

function getPrimaryButtonLabel(state: PomodoroState) {
  if (state.status === "running") {
    return "Pause";
  }

  if (state.status === "paused") {
    return "Resume";
  }

  return state.mode === "task-linked" ? "Start focus" : "Start timer";
}

function getPhaseLine(state: PomodoroState) {
  if (state.phase === "break") {
    return state.status === "running" ? "Break is live." : "Break is ready.";
  }

  if (state.mode === "task-linked" && state.linkedTask) {
    return "Focus on the linked block.";
  }

  return "Standalone focus round.";
}

function getTaskLine(linkedTask: PomodoroLinkedTask | null) {
  if (!linkedTask) {
    return "No task linked. Start from any block to attach this timer.";
  }

  return linkedTask.title;
}

export function PomodoroPanel({
  formattedRemaining,
  onOpenWindow,
  onPause,
  onReset,
  onResume,
  onSkipBreak,
  onStart,
  onUnlinkTask,
  state,
  variant = "page",
}: PomodoroPanelProps) {
  const isRunning = state.status === "running";
  const isBreak = state.phase === "break";
  const primaryButtonLabel = getPrimaryButtonLabel(state);
  const openAppHref = state.linkedTask ? `/app/pomodoro?date=${state.linkedTask.taskDate}` : "/app/pomodoro";

  if (variant === "window") {
    return (
      <section className="group relative mx-auto flex min-h-[11.5rem] w-full max-w-[20rem] flex-col justify-between overflow-hidden rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,248,255,0.9))] px-3 py-3 shadow-[0_18px_38px_rgba(15,23,42,0.18)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-[linear-gradient(180deg,rgba(24,190,239,0.12),transparent)]" />

        <div className="absolute inset-x-3 top-3 z-10 flex items-center justify-between gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
          <span className="rounded-full bg-white/82 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground shadow-[0_6px_18px_rgba(15,23,42,0.08)]">
            {isBreak ? "Break" : "Focus"}
          </span>
          <div className="flex items-center gap-1">
            <Link
              href={openAppHref}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "h-8 w-8 rounded-full border border-white/70 bg-white/82 px-0 text-secondary-foreground shadow-[0_6px_18px_rgba(15,23,42,0.08)] hover:bg-white",
              )}
              aria-label="Open Pomodoro page"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <button
              suppressHydrationWarning
              type="button"
              onClick={() => window.close()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/82 text-secondary-foreground shadow-[0_6px_18px_rgba(15,23,42,0.08)] transition-[background-color,color] duration-150 hover:bg-white hover:text-foreground focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]"
              aria-label="Close timer window"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center px-2 pt-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary-foreground/72">
            {state.phase === "break" ? "Break round" : state.mode === "task-linked" ? "Task focus" : "Focus round"}
          </p>
          <p className="mt-2 font-display text-[3.45rem] font-semibold leading-none tracking-[-0.05em] text-foreground sm:text-[3.7rem]">
            {formattedRemaining}
          </p>
          <p className="mt-2 line-clamp-1 min-h-[1.25rem] max-w-full text-xs font-medium text-secondary-foreground">
            {state.linkedTask ? state.linkedTask.title : "Standalone timer"}
          </p>
          <p className="mt-1 text-[11px] text-secondary-foreground/78">
            {state.completedWorkSessions} cycle{state.completedWorkSessions === 1 ? "" : "s"}
          </p>
        </div>

        <div className="relative flex items-center justify-center gap-2">
          {isRunning ? (
            <Button size="sm" className="min-w-[7.25rem]" onClick={onPause}>
              <Pause className="h-4 w-4" />
              {primaryButtonLabel}
            </Button>
          ) : state.status === "paused" ? (
            <Button size="sm" className="min-w-[7.25rem]" onClick={onResume}>
              <Play className="h-4 w-4" />
              {primaryButtonLabel}
            </Button>
          ) : (
            <Button size="sm" className="min-w-[7.25rem]" onClick={onStart}>
              <Play className="h-4 w-4" />
              {primaryButtonLabel}
            </Button>
          )}

          <Button size="sm" variant="secondary" className="h-10 w-10 px-0" onClick={onReset} aria-label="Reset timer">
            <RotateCcw className="h-4 w-4" />
          </Button>

          {isBreak ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-10 w-10 px-0"
              onClick={onSkipBreak}
              aria-label="Skip break"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "glass-panel overflow-hidden border-white/75",
        "mx-auto w-full max-w-2xl p-4 sm:p-5",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(24,190,239,0.08),transparent)]" />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="section-label">Pomodoro</p>
            <p className="mt-1 font-display text-[2.4rem] font-semibold tracking-tight text-foreground sm:text-[2.8rem]">
              {formattedRemaining}
            </p>
            <p className="mt-1 text-sm text-secondary-foreground">{getPhaseLine(state)}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusChip label={isBreak ? "Break" : "Focus"} tone={isBreak ? "success" : "brand"} icon={Clock3} />
            <StatusChip
              label={`${state.completedWorkSessions} cycle${state.completedWorkSessions === 1 ? "" : "s"}`}
              tone="default"
            />
          </div>
        </div>

        <div className="mt-4 rounded-[20px] border border-border/80 bg-white/88 px-3.5 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.04)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/70">
            {state.mode === "task-linked" ? "Linked task" : "Mode"}
          </p>
          <div className="mt-2 flex items-start justify-between gap-3">
            <p className="min-w-0 text-sm font-semibold text-foreground">{getTaskLine(state.linkedTask)}</p>
            {state.linkedTask ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 shrink-0 rounded-full px-3"
                onClick={onUnlinkTask}
              >
                <Link2Off className="h-4 w-4" />
                Unlink
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {isRunning ? (
            <Button size="sm" className="min-w-[8rem]" onClick={onPause}>
              <Pause className="h-4 w-4" />
              {primaryButtonLabel}
            </Button>
          ) : state.status === "paused" ? (
            <Button size="sm" className="min-w-[8rem]" onClick={onResume}>
              <Play className="h-4 w-4" />
              {primaryButtonLabel}
            </Button>
          ) : (
            <Button size="sm" className="min-w-[8rem]" onClick={onStart}>
              <Play className="h-4 w-4" />
              {primaryButtonLabel}
            </Button>
          )}

          <Button size="sm" variant="secondary" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>

          {isBreak ? (
            <Button size="sm" variant="ghost" onClick={onSkipBreak}>
              <SkipForward className="h-4 w-4" />
              Skip break
            </Button>
          ) : null}

          {onOpenWindow ? (
            <Button size="sm" variant="ghost" onClick={onOpenWindow}>
              <SquareArrowOutUpRight className="h-4 w-4" />
              Pop out
            </Button>
          ) : null}
        </div>

        <p className="mt-4 text-xs text-secondary-foreground">
          The pop-out window mirrors this timer and stays synced with the Pomodoro page in real time.
        </p>
      </div>
    </section>
  );
}
