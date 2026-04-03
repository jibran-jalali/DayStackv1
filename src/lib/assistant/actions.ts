import {
  formatClockTime,
  formatDateLabel,
  formatShortDateLabel,
  getTaskTypeLabel,
} from "@/lib/daystack";
import type {
  AssistantAction,
  AssistantContext,
  AssistantContextRecurringBlock,
  AssistantContextTask,
  AssistantMutationAction,
} from "@/types/assistant";
import { taskFormSchema, type TaskFormValues } from "@/types/daystack";

function sortWeekdays(weekdays: number[]) {
  return [...weekdays].sort((left, right) => left - right);
}

function getWeekdayFromDateKey(taskDate: string) {
  const [year, month, day] = taskDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function getWeekdayLabel(weekday: number) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][weekday] ?? "Day";
}

function mapParticipants(
  participants: Array<{ fullName: string; id: string }>,
): TaskFormValues["participants"] {
  return participants.map((participant) => ({
    fullName: participant.fullName,
    id: participant.id,
  }));
}

export function isAssistantMutationAction(action: AssistantAction): action is AssistantMutationAction {
  return action.kind !== "answer_only" && action.kind !== "ask_followup";
}

export function buildTaskFormValuesFromContextTask(task: AssistantContextTask): TaskFormValues {
  return {
    blockMode: task.recurringSeriesId ? "recurring" : "one_time",
    endTime: task.endTime,
    meetingLink: task.meetingLink ?? "",
    participants: mapParticipants(task.participants),
    startTime: task.startTime,
    taskDate: task.taskDate,
    taskType: task.taskType,
    title: task.title,
    weekdays: task.recurringSeriesId ? sortWeekdays(task.recurringWeekdays) : [],
  };
}

export function buildTaskFormValuesFromRecurringBlock(
  block: AssistantContextRecurringBlock,
  fromDate?: string,
): TaskFormValues {
  return {
    blockMode: "recurring",
    endTime: block.endTime,
    meetingLink: block.meetingLink ?? "",
    participants: mapParticipants(block.participants),
    startTime: block.startTime,
    taskDate: fromDate ?? block.nextOccurrenceDate ?? block.effectiveStartDate,
    taskType: block.taskType,
    title: block.title,
    weekdays: sortWeekdays(block.weekdays),
  };
}

export function normalizeAssistantTaskValues(values: TaskFormValues): TaskFormValues {
  const weekday = getWeekdayFromDateKey(values.taskDate);
  const normalizedWeekdays =
    values.blockMode === "recurring"
      ? sortWeekdays([...new Set([...values.weekdays, weekday])])
      : [];

  const normalizedValues: TaskFormValues = {
    blockMode: values.blockMode,
    endTime: values.endTime,
    meetingLink: values.taskType === "meeting" ? values.meetingLink?.trim() ?? "" : "",
    participants:
      values.taskType === "meeting"
        ? values.participants.map((participant) => ({
            fullName: participant.fullName,
            id: participant.id,
          }))
        : [],
    startTime: values.startTime,
    taskDate: values.taskDate,
    taskType: values.taskType,
    title: values.title.trim(),
    weekdays: normalizedWeekdays,
  };

  return taskFormSchema.parse(normalizedValues);
}

type TaskValueChanges = {
  endTime?: string;
  meetingLink?: string | null;
  participants?: TaskFormValues["participants"];
  startTime?: string;
  taskDate?: string;
  taskType?: TaskFormValues["taskType"];
  title?: string;
  weekdays?: number[];
};

export function mergeTaskFormValues(
  base: TaskFormValues,
  changes: TaskValueChanges,
): TaskFormValues {
  return normalizeAssistantTaskValues({
    ...base,
    ...changes,
    meetingLink:
      changes.meetingLink === null
        ? ""
        : changes.meetingLink !== undefined
          ? changes.meetingLink
          : base.meetingLink,
    participants: changes.participants ?? base.participants,
    weekdays: changes.weekdays ?? base.weekdays,
  });
}

function getTaskTitle(taskId: string, context: AssistantContext) {
  return context.tasks.find((task) => task.id === taskId)?.title ?? "this block";
}

