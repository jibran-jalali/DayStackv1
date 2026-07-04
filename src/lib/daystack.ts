import type {
  DailySummaryRecord,
  DashboardSummary,
  ParticipantProfile,
  PlannerDateMode,
  PlannerTask,
  TaskRecord,
  TaskType,
  TaskVisualState,
  TaskWindowState,
  TimelineTaskLayout,
} from "@/types/daystack";

export function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function isValidDateKey(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && formatDateKey(date) === value;
}

export function shiftDate(dateKey: string, offset: number) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return formatDateKey(date);
}

export function getPlannerDateMode(dateKey: string, now: Date): PlannerDateMode {
  const todayKey = formatDateKey(now);

  if (dateKey === todayKey) {
    return "today";
  }

  return dateKey > todayKey ? "future" : "past";
}

export function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function addMinutesToTime(time: string, increment = 60) {
  const nextValue = toMinutes(time) + increment;

  if (nextValue >= 24 * 60) {
    return "23:59";
  }

  const hours = Math.floor(nextValue / 60);
  const minutes = nextValue % 60;

  return `${`${hours}`.padStart(2, "0")}:${`${minutes}`.padStart(2, "0")}`;
}

export function minutesToTime(value: number) {
  const clamped = Math.min(Math.max(value, 0), 23 * 60 + 59);
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;

  return `${`${hours}`.padStart(2, "0")}:${`${minutes}`.padStart(2, "0")}`;
}

export function floorMinutesToInterval(value: number, interval: number) {
  return Math.floor(value / interval) * interval;
}

export function ceilMinutesToInterval(value: number, interval: number) {
  return Math.ceil(value / interval) * interval;
}

