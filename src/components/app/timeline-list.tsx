import { memo } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/shared/button";
import { formatClockTime } from "@/lib/daystack";
import type { PlannerTask, TaskVisualState } from "@/types/daystack";
import { TaskCard } from "./task-card";

interface TimelineListProps {
  tasks: PlannerTask[];
  resolveVisualState: (task: PlannerTask) => TaskVisualState;
  isPending: boolean;
  onAddTask: (startTime?: string) => void;
  onEditTask: (task: PlannerTask) => void;
  onDeleteTask: (task: PlannerTask) => void;
  onToggleTaskSelection: (taskId: string) => void;
  onToggleTask: (task: PlannerTask) => void;
  selectedTaskIds: string[];
  selectionMode: boolean;
}

function TimelineListComponent({
  tasks,
  resolveVisualState,
  isPending,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onToggleTaskSelection,
  onToggleTask,
  selectedTaskIds,
  selectionMode,
}: TimelineListProps) {
  if (tasks.length === 0) {
    return (
      <button
        suppressHydrationWarning
        type="button"
        className="mobile-card w-full border-dashed bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,248,252,0.94))] p-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-primary/35"
        onClick={() => onAddTask()}
      >
        <p className="text-[15px] font-semibold tracking-tight text-foreground">Your day is open.</p>
        <p className="mt-1 text-xs text-secondary-foreground">Add the first block.</p>
      </button>
    );
  }

  return (
    <div className="space-y-2.5">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          visualState={resolveVisualState(task)}
          isPending={isPending}
          onEdit={onEditTask}
          onDelete={onDeleteTask}
          onToggleSelection={onToggleTaskSelection}
          onToggle={onToggleTask}
          isSelected={selectedTaskIds.includes(task.id)}
          selectionMode={selectionMode}
        />
      ))}

      <Button
        variant="secondary"
        className="mt-1 h-10 w-full justify-start rounded-[18px] border-dashed bg-white/92 text-xs text-secondary-foreground shadow-[0_8px_20px_rgba(15,23,42,0.055)] hover:border-primary/30 hover:bg-[linear-gradient(135deg,rgba(24,190,239,0.08),rgba(109,40,240,0.04))]"
        onClick={() => onAddTask(tasks.at(-1)?.end_time.slice(0, 5))}
      >
        <Plus className="h-4 w-4" />
        Add block {tasks.at(-1) ? `after ${formatClockTime(tasks.at(-1)!.end_time)}` : ""}
      </Button>
    </div>
  );
}

function areTimelineListPropsEqual(left: TimelineListProps, right: TimelineListProps) {
  return (
    left.tasks === right.tasks &&
    left.resolveVisualState === right.resolveVisualState &&
    left.isPending === right.isPending &&
    left.onAddTask === right.onAddTask &&
    left.selectedTaskIds === right.selectedTaskIds &&
    left.selectionMode === right.selectionMode
  );
}

export const TimelineList = memo(TimelineListComponent, areTimelineListPropsEqual);