function getSeriesTitle(seriesId: string, context: AssistantContext) {
  return context.recurringBlocks.find((block) => block.seriesId === seriesId)?.title ?? "this recurring block";
}

function formatWeekdayList(weekdays: number[]) {
  return sortWeekdays(weekdays)
    .map((weekday) => getWeekdayLabel(weekday))
    .join(", ");
}

export function getAssistantActionTitle(action: AssistantMutationAction) {
  if (action.kind === "create_task") {
    return "Create block";
  }

  if (action.kind === "batch_create_tasks") {
    return "Create balanced schedule";
  }

  if (action.kind === "update_task") {
    return "Update block";
  }

  if (action.kind === "reschedule_task") {
    return "Reschedule block";
  }

  if (action.kind === "toggle_task_status") {
    return action.status === "completed" ? "Mark complete" : "Reopen block";
  }

  if (action.kind === "delete_task") {
    return "Delete block";
  }

  if (action.kind === "update_recurring_series") {
    return "Update recurring block";
  }

  return "Delete recurring block";
}

export function getAssistantActionLines(action: AssistantMutationAction, context: AssistantContext) {
  if (action.kind === "create_task") {
    return [
      `${getTaskTypeLabel(action.values.taskType)} block: ${action.values.title}`,
      `${formatDateLabel(action.values.taskDate)} at ${formatClockTime(action.values.startTime)} to ${formatClockTime(action.values.endTime)}`,
      action.values.blockMode === "recurring"
        ? `Repeats on ${formatWeekdayList(action.values.weekdays)}`
        : "One-time block",
    ];
  }

  if (action.kind === "batch_create_tasks") {
    const scheduledLines = action.values.slice(0, 6).map(
      (value) =>
        `${formatClockTime(value.startTime)} to ${formatClockTime(value.endTime)}: ${value.title}`,
    );
    const remainingCount = action.values.length - scheduledLines.length;
    const deferredLines = action.deferredItems.slice(0, 3).map(
      (item) => `Deferred: ${item.title} (${item.reason})`,
    );

    return [
      action.headline ?? `Create ${action.values.length} planned block${action.values.length === 1 ? "" : "s"} on ${formatShortDateLabel(action.values[0]?.taskDate ?? context.currentDate)}.`,
      ...scheduledLines,
      ...(remainingCount > 0
        ? [`${remainingCount} more planned block${remainingCount === 1 ? "" : "s"} ready to add.`]
        : []),
      ...deferredLines,
    ];
  }

  if (action.kind === "update_task") {
    return [
      `Target: ${getTaskTitle(action.taskId, context)}`,
      `Changes: ${Object.keys(action.changes).join(", ") || "details"}`,
      action.recurrenceScope === "this_and_future" ? "Scope: this and future" : "Scope: this block",
    ];
  }

  if (action.kind === "reschedule_task") {
    return [
      `Target: ${getTaskTitle(action.taskId, context)}`,
      `New schedule: ${action.changes.taskDate ? formatDateLabel(action.changes.taskDate) : formatDateLabel(context.currentDate)}`,
      `${action.changes.startTime ? formatClockTime(action.changes.startTime) : "Keep start"} to ${action.changes.endTime ? formatClockTime(action.changes.endTime) : "keep end"}`,
    ];
  }

  if (action.kind === "toggle_task_status") {
    return [
      `Target: ${getTaskTitle(action.taskId, context)}`,
      action.status === "completed" ? "Status will change to completed" : "Status will change to pending",
    ];
  }

  if (action.kind === "delete_task") {
    return [
      `Target: ${getTaskTitle(action.taskId, context)}`,
      action.recurrenceScope === "this_and_future" ? "Scope: this and future" : "Scope: this block",
    ];
  }

  if (action.kind === "update_recurring_series") {
    return [
      `Series: ${getSeriesTitle(action.seriesId, context)}`,
      `From: ${formatShortDateLabel(action.fromDate ?? context.currentDate)}`,
      `Changes: ${Object.keys(action.changes).join(", ") || "details"}`,
    ];
  }

  return [
    `Series: ${getSeriesTitle(action.seriesId, context)}`,
    `From: ${formatShortDateLabel(action.fromDate ?? context.currentDate)}`,
  ];
}
