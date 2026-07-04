import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  Flame,
  Gauge,
  PencilLine,
  PlayCircle,
  Sparkles,
  Users,
  Video,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/shared/button";
import { StatusChip } from "@/components/shared/status-chip";
import { formatClockTime, formatParticipantNames, isBlockedTask } from "@/lib/daystack";
import type { DashboardSummary, PlannerDateMode, PlannerTask } from "@/types/daystack";

interface ExecutionLaneProps {
  currentTask: PlannerTask | null;
  dateLabel: string;
  dateMode: PlannerDateMode;
  isPending: boolean;
  nextTask: PlannerTask | null;
  onEditTask: (task: PlannerTask) => void;
  onFocusTask: (taskId: string) => void;
  onToggleTask: (task: PlannerTask) => void;
  queue: PlannerTask[];
  streak: number;
  summary: DashboardSummary;
  tasks: PlannerTask[];
}

function LaneShell({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-[18px] border border-border/70 bg-white/78 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/70">{title}</p>
      {children}
    </section>
  );
}

function TaskMeta({ task }: { task: PlannerTask }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-secondary-foreground">
      <span className="inline-flex items-center gap-1.5">
        {task.task_type === "meeting" ? <Video className="h-3.5 w-3.5" /> : <CalendarRange className="h-3.5 w-3.5" />}
        {formatClockTime(task.start_time)} to {formatClockTime(task.end_time)}
      </span>
      {task.task_type === "meeting" && task.participants.length > 0 ? (
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {formatParticipantNames(task.participants)}
        </span>
      ) : null}
    </div>
  );
}

function LaneTaskCard({
  ctaLabel,
  ctaTone,
  emptyLabel,
  highlight,
  isPending,
  onEdit,
  onFocus,
  onToggle,
  showCompleteAction = true,
  task,
  title,
}: {
  ctaLabel: string;
  ctaTone: "brand" | "default";
  emptyLabel: string;
  highlight?: ReactNode;
  isPending: boolean;
  onEdit: (task: PlannerTask) => void;
  onFocus: (taskId: string) => void;
  onToggle: (task: PlannerTask) => void;
  showCompleteAction?: boolean;
  task: PlannerTask | null;
  title: string;
}) {
  return (
    <LaneShell title={title}>
      {task ? (
        <>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{task.title}</p>
              <TaskMeta task={task} />
            </div>
            {highlight}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => onFocus(task.id)} disabled={isPending}>
              {ctaLabel}
            </Button>
            {showCompleteAction ? (
              <Button
                size="sm"
                variant={ctaTone === "brand" ? "primary" : "secondary"}
                onClick={() => onToggle(task)}
                disabled={isPending || task.status === "completed"}
              >
                <CheckCircle2 className="h-4 w-4" />
                Done
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => onEdit(task)} disabled={isPending}>
              <PencilLine className="h-4 w-4" />
              Edit
            </Button>
            {task.task_type === "meeting" && task.meeting_link ? (
              <a
                href={task.meeting_link}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "ghost", size: "sm", className: "h-10 px-4" })}
              >
                <Video className="h-4 w-4" />
                Join
              </a>
            ) : null}
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-secondary-foreground">{emptyLabel}</p>
      )}
    </LaneShell>
  );
}