export function formatClockTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const displayHours = hours % 12 || 12;
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${displayHours}:${`${minutes}`.padStart(2, "0")} ${suffix}`;
}

export function formatDateLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatShortDateLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function getRelativeDateLabel(dateKey: string, now: Date) {
  const todayKey = formatDateKey(now);
  const tomorrowKey = shiftDate(todayKey, 1);
  const yesterdayKey = shiftDate(todayKey, -1);

  if (dateKey === todayKey) {
    return "Today";
  }

  if (dateKey === tomorrowKey) {
    return "Tomorrow";
  }

  if (dateKey === yesterdayKey) {
    return "Yesterday";
  }

  return formatShortDateLabel(dateKey);
}

export function calculateExecutionScore(completedTasks: number, totalTasks: number) {
  if (totalTasks === 0) {
    return 0;
  }

  return Math.round((completedTasks / totalTasks) * 100);
}

export function isBlockedTask(task: Pick<TaskRecord, "task_type">) {
  return task.task_type === "blocked";
}

export function isActionableTask(task: Pick<TaskRecord, "task_type">) {
  return !isBlockedTask(task);
}

export function getTaskTypeLabel(taskType: TaskType) {
  if (taskType === "meeting") {
    return "Meeting";
  }

  if (taskType === "blocked") {
    return "Blocked";
  }

  return "Generic";
}

export function buildSummary(tasks: Array<Pick<TaskRecord, "status" | "task_type">>): DashboardSummary {
  const actionableTasks = tasks.filter(isActionableTask);
  const totalTasks = actionableTasks.length;
  const completedTasks = actionableTasks.filter((task) => task.status === "completed").length;
  const incompleteTasks = totalTasks - completedTasks;
  const executionScore = calculateExecutionScore(completedTasks, totalTasks);
  const successfulDay = totalTasks > 0 && executionScore >= 70;
  const completionRate = executionScore;

  return {
    totalTasks,
    completedTasks,
    incompleteTasks,
    completionRate,
    executionScore,
    successfulDay,
    summaryLine: getSummaryLine(completionRate, completedTasks, totalTasks),
  };
}

export function getSummaryLine(completionRate: number, completedTasks: number, totalTasks: number) {
  if (totalTasks === 0) {
    return "No tasks planned.";
  }

  if (completionRate >= 90) {
    return `Excellent: ${completedTasks}/${totalTasks} complete.`;
  }

  if (completionRate >= 70) {
    return `Strong: ${completedTasks}/${totalTasks} complete.`;
  }

  if (completionRate >= 40) {
    return `On track: ${completedTasks}/${totalTasks} complete.`;
  }

  return `In progress: ${completedTasks}/${totalTasks} complete.`;
}

export function getTaskVisualState(
  task: Pick<TaskRecord, "status" | "start_time" | "end_time">,
  now: Date,
  taskDate: string,
): TaskVisualState {
  if (task.status === "completed") {
    return "completed";
  }

  const todayKey = formatDateKey(now);

  if (todayKey > taskDate) {
    return "overdue";
  }

  if (todayKey !== taskDate) {
    return "pending";
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = toMinutes(task.start_time);
  const endMinutes = toMinutes(task.end_time);

  if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
    return "active";
  }

  if (currentMinutes < startMinutes) {
    return "upcoming";
  }

  return "overdue";
}

export function getTaskWindow(tasks: PlannerTask[], now: Date, taskDate: string): TaskWindowState {
  const todayMatches = formatDateKey(now) === taskDate;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let currentTask: PlannerTask | null = null;
  let nextTask: PlannerTask | null = null;

  for (const task of tasks) {
    if (isBlockedTask(task)) {
      continue;
    }

    const startMinutes = toMinutes(task.start_time);
    const endMinutes = toMinutes(task.end_time);

    if (
      todayMatches &&
      task.status !== "completed" &&
      currentMinutes >= startMinutes &&
      currentMinutes < endMinutes
    ) {
      currentTask = task;
      break;
    }

    if (!nextTask && task.status !== "completed" && (!todayMatches || currentMinutes < startMinutes)) {
      nextTask = task;
    }
  }

  if (!nextTask && currentTask) {
    const currentIndex = tasks.findIndex((task) => task.id === currentTask?.id);
    nextTask = tasks.slice(currentIndex + 1).find((task) => task.status !== "completed") ?? null;
  }

  return {
    currentTask,
    nextTask,
  };
}

export function calculateActiveStreak(summaries: DailySummaryRecord[], referenceDate: string) {
  const successfulDates = new Set(
    summaries.filter((summary) => summary.successful_day).map((summary) => summary.summary_date),
  );

  const anchor =
    successfulDates.has(referenceDate)
      ? referenceDate
      : successfulDates.has(shiftDate(referenceDate, -1))
        ? shiftDate(referenceDate, -1)
        : null;

  if (!anchor) {
    return 0;
  }

  let streak = 0;
  let cursor = anchor;

  while (successfulDates.has(cursor)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }

  return streak;
}

export function deriveDisplayName(fullName: string | null | undefined, email: string | undefined) {
  if (fullName && fullName.trim().length > 0) {
    return fullName.trim();
  }

  if (!email) {
    return "DayStack user";
  }

  return email.split("@")[0] ?? "DayStack user";
}

export function getUpcomingTasks(tasks: PlannerTask[], now: Date, taskDate: string, limit = 4) {
  const todayMatches = formatDateKey(now) === taskDate;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return tasks
    .filter((task) => {
      if (isBlockedTask(task)) {
        return false;
      }

      if (task.status === "completed") {
        return false;
      }

      if (!todayMatches) {
        return true;
      }

      return toMinutes(task.end_time) > currentMinutes;
    })
    .slice(0, limit);
}

export function formatParticipantNames(participants: ParticipantProfile[], limit = 2) {
  if (participants.length === 0) {
    return "";
  }

  const visible = participants.slice(0, limit).map((participant) => participant.fullName);
  const remainder = participants.length - visible.length;

  if (remainder <= 0) {
    return visible.join(", ");
  }

  return `${visible.join(", ")} +${remainder}`;
}

export function getTaskAnchorId(taskId: string) {
  return `task-block-${taskId}`;
}

export function getTimelineTaskLayouts(tasks: PlannerTask[]): TimelineTaskLayout[] {
  if (tasks.length === 0) {
    return [];
  }

  const sortedTasks = [...tasks].sort((left, right) => {
    const byStart = toMinutes(left.start_time) - toMinutes(right.start_time);

    if (byStart !== 0) {
      return byStart;
    }

    const byEnd = toMinutes(left.end_time) - toMinutes(right.end_time);

    if (byEnd !== 0) {
      return byEnd;
    }

    return left.created_at.localeCompare(right.created_at);
  });

  const clusters: PlannerTask[][] = [];
  let activeCluster: PlannerTask[] = [];
  let clusterEnd = -1;

  for (const task of sortedTasks) {
    const start = toMinutes(task.start_time);
    const end = toMinutes(task.end_time);

    if (activeCluster.length === 0 || start < clusterEnd) {
      activeCluster.push(task);
      clusterEnd = Math.max(clusterEnd, end);
      continue;
    }

    clusters.push(activeCluster);
    activeCluster = [task];
    clusterEnd = end;
  }

  if (activeCluster.length > 0) {
    clusters.push(activeCluster);
  }

  return clusters.flatMap((cluster, clusterIndex) => {
    const columnEndTimes: number[] = [];
    const assignments = cluster.map((task) => {
      const startMinutes = toMinutes(task.start_time);
      const endMinutes = toMinutes(task.end_time);

      let column = columnEndTimes.findIndex((endTime) => endTime <= startMinutes);

      if (column === -1) {
        column = columnEndTimes.length;
        columnEndTimes.push(endMinutes);
      } else {
        columnEndTimes[column] = endMinutes;
      }

      return {
        task,
        clusterId: `cluster-${clusterIndex}`,
        column,
        startMinutes,
        endMinutes,
      };
    });

    const columns = Math.max(...assignments.map((assignment) => assignment.column)) + 1;

    return assignments.map(
      (assignment) =>
        ({
          ...assignment,
          columns,
        }) satisfies TimelineTaskLayout,
    );
  });
}
