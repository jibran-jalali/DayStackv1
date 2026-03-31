import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange, CheckCircle2, GripVertical, Play, Plus, Repeat, Users, Video } from "lucide-react";

import { Button } from "@/components/shared/button";
import {
  formatClockTime,
  formatDateKey,
  formatParticipantNames,
  getTaskAnchorId,
  getTimelineTaskLayouts,
  isBlockedTask,
  minutesToTime,
  toMinutes,
} from "@/lib/daystack";
import { cn } from "@/lib/utils";
import type { PlannerTask, TaskVisualState } from "@/types/daystack";

interface TimelineGridProps {
  focusedTaskId?: string | null;
  isPending: boolean;
  now: Date;
  onAddTask: (startTime?: string) => void;
  onEditTask: (task: PlannerTask) => void;
  onRescheduleTask: (task: PlannerTask, nextStartTime: string, nextEndTime: string) => void;
  onStartFocusTask: (task: PlannerTask) => void;
  onToggleTask: (task: PlannerTask) => void;
  resolveVisualState: (task: PlannerTask) => TaskVisualState;
  taskDate: string;
  tasks: PlannerTask[];
}

const TIMELINE_INTERVAL = 15;
const SLOT_HEIGHT = 24;
const SHORT_BLOCK_MIN_HEIGHT = 32;
const DEFAULT_START_MINUTES = 6 * 60;
const DEFAULT_END_MINUTES = 22 * 60;
const OVERLAP_GAP = 6;

const blockStyles: Record<TaskVisualState, string> = {
  active: "border-cyan-200 bg-cyan-50/95 shadow-[0_18px_32px_rgba(24,190,239,0.14)]",
  completed: "border-emerald-200/90 bg-emerald-50/78 shadow-[0_12px_24px_rgba(34,197,94,0.08)]",
  upcoming: "border-indigo-200 bg-indigo-50/85 shadow-[0_14px_26px_rgba(99,102,241,0.08)]",
  pending: "border-border/80 bg-white/98 shadow-[0_14px_28px_rgba(15,23,42,0.06)]",
  overdue: "border-rose-200 bg-rose-50/88 shadow-[0_14px_24px_rgba(244,63,94,0.08)]",
};

const blockTextStyles: Record<TaskVisualState, string> = {
  active: "text-sky-800",
  completed: "text-emerald-900/80",
  upcoming: "text-indigo-800",
  pending: "text-foreground",
  overdue: "text-rose-800",
};

const accentStyles: Record<TaskVisualState, string> = {
  active: "bg-primary",
  completed: "bg-emerald-400/70",
  upcoming: "bg-indigo-400",
  pending: "bg-slate-300",
  overdue: "bg-rose-400",
};

const blockedBlockStyles: Record<TaskVisualState, string> = {
  active: "border-slate-300 bg-slate-200/90 shadow-[0_14px_24px_rgba(71,85,105,0.1)]",
  completed: "border-slate-300 bg-slate-100/92 shadow-[0_12px_22px_rgba(71,85,105,0.08)]",
  upcoming: "border-slate-300 bg-slate-100/92 shadow-[0_12px_22px_rgba(71,85,105,0.08)]",
  pending: "border-slate-300 bg-slate-100/94 shadow-[0_12px_22px_rgba(71,85,105,0.08)]",
  overdue: "border-slate-400 bg-slate-200/92 shadow-[0_12px_22px_rgba(71,85,105,0.1)]",
};

const blockedTextStyles: Record<TaskVisualState, string> = {
  active: "text-slate-800",
  completed: "text-slate-700",
  upcoming: "text-slate-800",
  pending: "text-slate-800",
  overdue: "text-slate-900",
};

const blockedAccentStyles: Record<TaskVisualState, string> = {
  active: "bg-slate-500",
  completed: "bg-slate-400",
  upcoming: "bg-slate-400",
  pending: "bg-slate-400",
  overdue: "bg-slate-600",
};

