import { Plus } from "lucide-react";

import { Button } from "@/components/shared/button";
import { formatClockTime } from "@/lib/daystack";
import type { PlannerTask, TaskVisualState } from "@/types/daystack";
import { TaskCard } from "./task-card";

interface TimelineListProps {
  focusedTaskId?: string | null;
  tasks: PlannerTask[];
  resolveVisualState: (task: PlannerTask) => TaskVisualState;
  isPending: boolean;
  onAddTask: (startTime?: string) => void;
  onEditTask: (task: PlannerTask) => void;
  onDeleteTask: (task: PlannerTask) => void;
  onStartFocusTask: (task: PlannerTask) => void;
  onToggleTaskSelection: (taskId: string) => void;
  onToggleTask: (task: PlannerTask) => void;
  selectedTaskIds: string[];
  selectionMode: boolean;
}

export function TimelineList({
  focusedTaskId,
  tasks,
  resolveVisualState,
  isPending,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onStartFocusTask,
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
        className="w-full rounded-[22px] border border-dashed border-border/90 bg-muted/40 p-4 text-left transition-[border-color,background-color,box-shadow] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-primary/35 hover:bg-cyan-50/35"
        onClick={() => onAddTask()}
      >
        <p className="text-sm font-semibold text-foreground">Your day is open.</p>
        <p className="mt-1 text-sm text-secondary-foreground">Add the first block and the schedule will take shape.</p>
      </button>
    );
  }

  return (
    <div className="space-y-2.5">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          focusedTaskId={focusedTaskId}
          task={task}
          visualState={resolveVisualState(task)}
          isPending={isPending}
          onEdit={onEditTask}
          onDelete={onDeleteTask}
          onStartFocusTask={onStartFocusTask}
          onToggleSelection={onToggleTaskSelection}
          onToggle={onToggleTask}
          isSelected={selectedTaskIds.includes(task.id)}
          selectionMode={selectionMode}
        />
      ))}

      <Button
        variant="secondary"
        className="mt-2 w-full justify-start rounded-[20px] border-dashed bg-muted/38 text-secondary-foreground hover:border-primary/30 hover:bg-cyan-50/30"
        onClick={() => onAddTask(tasks.at(-1)?.end_time.slice(0, 5))}
      >
        <Plus className="h-4 w-4" />
        Add block {tasks.at(-1) ? `after ${formatClockTime(tasks.at(-1)!.end_time)}` : ""}
      </Button>
    </div>
  );
}
