import { CalendarRange, Check, CheckCircle2, PencilLine, Play, Repeat, Trash2, Users, Video } from "lucide-react";

import { Button, buttonVariants } from "@/components/shared/button";
import { formatClockTime, formatParticipantNames, getTaskAnchorId, isBlockedTask } from "@/lib/daystack";
import { cn } from "@/lib/utils";
import type { PlannerTask, TaskVisualState } from "@/types/daystack";

interface TaskCardProps {
  focusedTaskId?: string | null;
  isSelected?: boolean;
  task: PlannerTask;
  visualState: TaskVisualState;
  isPending: boolean;
  onEdit: (task: PlannerTask) => void;
  onDelete: (task: PlannerTask) => void;
  onStartFocusTask: (task: PlannerTask) => void;
  onToggleSelection?: (taskId: string) => void;
  onToggle: (task: PlannerTask) => void;
  selectionMode?: boolean;
}

const stateStyles: Record<TaskVisualState, string> = {
  active: "border-cyan-200 bg-cyan-50/78 shadow-[0_14px_24px_rgba(24,190,239,0.12)]",
  completed: "border-emerald-200 bg-emerald-50/70 shadow-[0_12px_22px_rgba(34,197,94,0.08)]",
  upcoming: "border-indigo-200 bg-indigo-50/68 shadow-[0_12px_22px_rgba(99,102,241,0.06)]",
  pending: "border-border/80 bg-white/94 shadow-[0_12px_22px_rgba(15,23,42,0.05)]",
  overdue: "border-rose-200 bg-rose-50/76 shadow-[0_12px_22px_rgba(244,63,94,0.08)]",
};

const stateLabels: Record<TaskVisualState, string> = {
  active: "Active",
  completed: "Completed",
  upcoming: "Upcoming",
  pending: "Pending",
  overdue: "Overdue",
};

const blockedStateStyles: Record<TaskVisualState, string> = {
  active: "border-slate-300 bg-slate-200/82 shadow-[0_12px_22px_rgba(71,85,105,0.08)]",
  completed: "border-slate-300 bg-slate-100/86 shadow-[0_12px_22px_rgba(71,85,105,0.08)]",
  upcoming: "border-slate-300 bg-slate-100/86 shadow-[0_12px_22px_rgba(71,85,105,0.08)]",
  pending: "border-slate-300 bg-slate-100/92 shadow-[0_12px_22px_rgba(71,85,105,0.08)]",
  overdue: "border-slate-400 bg-slate-200/92 shadow-[0_12px_22px_rgba(71,85,105,0.08)]",
};

export function TaskCard({
  focusedTaskId,
  isPending,
  isSelected = false,
  onDelete,
  onEdit,
  onStartFocusTask,
  onToggle,
  onToggleSelection,
  selectionMode = false,
  task,
  visualState,
}: TaskCardProps) {
  const isMeeting = task.task_type === "meeting";
  const isBlocked = isBlockedTask(task);
  const hasPrimaryActions = Boolean((isMeeting && task.meeting_link) || !isBlocked);

  return (
    <div
      id={getTaskAnchorId(task.id)}
      className={cn(
        "rounded-[26px] border px-4 py-4 transition-[transform,box-shadow,border-color,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 active:scale-[0.995] sm:px-4",
        isBlocked ? blockedStateStyles[visualState] : stateStyles[visualState],
        selectionMode && isSelected && "border-primary/35 ring-2 ring-primary/25 ring-offset-2 ring-offset-background",
        focusedTaskId === task.id && "ring-2 ring-primary/35 ring-offset-2 ring-offset-background",
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/70">
              {isBlocked ? "Blocked" : stateLabels[visualState]}
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
              {isMeeting ? (
                <Video className="h-3.5 w-3.5 text-primary" />
              ) : (
                <CalendarRange className={cn("h-3.5 w-3.5", isBlocked ? "text-slate-500" : "text-secondary-foreground")} />
              )}
              {formatClockTime(task.start_time)} to {formatClockTime(task.end_time)}
            </p>
          </div>

          {selectionMode ? (
            <Button
              size="sm"
              variant={isSelected ? "primary" : "secondary"}
              className="h-10 shrink-0 px-3"
              onClick={(event) => {
                event.stopPropagation();
                onToggleSelection?.(task.id);
              }}
              disabled={isPending}
              aria-label={`${isSelected ? "Unselect" : "Select"} ${task.title}`}
              aria-pressed={isSelected}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded border",
                  isSelected ? "border-white/70 bg-white/12" : "border-border/80 bg-white/72",
                )}
              >
                {isSelected ? <Check className="h-3 w-3" /> : null}
              </span>
              {isSelected ? "Selected" : "Select"}
            </Button>
          ) : null}
        </div>

        <button
          suppressHydrationWarning
          type="button"
          className="min-w-0 text-left focus:outline-none"
          onClick={() => onEdit(task)}
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold tracking-tight text-foreground">{task.title}</p>
            {isMeeting ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-[linear-gradient(135deg,rgba(24,190,239,0.14),rgba(109,40,240,0.08))] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                <Video className="h-3 w-3" />
                Meeting
              </span>
            ) : isBlocked ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-200/82 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                Blocked
              </span>
            ) : null}
            {task.recurring_rule_id ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                <Repeat className="h-3 w-3" />
                Recurring
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary-foreground">
            <span>Tap to edit.</span>
            {task.recurring_rule_id ? (
              <span>Part of a repeating weekly schedule.</span>
            ) : null}
            {isMeeting && task.participants.length > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {formatParticipantNames(task.participants, 3)}
              </span>
            ) : null}
          </div>
        </button>

        <div className={cn("gap-2", hasPrimaryActions ? "flex items-start" : "flex justify-end")}>
          {hasPrimaryActions ? (
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
              {isMeeting && task.meeting_link ? (
                <a
                  href={task.meeting_link}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({
                    variant: "ghost",
                    size: "sm",
                    className: "col-span-2 h-11 justify-center px-4",
                  })}
                >
                  <Video className="h-4 w-4" />
                  Join meeting
                </a>
              ) : null}
              {!isBlocked ? (
                <Button
                  size="sm"
                  className="h-11 w-full justify-center"
                  variant={task.status === "completed" ? "secondary" : "primary"}
                  onClick={() => onToggle(task)}
                  disabled={isPending}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {task.status === "completed" ? "Undo" : "Done"}
                </Button>
              ) : null}
              {!isBlocked ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-11 w-full justify-center"
                  onClick={() => onStartFocusTask(task)}
                  disabled={isPending || task.status === "completed"}
                >
                  <Play className="h-4 w-4" />
                  Focus
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className={cn("shrink-0 gap-2", hasPrimaryActions ? "flex flex-col" : "flex")}>
            <Button
              size="sm"
              variant="secondary"
              className="h-11 w-11 px-0"
              onClick={() => onEdit(task)}
              disabled={isPending}
              aria-label={`Edit ${task.title}`}
            >
              <PencilLine className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="danger"
              className="h-11 w-11 px-0"
              onClick={() => onDelete(task)}
              disabled={isPending}
              aria-label={`Delete ${task.title}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