const stateLabels: Record<TaskVisualState, string> = {
  active: "Active",
  completed: "Done",
  upcoming: "Next",
  pending: "Pending",
  overdue: "Overdue",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatTimelineLabel(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  const displayHours = hours % 12 || 12;
  const suffix = hours >= 12 ? "PM" : "AM";

  if (minutes % 30 !== 0) {
    return "";
  }

  return minutes === 0 ? `${displayHours} ${suffix}` : `${displayHours}:30`;
}

function getTimelineBounds(tasks: PlannerTask[], now: Date, taskDate: string) {
  const todayMatches = formatDateKey(now) === taskDate;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const taskStarts = tasks.map((task) => toMinutes(task.start_time));
  const taskEnds = tasks.map((task) => toMinutes(task.end_time));

  const startCandidates = [DEFAULT_START_MINUTES];
  const endCandidates = [DEFAULT_END_MINUTES];

  if (taskStarts.length > 0) {
    startCandidates.push(Math.min(...taskStarts) - 60);
  }

  if (taskEnds.length > 0) {
    endCandidates.push(Math.max(...taskEnds) + 30);
  }

  if (todayMatches) {
    startCandidates.push(currentMinutes - 60);
    endCandidates.push(currentMinutes + 90);
  }

  return {
    startMinutes:
      Math.floor(clamp(Math.min(...startCandidates), 0, 23 * 60) / TIMELINE_INTERVAL) * TIMELINE_INTERVAL,
    endMinutes:
      Math.ceil(clamp(Math.max(...endCandidates), DEFAULT_START_MINUTES + 60, 24 * 60) / TIMELINE_INTERVAL) *
      TIMELINE_INTERVAL,
  };
}

function getSlots(startMinutes: number, endMinutes: number) {
  const slots: number[] = [];

  for (let minutes = startMinutes; minutes < endMinutes; minutes += TIMELINE_INTERVAL) {
    slots.push(minutes);
  }

  return slots;
}

function getLayoutStyles(column: number, columns: number) {
  const totalGap = (columns - 1) * OVERLAP_GAP;
  const width = columns === 1 ? "100%" : `calc((100% - ${totalGap}px) / ${columns})`;
  const left =
    column === 0
      ? "0%"
      : `calc(${column} * ((100% - ${totalGap}px) / ${columns} + ${OVERLAP_GAP}px))`;

  return { left, width };
}

type BlockDensity = "compact" | "full" | "micro";

function getBlockDensity(rawHeight: number, columns: number): BlockDensity {
  if (rawHeight < 42 || columns > 2) {
    return "micro";
  }

  if (rawHeight < 90 || columns > 1) {
    return "compact";
  }

  return "full";
}

function getBlockMetrics(startMinutes: number, endMinutes: number, timelineStartMinutes: number) {
  const rawHeight = ((endMinutes - startMinutes) / TIMELINE_INTERVAL) * SLOT_HEIGHT;
  const desiredGap = rawHeight < 36 ? 2 : rawHeight < 84 ? 4 : 6;
  const maxHeight = rawHeight > 2.5 ? rawHeight - 0.75 : rawHeight;
  const isShortBlock = rawHeight <= SLOT_HEIGHT;
  const minimumReadableHeight = isShortBlock ? SHORT_BLOCK_MIN_HEIGHT : Math.min(22, maxHeight);
  const height =
    isShortBlock
      ? Math.max(rawHeight - desiredGap, minimumReadableHeight)
      : Math.min(Math.max(rawHeight - desiredGap, minimumReadableHeight), maxHeight);
  const taskTopOffset = ((startMinutes - timelineStartMinutes) / TIMELINE_INTERVAL) * SLOT_HEIGHT;
  const topOffset = isShortBlock ? taskTopOffset : taskTopOffset + (rawHeight - height) / 2;

  return {
    height,
    rawHeight,
    topOffset,
  };
}

interface DragState {
  durationMinutes: number;
  pointerOffsetMinutes: number;
  previewStartMinutes: number;
  startMinutes: number;
  task: PlannerTask;
}

export function TimelineGrid({
  focusedTaskId,
  isPending,
  now,
  onAddTask,
  onEditTask,
  onRescheduleTask,
  onStartFocusTask,
  onToggleTask,
  resolveVisualState,
  taskDate,
  tasks,
}: TimelineGridProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const { startMinutes, endMinutes } = useMemo(() => getTimelineBounds(tasks, now, taskDate), [now, taskDate, tasks]);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const slots = useMemo(() => getSlots(startMinutes, endMinutes), [endMinutes, startMinutes]);
  const layouts = useMemo(() => getTimelineTaskLayouts(tasks), [tasks]);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const showCurrentLine = formatDateKey(now) === taskDate && currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  const isDragging = dragState !== null;

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    if (!dragStateRef.current) {
      return;
    }

    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    function getPreviewStartMinutes(pointerY: number) {
      const currentDrag = dragStateRef.current;

      if (!currentDrag) {
        return startMinutes;
      }

      if (!surfaceRef.current) {
        return currentDrag.startMinutes;
      }

      const rect = surfaceRef.current.getBoundingClientRect();
      const pointerMinutes = startMinutes + ((pointerY - rect.top) / SLOT_HEIGHT) * TIMELINE_INTERVAL;
      const rawStartMinutes = pointerMinutes - currentDrag.pointerOffsetMinutes;
      const snappedStartMinutes = Math.round(rawStartMinutes / TIMELINE_INTERVAL) * TIMELINE_INTERVAL;

      return clamp(
        snappedStartMinutes,
        startMinutes,
        Math.max(startMinutes, endMinutes - currentDrag.durationMinutes),
      );
    }

    function handlePointerMove(event: PointerEvent) {
      setDragState((current) =>
        current
          ? {
              ...current,
              previewStartMinutes: getPreviewStartMinutes(event.clientY),
            }
          : current,
      );
    }

    function handlePointerUp() {
      const currentDrag = dragStateRef.current;

      setDragState(null);
      document.body.style.userSelect = previousUserSelect;

      if (!currentDrag) {
        return;
      }

      if (currentDrag.previewStartMinutes === currentDrag.startMinutes) {
        return;
      }

      onRescheduleTask(
        currentDrag.task,
        minutesToTime(currentDrag.previewStartMinutes),
        minutesToTime(currentDrag.previewStartMinutes + currentDrag.durationMinutes),
      );
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [endMinutes, isDragging, onRescheduleTask, startMinutes]);

  return (
    <div className="grid grid-cols-[3.9rem_minmax(0,1fr)] gap-3 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
      <div className="pt-1">
        {slots.map((slot) => (
          <div
            key={slot}
            className="flex items-start justify-end pr-2 pt-0.5 text-[11px] font-medium tabular-nums text-secondary-foreground sm:pr-3 sm:text-xs"
            style={{ height: `${SLOT_HEIGHT}px` }}
          >
            {formatTimelineLabel(slot)}
          </div>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-[24px] border border-border/80 bg-white/97">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(24,190,239,0.05),transparent)]" />

        {tasks.length === 0 ? (
          <div className="pointer-events-none absolute left-4 right-4 top-4 z-20 rounded-full border border-dashed border-border/90 bg-white/94 px-4 py-2 text-sm text-secondary-foreground shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            Your day is open. Tap a slot to place the first block.
          </div>
        ) : null}

        <div ref={surfaceRef} className="relative">
          {slots.map((slot, index) => (
            <button
              key={slot}
              suppressHydrationWarning
              type="button"
              className={cn(
                "group relative block w-full text-left transition-[background-color,opacity] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-cyan-50/32 focus:bg-cyan-50/32 focus:outline-none",
                slot % 60 === 0
                  ? "border-t border-border/75"
                  : slot % 30 === 0
                    ? "border-t border-border/55"
                    : "border-t border-dashed border-border/35",
                index === 0 && "border-t-0",
              )}
              style={{ height: `${SLOT_HEIGHT}px` }}
              onClick={() => onAddTask(minutesToTime(slot))}
              aria-label={`Add task at ${formatClockTime(minutesToTime(slot))}`}
            >
              <span className="pointer-events-none absolute inset-y-0 right-4 hidden items-center gap-2 text-[11px] font-semibold text-secondary-foreground/0 transition-[color,opacity] duration-150 sm:flex sm:group-hover:text-secondary-foreground/65 sm:group-focus-visible:text-secondary-foreground/65">
                <Plus className="h-3.5 w-3.5" />
                Add
              </span>
            </button>
          ))}

          {showCurrentLine ? (
            <div
              className="pointer-events-none absolute inset-x-3 z-20"
              style={{ top: `${((currentMinutes - startMinutes) / TIMELINE_INTERVAL) * SLOT_HEIGHT}px` }}
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_0_6px_rgba(20,150,232,0.14)]" />
                <div className="h-px flex-1 bg-primary/60" />
              </div>
            </div>
          ) : null}

          <div className="pointer-events-none absolute inset-y-0 left-3 right-3 top-0">
            {layouts.map((layout) => {
              const task = layout.task;
              const visualState = resolveVisualState(task);
              const isBlocked = isBlockedTask(task);
              const effectiveStartMinutes =
                dragState?.task.id === task.id ? dragState.previewStartMinutes : layout.startMinutes;
              const effectiveEndMinutes =
                dragState?.task.id === task.id
                  ? dragState.previewStartMinutes + dragState.durationMinutes
                  : layout.endMinutes;
              const { height: blockHeight, rawHeight, topOffset } = getBlockMetrics(
                effectiveStartMinutes,
                effectiveEndMinutes,
                startMinutes,
              );
              const density = getBlockDensity(rawHeight, layout.columns);
              const isMicro = density === "micro";
              const isTight = density === "micro" || layout.columns > 1;
              const isMeeting = task.task_type === "meeting";
              const showParticipantNames = isMeeting && task.participants.length > 0 && !isTight;
              const { left, width } = getLayoutStyles(layout.column, layout.columns);
              const controlButtonClass = isMicro
                ? "h-5 w-5 rounded-full border border-white/75 bg-white/92 px-0 text-secondary-foreground shadow-[0_4px_10px_rgba(15,23,42,0.05)] hover:bg-white"
                : density === "compact"
                  ? "h-7 w-7 rounded-full border border-white/70 bg-white/86 px-0 text-secondary-foreground shadow-[0_8px_18px_rgba(15,23,42,0.05)] hover:bg-white"
                  : "h-8 w-8 rounded-full border border-white/70 bg-white/84 px-0 text-secondary-foreground shadow-[0_8px_18px_rgba(15,23,42,0.05)] hover:bg-white";

              return (
                <div
                  key={task.id}
                  id={getTaskAnchorId(task.id)}
                  className={cn(
                    "pointer-events-auto absolute z-10 overflow-hidden rounded-[20px] border transition-[transform,box-shadow,border-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    isBlocked ? blockedBlockStyles[visualState] : blockStyles[visualState],
                    dragState?.task.id === task.id && "shadow-[0_18px_34px_rgba(15,23,42,0.14)] ring-2 ring-primary/25",
                    focusedTaskId === task.id && "ring-2 ring-primary/35 ring-offset-2 ring-offset-background",
                  )}
                  style={{
                    top: `${topOffset}px`,
                    height: `${blockHeight}px`,
                    left,
                    width,
                    zIndex: dragState?.task.id === task.id ? 30 : focusedTaskId === task.id ? 20 : 10 + layout.column,
                  }}
                >
                  <div
                    suppressHydrationWarning
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "relative h-full cursor-pointer text-left focus:outline-none",
                      isMicro
                        ? "px-2 py-1 pr-12"
                        : density === "compact"
                          ? "px-3 py-2.5 pr-[4.5rem]"
                          : "px-3 py-3 pr-24 sm:pr-[6.75rem]",
                    )}
                    onClick={() => onEditTask(task)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onEditTask(task);
                      }
                    }}
                  >
                    <span
                      className={cn(
                        "absolute left-2 w-1 rounded-full",
                        isMicro ? "inset-y-1.5" : "inset-y-3",
                        isBlocked ? blockedAccentStyles[visualState] : accentStyles[visualState],
                      )}
                    />
                    <div className={cn("min-w-0 pl-2", isMicro && "flex h-full items-center pr-0.5")}>
                      <div className={cn("flex min-w-0 items-center gap-2", isMicro && "gap-1.5")}>
                        {isMeeting ? (
                          <Video className={cn("shrink-0 text-primary", isMicro ? "h-3 w-3" : "h-3.5 w-3.5")} />
                        ) : isBlocked ? (
                          <CalendarRange className={cn("shrink-0 text-slate-500", isMicro ? "h-3 w-3" : "h-3.5 w-3.5")} />
                        ) : (
                          <CalendarRange
                            className={cn("shrink-0 text-secondary-foreground", isMicro ? "h-3 w-3" : "h-3.5 w-3.5")}
                          />
                        )}
                        <p
                          className={cn(
                            isMicro ? "truncate text-[11px] font-semibold leading-none" : "truncate text-sm font-semibold",
                            isBlocked ? blockedTextStyles[visualState] : blockTextStyles[visualState],
                          )}
                        >
                          {task.title}
                        </p>
                        {task.recurring_rule_id && !isMicro ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50/82 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                            <Repeat className="h-3 w-3" />
                            Recurring
                          </span>
                        ) : null}
                      </div>
                      {!isMicro ? (
                        <div
                          className={cn(
                            "mt-1 flex min-w-0 items-center gap-2 text-secondary-foreground",
                            density === "compact" ? "text-[11px] leading-tight" : "text-xs",
                          )}
                        >
                          <span className="shrink-0">
                            {density === "compact"
                              ? formatClockTime(minutesToTime(effectiveStartMinutes))
                              : `${formatClockTime(minutesToTime(effectiveStartMinutes))} to ${formatClockTime(minutesToTime(effectiveEndMinutes))}`}
                          </span>
                          {showParticipantNames ? (
                            <>
                              <span className="h-1 w-1 shrink-0 rounded-full bg-secondary-foreground/35" />
                              <span className="flex min-w-0 items-center gap-1.5">
                                <Users className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">
                                  {formatParticipantNames(task.participants, layout.columns > 1 ? 1 : 2)}
                                </span>
                              </span>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div
                    className={cn(
                      "pointer-events-none absolute flex",
                      isMicro ? "right-2 inset-y-0 items-center" : "right-2.5 top-2.5 flex-col items-end gap-1.5",
                    )}
                  >
                    {density === "full" ? (
                      <span className="rounded-full border border-white/70 bg-white/82 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-secondary-foreground shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                        {isBlocked ? "Blocked" : stateLabels[visualState]}
                      </span>
                    ) : null}

                    <div
                      className={cn(
                        "pointer-events-auto flex items-center",
                        isMicro ? "gap-0.5" : density === "compact" ? "gap-1.5" : "gap-1.5",
                      )}
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        className={controlButtonClass}
                        onClick={(event) => {
                          event.stopPropagation();
                          onStartFocusTask(task);
                        }}
                        disabled={isPending || task.status === "completed" || isBlocked}
                        aria-label={`Start focus for ${task.title}`}
                      >
                        <Play className={cn(isMicro ? "h-3 w-3" : "h-4 w-4")} />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className={controlButtonClass}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();

                          if (isPending) {
                            return;
                          }

                          const rect = surfaceRef.current?.getBoundingClientRect();

                          if (!rect) {
                            return;
                          }

                          const taskStartMinutes = toMinutes(task.start_time);
                          const taskEndMinutes = toMinutes(task.end_time);
                          const pointerMinutes =
                            startMinutes + ((event.clientY - rect.top) / SLOT_HEIGHT) * TIMELINE_INTERVAL;

                          setDragState({
                            durationMinutes: taskEndMinutes - taskStartMinutes,
                            pointerOffsetMinutes: clamp(
                              pointerMinutes - taskStartMinutes,
                              0,
                              taskEndMinutes - taskStartMinutes,
                            ),
                            previewStartMinutes: taskStartMinutes,
                            startMinutes: taskStartMinutes,
                            task,
                          });
                        }}
                        disabled={isPending}
                        aria-label={`Move ${task.title}`}
                      >
                        <GripVertical className={cn(isMicro ? "h-3 w-3" : "h-4 w-4")} />
                      </Button>

                      {!isBlocked ? (
                        <Button
                          size="sm"
                          variant={task.status === "completed" ? "secondary" : "ghost"}
                          className={controlButtonClass}
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleTask(task);
                          }}
                          disabled={isPending}
                          aria-label={
                            task.status === "completed" ? `Mark ${task.title} pending` : `Mark ${task.title} complete`
                          }
                        >
                          <CheckCircle2 className={cn(isMicro ? "h-3 w-3" : "h-4 w-4")} />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