function QueueRow({
  allowCompletion,
  isPending,
  onEdit,
  onFocus,
  onToggle,
  task,
}: {
  allowCompletion: boolean;
  isPending: boolean;
  onEdit: (task: PlannerTask) => void;
  onFocus: (taskId: string) => void;
  onToggle: (task: PlannerTask) => void;
  task: PlannerTask;
}) {
  return (
    <div className="flex items-center gap-2 rounded-[16px] border border-border/70 bg-white/78 px-3 py-2.5 transition-[transform,box-shadow,border-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(15,23,42,0.05)]">
      <button
        suppressHydrationWarning
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => onFocus(task.id)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-secondary-foreground">{formatClockTime(task.start_time)}</span>
          {task.task_type === "meeting" ? (
            <Video className="h-3.5 w-3.5 text-primary" />
          ) : (
            <CalendarRange className="h-3.5 w-3.5 text-secondary-foreground" />
          )}
          <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
        </div>
        {task.task_type === "meeting" && task.participants.length > 0 ? (
          <p className="mt-1 truncate pl-10 text-xs text-secondary-foreground">{formatParticipantNames(task.participants)}</p>
        ) : null}
      </button>

      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 rounded-full px-0"
        onClick={() => onToggle(task)}
        disabled={!allowCompletion || isPending || task.status === "completed"}
        aria-label={`Mark ${task.title} complete`}
      >
        <CheckCircle2 className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 rounded-full px-0"
        onClick={() => onEdit(task)}
        disabled={isPending}
        aria-label={`Edit ${task.title}`}
      >
        <PencilLine className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function ExecutionLane({
  currentTask,
  dateLabel,
  dateMode,
  isPending,
  nextTask,
  onEditTask,
  onFocusTask,
  onToggleTask,
  queue,
  streak,
  summary,
  tasks,
}: ExecutionLaneProps) {
  const allowCompletion = dateMode !== "future";
  const meetingCount = tasks.filter((task) => task.task_type === "meeting").length;
  const blockedCount = tasks.filter((task) => isBlockedTask(task)).length;
  const laneHeadline =
    dateMode === "today" ? "Execution Lane" : dateMode === "future" ? "Planning Lane" : "Review Lane";
  const primaryMetricLabel =
    dateMode === "future"
      ? summary.totalTasks > 0
        ? `${summary.totalTasks} planned`
        : blockedCount > 0
          ? `${blockedCount} blocked`
          : "Open day"
      : `${summary.executionScore}%`;
  const primaryMetricTone = dateMode === "future" ? "default" : "brand";
  const endOfDayNote =
    dateMode === "future"
      ? summary.totalTasks === 0
        ? blockedCount > 0
          ? `${blockedCount} blocked zone${blockedCount === 1 ? "" : "s"} are placed for this day.`
          : "Nothing is planned for this day yet."
        : `${summary.totalTasks} block${summary.totalTasks === 1 ? "" : "s"} are ready for this day.`
      : summary.totalTasks === 0
        ? "No blocks planned yet."
        : summary.successfulDay
          ? "The day is counting as a win."
          : `${summary.incompleteTasks} block${summary.incompleteTasks === 1 ? "" : "s"} left open.`;

  return (
    <section className="glass-panel p-4 sm:p-5 xl:max-h-[calc(100vh-7.5rem)] xl:overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="section-label">Execution Lane</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">{laneHeadline}</h2>
          <p className="mt-1 text-sm text-secondary-foreground">{dateLabel}</p>
        </div>
        <StatusChip label={primaryMetricLabel} tone={primaryMetricTone} icon={Gauge} />
      </div>

      <div className="mt-4 space-y-3 xl:max-h-[calc(100vh-13rem)] xl:overflow-y-auto xl:pr-1 soft-scrollbar">
        {dateMode === "today" ? (
          <>
            <LaneTaskCard
              title="Now"
              task={currentTask}
              ctaLabel="Focus"
              ctaTone="brand"
              emptyLabel="No block is live."
              highlight={currentTask ? <StatusChip label="Live" tone="brand" icon={PlayCircle} className="shrink-0" /> : null}
              isPending={isPending}
              onEdit={onEditTask}
              onFocus={onFocusTask}
              onToggle={onToggleTask}
            />

            <LaneTaskCard
              title="Next"
              task={nextTask}
              ctaLabel="Jump"
              ctaTone="default"
              emptyLabel="Nothing scheduled next."
              highlight={nextTask ? <StatusChip label="Next" tone="default" icon={ArrowRight} className="shrink-0" /> : null}
              isPending={isPending}
              onEdit={onEditTask}
              onFocus={onFocusTask}
              onToggle={onToggleTask}
            />
          </>
        ) : dateMode === "future" ? (
          <>
            <LaneShell title="Future day">
              <p className="mt-2 text-sm text-secondary-foreground">
                No live task exists for a future plan. Use this lane to review the structure before the day starts.
              </p>
            </LaneShell>

            <LaneTaskCard
              title="Starts with"
              task={nextTask}
              ctaLabel="Open"
              ctaTone="default"
              emptyLabel="No first block is planned yet."
              highlight={nextTask ? <StatusChip label="Planned" tone="default" icon={ArrowRight} className="shrink-0" /> : null}
              isPending={isPending}
              showCompleteAction={false}
              onEdit={onEditTask}
              onFocus={onFocusTask}
              onToggle={onToggleTask}
            />
          </>
        ) : (
          <>
            <LaneShell title="Past day">
              <p className="mt-2 text-sm text-secondary-foreground">
                Review how this day landed and close any blocks that were left open.
              </p>
            </LaneShell>

            <LaneTaskCard
              title="Left open"
              task={nextTask}
              ctaLabel="Review"
              ctaTone="default"
              emptyLabel="No open blocks were left behind."
              highlight={nextTask ? <StatusChip label="History" tone="default" icon={ArrowRight} className="shrink-0" /> : null}
              isPending={isPending}
              onEdit={onEditTask}
              onFocus={onFocusTask}
              onToggle={onToggleTask}
            />
          </>
        )}

        <LaneShell title={dateMode === "future" ? "Later blocks" : dateMode === "past" ? "Left incomplete" : "Queue"}>
          {queue.length > 0 ? (
            <div className="mt-2 space-y-2">
              {queue.map((task) => (
                <QueueRow
                  key={task.id}
                  allowCompletion={allowCompletion}
                  task={task}
                  isPending={isPending}
                  onEdit={onEditTask}
                  onFocus={onFocusTask}
                  onToggle={onToggleTask}
                />
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-secondary-foreground">
              {dateMode === "future" ? "No later blocks are queued yet." : "Nothing else is queued."}
            </p>
          )}
        </LaneShell>

        {dateMode === "future" ? (
          <LaneShell title="Planned for this day">
            <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-[16px] border border-border/70 bg-white/70 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary-foreground/70">Blocks</p>
                <p className="mt-1 font-semibold text-foreground">{summary.totalTasks}</p>
              </div>
              <div className="rounded-[16px] border border-border/70 bg-white/70 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary-foreground/70">Meetings</p>
                <p className="mt-1 font-semibold text-foreground">{meetingCount}</p>
              </div>
              <div className="rounded-[16px] border border-border/70 bg-white/70 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary-foreground/70">Blocked</p>
                <p className="mt-1 font-semibold text-foreground">{blockedCount}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-secondary-foreground">No live score appears until the day begins.</p>
          </LaneShell>
        ) : (
          <LaneShell title={dateMode === "past" ? "Day result" : "Daily Progress"}>
            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="text-2xl font-semibold text-foreground">{summary.executionScore}%</p>
              <p className="text-sm text-secondary-foreground">
                {summary.completedTasks}/{summary.totalTasks || 0} done
              </p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand-gradient transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ width: `${summary.executionScore}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-[16px] border border-border/70 bg-white/70 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary-foreground/70">Planned</p>
                <p className="mt-1 font-semibold text-foreground">{summary.totalTasks}</p>
              </div>
              <div className="rounded-[16px] border border-border/70 bg-white/70 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary-foreground/70">Done</p>
                <p className="mt-1 font-semibold text-foreground">{summary.completedTasks}</p>
              </div>
              <div className="rounded-[16px] border border-border/70 bg-white/70 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary-foreground/70">Open</p>
                <p className="mt-1 font-semibold text-foreground">{summary.incompleteTasks}</p>
              </div>
            </div>
          </LaneShell>
        )}

        <LaneShell title="Streak">
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-2xl font-semibold text-foreground">{streak}</p>
              <p className="mt-1 text-sm text-secondary-foreground">
                {streak === 1 ? "day active" : "days active"}
              </p>
            </div>
            <StatusChip
              label={summary.successfulDay ? "On track" : "70% rule"}
              tone={summary.successfulDay ? "success" : "default"}
              icon={Flame}
            />
          </div>
          <p className="mt-3 text-sm text-secondary-foreground">
            {dateMode === "future" ? "A day counts when it clears 70%." : "Hit 70% to protect the streak."}
          </p>
        </LaneShell>

        <LaneShell title="End of day">
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">
              {dateMode === "future"
                ? "The day has not started yet."
                : summary.successfulDay
                  ? "The day is landing well."
                  : "The day is still open."}
            </p>
            <StatusChip
              label={dateMode === "future" ? "Upcoming" : summary.successfulDay ? "Win" : "Open"}
              tone={dateMode === "future" ? "default" : summary.successfulDay ? "success" : "default"}
              icon={Sparkles}
            />
          </div>
          <p className="mt-2 text-sm text-secondary-foreground">{endOfDayNote}</p>
        </LaneShell>
      </div>
    </section>
  );
}
