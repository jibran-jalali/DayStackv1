import "server-only";

import {
  buildTaskFormValuesFromContextTask,
  buildTaskFormValuesFromRecurringBlock,
  mergeTaskFormValues,
  normalizeAssistantTaskValues,
} from "@/lib/assistant/actions";
import {
  ceilMinutesToInterval,
  deriveDisplayName,
  formatClockTime,
  formatDateLabel,
  formatShortDateLabel,
  minutesToTime,
  shiftDate,
  toMinutes,
} from "@/lib/daystack";
import {
  createTask,
  deleteRecurringSeries,
  deleteTask,
  rescheduleTask,
  toggleTaskStatus,
  updateRecurringSeries,
  updateTask,
} from "@/lib/data/daystack";
import { getErrorMessage } from "@/lib/utils";
import type {
  AssistantAction,
  AssistantChatRequest,
  AssistantContext,
  AssistantContextRecurringBlock,
  AssistantContextTask,
  AssistantFollowUpContext,
  AssistantModelResponse,
  AssistantMutationAction,
  AssistantTaskDraft,
  AssistantVisibleTaskCandidate,
} from "@/types/assistant";
import { assistantModelResponseSchema, assistantTaskDraftSchema } from "@/types/assistant";
import type { TaskFormValues } from "@/types/daystack";

const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";

const DAYSTACK_ASSISTANT_PRIMER = `
You are DayStack Assistant, a chat-based planner assistant embedded inside the DayStack app.

Product facts:
- DayStack is a timeline-based daily planner with one-time blocks, recurring blocks, meeting blocks, blocked time, reminders, notifications, streaks, and an admin console.
- Task types: generic, meeting, blocked.
- Blocked tasks stay visible on the timeline but do not count toward the execution score.
- Meeting blocks can include a meeting link and participants.
- Recurring blocks repeat weekly on selected weekdays.
- The selected day in the UI is the assistant's active planner context.

Your job:
- Answer product/help questions clearly.
- Propose planner changes using the provided structured action types.
- Use only task IDs and recurring series IDs that appear in the provided context.
- If a request is ambiguous, missing critical details, or targets something not visible in context, ask a follow-up question instead of guessing.

Action rules:
- answer_only: for pure guidance or explanation.
- ask_followup: for any missing detail, ambiguous target, or unsafe request.
- create_task: only when title, taskDate, startTime, endTime, and taskType are all known.
- update_task: for content/detail changes to an existing visible task.
- reschedule_task: for moving a visible task to a new date and/or time.
- toggle_task_status: for marking a visible task completed or pending.
- delete_task: for removing a visible task. Use recurrenceScope this_and_future only when the user clearly wants the recurring series from this occurrence onward.
- update_recurring_series: for editing a visible recurring series from a date onward.
- delete_recurring_series: for deleting a visible recurring series from a date onward.

Important constraints:
- Never invent IDs.
- Never invent tasks outside the provided context.
- If the user asks to change recurrence mode between one-time and recurring, ask a follow-up instead of forcing a conversion.
- If a recurring action needs a scope choice and the user did not make it clear, ask a follow-up.
- Return JSON only. No markdown, no code fences, no prose outside JSON.
- Always return an object with exactly two keys: reply and action.
- The reply should be concise and natural.
- For mutation actions, the reply should summarize the planned change and make it clear that the app will ask for confirmation before applying it.

Example answer-only response:
{
  "reply": "Blocked time keeps space on the timeline, but it does not count toward your execution score.",
  "action": {
    "kind": "answer_only"
  }
}

Example follow-up response:
{
  "reply": "I can do that, but I need to know which visible block you want me to move.",
  "action": {
    "kind": "ask_followup",
    "question": "Which visible block should I move?"
  }
}
`.trim();

const WEEKDAY_PATTERNS = [
  { pattern: /\b(?:sun|sunday)\b/i, value: 0 },
  { pattern: /\b(?:mon|monday)\b/i, value: 1 },
  { pattern: /\b(?:tue|tues|tuesday)\b/i, value: 2 },
  { pattern: /\b(?:wed|weds|wednesday)\b/i, value: 3 },
  { pattern: /\b(?:thu|thur|thurs|thursday)\b/i, value: 4 },
  { pattern: /\b(?:fri|friday)\b/i, value: 5 },
  { pattern: /\b(?:sat|saturday)\b/i, value: 6 },
] as const;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "block",
  "blocks",
  "create",
  "delete",
  "for",
  "from",
  "help",
  "it",
  "make",
  "move",
  "my",
  "on",
  "please",
  "put",
  "remove",
  "schedule",
  "task",
  "tasks",
  "the",
  "this",
  "to",
  "update",
]);

type RoutedIntent =
  | "brain_dump_schedule"
  | "create_task"
  | "delete_task"
  | "fallback"
  | "help_explanation"
  | "reschedule_task"
  | "today_summary"
  | "toggle_task_status"
  | "update_task";

type TaskSelectionIntent = "delete_task" | "reschedule_task" | "toggle_task_status" | "update_task";

interface ParsedBrainDumpItem {
  durationMinutes: number;
  priority: number;
  taskType: TaskFormValues["taskType"];
  title: string;
}

function createAssistantResponse(reply: string, action: AssistantAction): AssistantModelResponse {
  return assistantModelResponseSchema.parse({
    action,
    reply,
  });
}

function createAnswerOnly(reply: string) {
  return createAssistantResponse(reply, {
    kind: "answer_only",
  });
}

function createFollowUp(question: string, followUp?: AssistantFollowUpContext) {
  return createAssistantResponse(question, {
    followUp,
    kind: "ask_followup",
    question,
  });
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function trimTrailingPunctuation(value: string) {
  return value.replace(/^[\s,.;:!?\-]+|[\s,.;:!?\-]+$/g, "").trim();
}

function sortTasksByTime(tasks: AssistantContextTask[]) {
  return [...tasks].sort((left, right) => {
    const byStart = toMinutes(left.startTime) - toMinutes(right.startTime);

    if (byStart !== 0) {
      return byStart;
    }

    return toMinutes(left.endTime) - toMinutes(right.endTime);
  });
}

function getWeekdayFromDateKey(taskDate: string) {
  return new Date(`${taskDate}T00:00:00`).getDay();
}

function inferMeridiemHint(message: string): "am" | "pm" | undefined {
  if (/\b(afternoon|evening|tonight|pm)\b/i.test(message)) {
    return "pm";
  }

  if (/\b(morning|am)\b/i.test(message)) {
    return "am";
  }

  return undefined;
}

function normalizeTimeToken(token: string, meridiemHint?: "am" | "pm") {
  const cleaned = token.toLowerCase().replace(/\./g, "").replace(/\s+/g, "");
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);

  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  const suffix = match[3] ?? meridiemHint ?? null;

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 24 || minutes > 59) {
    return null;
  }

  if (suffix) {
    if (hours === 12) {
      hours = suffix === "am" ? 0 : 12;
    } else if (suffix === "pm") {
      hours += 12;
    }
  } else if (hours <= 6) {
    hours += 12;
  } else if (hours === 24) {
    hours = 0;
  }

  if (hours > 23) {
    return null;
  }

  return `${`${hours}`.padStart(2, "0")}:${`${minutes}`.padStart(2, "0")}`;
}

function extractTimeRange(message: string) {
  const hint = inferMeridiemHint(message);
  const match = message.match(
    /\b(?:from\s+)?(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)(?:\s*)(?:-|–|to|until|through|till)(?:\s*)(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)\b/i,
  );

  if (!match) {
    return null;
  }

  const startTime = normalizeTimeToken(match[1], hint);
  const endTime = normalizeTimeToken(match[2], hint);

  if (!startTime || !endTime || endTime <= startTime) {
    return null;
  }

  return {
    endTime,
    startTime,
  };
}

function extractStandaloneTime(message: string) {
  if (/^\s*\d/.test(message.trim())) {
    return normalizeTimeToken(trimTrailingPunctuation(message), inferMeridiemHint(message));
  }

  const match = message.match(
    /\b(?:at|around|by|start(?:ing)?(?:\sat)?|end(?:ing)?(?:\sat)?)\s+(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)\b/i,
  );

  if (!match) {
    return null;
  }

  return normalizeTimeToken(match[1], inferMeridiemHint(message));
}

function extractDurationMinutes(message: string) {
  const match = message.match(/\bfor\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|min|m)\b/i);

  if (!match) {
    return null;
  }

  const amount = Number(match[1]);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return /h/i.test(match[2]) ? Math.round(amount * 60) : Math.round(amount);
}

function extractDateFromMessage(message: string, context: AssistantContext) {
  const explicitDate = message.match(/\b(\d{4}-\d{2}-\d{2})\b/);

  if (explicitDate) {
    return explicitDate[1];
  }

  if (/\bday after tomorrow\b/i.test(message)) {
    return shiftDate(context.currentDate, 2);
  }

  if (/\btomorrow\b/i.test(message)) {
    return shiftDate(context.currentDate, 1);
  }

  if (/\b(today|tonight)\b/i.test(message)) {
    return context.currentDate;
  }

  const baseWeekday = getWeekdayFromDateKey(context.currentDate);

  for (const weekday of WEEKDAY_PATTERNS) {
    if (!weekday.pattern.test(message)) {
      continue;
    }

    let offset = (weekday.value - baseWeekday + 7) % 7;

    if (new RegExp(`\\bnext\\s+${weekday.pattern.source.replace(/^\\b|\\b$/g, "")}`, "i").test(message)) {
      offset = offset === 0 ? 7 : offset;
    }

    return shiftDate(context.currentDate, offset);
  }

  return null;
}

function extractWeekdays(message: string) {
  if (/\b(every day|daily)\b/i.test(message)) {
    return [0, 1, 2, 3, 4, 5, 6];
  }

  if (/\b(weekdays|workdays)\b/i.test(message)) {
    return [1, 2, 3, 4, 5];
  }

  if (/\b(weekends|weekend)\b/i.test(message)) {
    return [0, 6];
  }

  return [...new Set(WEEKDAY_PATTERNS.flatMap((weekday) => (weekday.pattern.test(message) ? [weekday.value] : [])))].sort(
    (left, right) => left - right,
  );
}

function inferTaskType(
  message: string,
  fallback: TaskFormValues["taskType"] = "generic",
): TaskFormValues["taskType"] {
  if (/\b(meeting|call|zoom|sync|standup|1:1|one on one|interview)\b/i.test(message)) {
    return "meeting";
  }

  if (/\b(blocked time|hold time|buffer|unavailable|lunch|break|travel|commute)\b/i.test(message)) {
    return "blocked";
  }

  return fallback;
}

function inferBlockMode(message: string, fallback: TaskFormValues["blockMode"] = "one_time") {
  return /\b(recurring|repeat|repeats|every|daily|weekdays|weekends|weekly)\b/i.test(message)
    ? "recurring"
    : fallback;
}

function extractMeetingLink(message: string) {
  const match = message.match(/https?:\/\/\S+/i);
  return match ? trimTrailingPunctuation(match[0]) : undefined;
}

function sanitizeTaskTitle(rawTitle: string) {
  const cleaned = trimTrailingPunctuation(rawTitle)
    .replace(/\s+/g, " ")
    .replace(/^(?:a|an|the)\s+/i, "")
    .trim();

  return cleaned.length > 0 ? cleaned.slice(0, 120) : null;
}

function extractRenameTitle(message: string) {
  const match = message.match(
    /\b(?:rename|call it|change (?:the )?title to|update (?:the )?title to)\s+["“']?(.+?)["”']?\s*$/i,
  );

  return match?.[1] ? sanitizeTaskTitle(match[1]) : null;
}

function extractTaskTitle(message: string) {
  const quoted = message.match(/["“']([^"”']+)["”']/);

  if (quoted?.[1]) {
    return sanitizeTaskTitle(quoted[1]);
  }

  const renameTitle = extractRenameTitle(message);

  if (renameTitle) {
    return renameTitle;
  }

  let candidate = message
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/\b(today|tomorrow|tonight|day after tomorrow)\b/gi, " ")
    .replace(/\b(?:next|this)\s+(?:mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday)\b/gi, " ")
    .replace(/\b(?:from\s+)?\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?(?:\s*)(?:-|–|to|until|through|till)(?:\s*)\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?\b/gi, " ")
    .replace(/\b(?:at|around|by|start(?:ing)?(?:\sat)?|end(?:ing)?(?:\sat)?|for)\s+\d+(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|hours?|hrs?|minutes?|mins?|min|m)\b/gi, " ")
    .replace(/\b(recurring|repeat|repeats|every|daily|weekdays|weekends|weekly)\b/gi, " ")
    .replace(/\b(create|add|schedule|book|set up|make|plan|put|delete|remove|move|reschedule|mark|rename|help me|can you|please)\b/gi, " ")
    .replace(/\b(my|the|this|that|a|an)\b/gi, " ");

  candidate = candidate.replace(/\s+/g, " ").trim();
  return sanitizeTaskTitle(candidate);
}

function extractTaskDraftFromMessage(
  message: string,
  context: AssistantContext,
  baseDraft?: AssistantTaskDraft,
): Partial<AssistantTaskDraft> {
  const nextDraft: Partial<AssistantTaskDraft> = {
    blockMode: inferBlockMode(message, baseDraft?.blockMode ?? "one_time"),
    meetingLink: extractMeetingLink(message),
    taskType: inferTaskType(message, baseDraft?.taskType ?? "generic"),
    taskDate: extractDateFromMessage(message, context) ?? baseDraft?.taskDate,
    title: extractTaskTitle(message) ?? baseDraft?.title,
  };
  const timeRange = extractTimeRange(message);
  const singleTime = extractStandaloneTime(message);
  const durationMinutes = extractDurationMinutes(message);
  const weekdays = extractWeekdays(message);

  if (timeRange) {
    nextDraft.startTime = timeRange.startTime;
    nextDraft.endTime = timeRange.endTime;
  } else if (singleTime) {
    if (!baseDraft?.startTime) {
      nextDraft.startTime = singleTime;
    } else if (!baseDraft.endTime) {
      nextDraft.endTime = singleTime;
    }
  }

  if (!nextDraft.endTime && durationMinutes) {
    const startTime = nextDraft.startTime ?? baseDraft?.startTime;

    if (startTime) {
      nextDraft.endTime = minutesToTime(toMinutes(startTime) + durationMinutes);
    }
  }

  if (nextDraft.blockMode === "recurring" && weekdays.length > 0) {
    nextDraft.weekdays = weekdays;
  }

  return nextDraft;
}

function mergeTaskDrafts(baseDraft: AssistantTaskDraft, incomingDraft: Partial<AssistantTaskDraft>) {
  return assistantTaskDraftSchema.parse({
    ...baseDraft,
    ...incomingDraft,
    participants: incomingDraft.participants ?? baseDraft.participants,
    weekdays: incomingDraft.weekdays ?? baseDraft.weekdays,
  });
}

function getNextMissingCreateField(draft: AssistantTaskDraft) {
  if (!draft.title) {
    return "title" as const;
  }

  if (!draft.startTime) {
    return "startTime" as const;
  }

  if (!draft.endTime) {
    return "endTime" as const;
  }

  if (draft.blockMode === "recurring" && (!draft.weekdays || draft.weekdays.length === 0)) {
    return "weekdays" as const;
  }

  return null;
}

function buildCreateFollowUpQuestion(field: ReturnType<typeof getNextMissingCreateField>) {
  if (field === "title") {
    return "What should I call the block?";
  }

  if (field === "startTime") {
    return "What time should it start?";
  }

  if (field === "endTime") {
    return "What time should it end?";
  }

  return "Which weekdays should it repeat on?";
}

function finalizeTaskDraft(draft: AssistantTaskDraft, context: AssistantContext): TaskFormValues {
  return normalizeAssistantTaskValues({
    blockMode: draft.blockMode ?? "one_time",
    endTime: draft.endTime ?? "10:00",
    meetingLink: draft.meetingLink ?? "",
    participants: draft.participants ?? [],
    startTime: draft.startTime ?? "09:00",
    taskDate: draft.taskDate ?? context.currentDate,
    taskType: draft.taskType ?? "generic",
    title: draft.title ?? "Untitled block",
    weekdays: draft.weekdays ?? [],
  });
}

function mapTaskCandidate(task: AssistantContextTask): AssistantVisibleTaskCandidate {
  return {
    endTime: task.endTime,
    id: task.id,
    startTime: task.startTime,
    taskDate: task.taskDate,
    taskType: task.taskType,
    title: task.title,
  };
}

function describeCandidate(candidate: AssistantVisibleTaskCandidate) {
  return `${candidate.title} (${formatClockTime(candidate.startTime)} to ${formatClockTime(candidate.endTime)})`;
}

function getTaskTypePool(tasks: AssistantContextTask[], message: string) {
  if (/\b(meeting|call|zoom|sync|standup|1:1)\b/i.test(message)) {
    const meetingTasks = tasks.filter((task) => task.taskType === "meeting");
    return meetingTasks.length > 0 ? meetingTasks : tasks;
  }

  if (/\b(blocked|buffer|lunch|break|travel|commute)\b/i.test(message)) {
    const blockedTasks = tasks.filter((task) => task.taskType === "blocked");
    return blockedTasks.length > 0 ? blockedTasks : tasks;
  }

  return tasks;
}

function scoreTaskMatch(task: AssistantContextTask, message: string, orderedTasks: AssistantContextTask[]) {
  const normalizedMessage = normalizeText(message);
  const normalizedTitle = normalizeText(task.title);
  const messageTokens = new Set(tokenize(message));
  let score = 0;

  if (normalizedTitle && normalizedMessage.includes(normalizedTitle)) {
    score += 10;
  }

  for (const token of tokenize(task.title)) {
    if (messageTokens.has(token)) {
      score += 3;
    }
  }

  if (orderedTasks[0]?.id === task.id && /\b(first|earliest|morning)\b/i.test(message)) {
    score += 5;
  }

  if (orderedTasks[orderedTasks.length - 1]?.id === task.id && /\b(last|latest|final)\b/i.test(message)) {
    score += 5;
  }

  return score;
}

function matchVisibleTasks(message: string, context: AssistantContext) {
  const visibleTasks = getTaskTypePool(sortTasksByTime(context.tasks), message);

  if (visibleTasks.length === 0) {
    return {
      candidates: [] as AssistantContextTask[],
      selected: null as AssistantContextTask | null,
    };
  }

  if (visibleTasks.length === 1) {
    return {
      candidates: visibleTasks,
      selected: visibleTasks[0],
    };
  }

  const scored = visibleTasks
    .map((task) => ({
      score: scoreTaskMatch(task, message, visibleTasks),
      task,
    }))
    .sort((left, right) => right.score - left.score);
  const positiveMatches = scored.filter((item) => item.score > 0).map((item) => item.task);

  if (positiveMatches.length === 1) {
    return {
      candidates: positiveMatches,
      selected: positiveMatches[0],
    };
  }

  if (scored[0] && scored[0].score >= 8 && (!scored[1] || scored[0].score >= scored[1].score + 2)) {
    return {
      candidates: [scored[0].task],
      selected: scored[0].task,
    };
  }

  return {
    candidates: (positiveMatches.length > 0 ? positiveMatches : visibleTasks).slice(0, 6),
    selected: null,
  };
}

function buildCandidateQuestion(intent: TaskSelectionIntent, candidates: AssistantVisibleTaskCandidate[], detail?: string) {
  const verb =
    intent === "delete_task"
      ? "delete"
      : intent === "toggle_task_status"
        ? "update"
        : intent === "reschedule_task"
          ? "move"
          : "change";
  const intro = detail ?? `I found a few visible matches. Which one should I ${verb}?`;
  const lines = candidates.slice(0, 4).map((candidate, index) => `${index + 1}. ${describeCandidate(candidate)}`);
  return `${intro}\n${lines.join("\n")}`.slice(0, 500);
}

function resolveCandidateFromFollowUp(message: string, candidates: AssistantVisibleTaskCandidate[]) {
  if (candidates.length === 1) {
    return candidates[0];
  }

  if (/\bfirst\b/i.test(message)) {
    return candidates[0] ?? null;
  }

  if (/\bsecond\b/i.test(message)) {
    return candidates[1] ?? null;
  }

  if (/\bthird\b/i.test(message)) {
    return candidates[2] ?? null;
  }

  if (/\blast\b/i.test(message)) {
    return candidates[candidates.length - 1] ?? null;
  }

  const ordinalMatch = message.match(/^\s*(\d)\b/);

  if (ordinalMatch) {
    return candidates[Number(ordinalMatch[1]) - 1] ?? null;
  }

  const normalizedMessage = normalizeText(message);

  return (
    candidates.find((candidate) => normalizedMessage.includes(normalizeText(candidate.title))) ?? null
  );
}

function extractRequestedStatus(message: string) {
  if (/\b(reopen|undo|pending|unfinished)\b/i.test(message)) {
    return "pending" as const;
  }

  if (/\b(done|complete|completed|finish|finished|check off)\b/i.test(message)) {
    return "completed" as const;
  }

  return null;
}

function inferRecurringScope(message: string) {
  return /\b(this and future|future ones|all future|from now on|going forward|entire series|whole series)\b/i.test(
    message,
  )
    ? "this_and_future"
    : "occurrence_only";
}

function buildTodaySummaryResponse(context: AssistantContext) {
  const actionableTasks = sortTasksByTime(context.tasks).filter((task) => task.taskType !== "blocked");
  const pendingTasks = actionableTasks.filter((task) => task.status === "pending");
  const blockedCount = context.tasks.filter((task) => task.taskType === "blocked").length;
  const nextTask = pendingTasks[0];
  const pendingPreview = pendingTasks.slice(0, 3).map((task) => task.title).join(", ");
  const reply = [
    `${formatShortDateLabel(context.currentDate)}: ${context.summary.summaryLine}`,
    `Execution score is ${context.summary.executionScore}/100 with ${context.summary.completedTasks} of ${context.summary.totalTasks} actionable blocks done.`,
    nextTask
      ? `Next up is "${nextTask.title}" at ${formatClockTime(nextTask.startTime)}.${pendingTasks.length > 1 ? ` Still left after that: ${pendingPreview}.` : ""}`
      : "There is nothing actionable left on the selected day.",
    blockedCount > 0
      ? `${blockedCount} blocked-time block${blockedCount === 1 ? "" : "s"} are still holding space on the timeline.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return createAnswerOnly(reply);
}

function extractLocalHelpReply(message: string) {
  if (/\bwhat can you do\b|\bhelp\b/i.test(message)) {
    return "I can add blocks, move or delete visible ones, mark them done, summarize the selected day, and turn a task dump into a balanced draft schedule before anything is added.";
  }

  if (/\b(recurring|repeat)\b/i.test(message)) {
    return "Recurring blocks repeat weekly on the weekdays you choose. When you edit a visible recurring occurrence, DayStack can update just that block or carry the change forward from that point.";
  }

  if (/\b(blocked time|blocked|hold time)\b/i.test(message)) {
    return "Blocked time reserves space on the timeline without counting toward your execution score. It is useful for focus time, lunch, travel, or any protected buffer.";
  }

  if (/\b(reminder|reminders|notification|notifications)\b/i.test(message)) {
    return "Reminders follow your scheduled blocks, and notifications track planner activity like mentions and shared task updates. The daily summary and streak focus on actionable work rather than blocked time.";
  }

  if (/\b(meeting|participants|meeting link)\b/i.test(message)) {
    return "Meeting blocks can store a link and participants while still behaving like normal planner blocks. Owner-side updates can also sync to accepted copies when that propagation mode is used.";
  }

  return null;
}

function countPotentialListItems(message: string) {
  const lines = message
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*0-9.)]+\s*/, "").trim())
    .filter(Boolean);

  if (lines.length >= 2) {
    return lines.length;
  }

  return message
    .split(/[;,]/)
    .map((part) => trimTrailingPunctuation(part))
    .filter((part) => part.length > 3).length;
}

function isBrainDumpRequest(message: string) {
  return (
    /\b(brain dump|dump my tasks|prioriti[sz]e|organi[sz]e|balance my schedule|plan my day|arrange these|fit these in|turn this into a schedule)\b/i.test(
      message,
    ) || countPotentialListItems(message) >= 3
  );
}

function inferDurationMinutes(title: string) {
  if (/\b(email|reply|message|invoice|bill|admin|cleanup)\b/i.test(title)) {
    return 30;
  }

  if (/\b(workout|gym|deep work|study|write|design|report|presentation|slides|coding|build)\b/i.test(title)) {
    return 90;
  }

  if (/\b(read|review|prep|prepare|plan|research|meeting|call|sync)\b/i.test(title)) {
    return 60;
  }

  return 45;
}

function inferPriority(title: string) {
  if (/\b(urgent|asap|critical|important|must|priority)\b/i.test(title)) {
    return 3;
  }

  if (/\b(later|maybe|optional|if possible)\b/i.test(title)) {
    return 1;
  }

  return 2;
}

function parseBrainDumpItems(message: string) {
  const source = message.includes(":") ? message.split(":").slice(1).join(":") : message;
  const parts =
    source.split(/\r?\n/).filter((line) => line.trim().length > 0).length >= 2
      ? source.split(/\r?\n/)
      : source.split(/[;,]/);

  return parts
    .map((part) => part.replace(/^\s*[-*0-9.)]+\s*/, "").trim())
    .filter(Boolean)
    .map((part) => {
      const title = extractTaskTitle(part) ?? sanitizeTaskTitle(part);

      if (!title) {
        return null;
      }

      return {
        durationMinutes: extractDurationMinutes(part) ?? inferDurationMinutes(part),
        priority: inferPriority(part),
        taskType: inferTaskType(part, "generic"),
        title,
      } satisfies ParsedBrainDumpItem;
    })
    .filter((item): item is ParsedBrainDumpItem => item !== null);
}

function buildFreeWindows(context: AssistantContext) {
  const busyIntervals = sortTasksByTime(context.tasks).map((task) => ({
    end: toMinutes(task.endTime),
    start: toMinutes(task.startTime),
  }));
  const windows: Array<{ end: number; start: number }> = [];
  let cursor = 8 * 60;

  for (const interval of busyIntervals) {
    if (interval.start > cursor) {
      windows.push({
        end: interval.start,
        start: cursor,
      });
    }

    cursor = Math.max(cursor, interval.end);
  }

  if (cursor < 21 * 60) {
    windows.push({
      end: 21 * 60,
      start: cursor,
    });
  }

  return windows.map((window) => ({
    end: ceilMinutesToInterval(window.end, 15),
    start: ceilMinutesToInterval(window.start, 15),
  }));
}

function buildBrainDumpScheduleResponse(message: string, context: AssistantContext) {
  const items = parseBrainDumpItems(message);

  if (items.length === 0) {
    return createFollowUp(
      "Paste the tasks you want me to organize, ideally one per line. If you already know any durations, include them too.",
    );
  }

  const windows = buildFreeWindows(context);
  const values: TaskFormValues[] = [];
  const deferredItems: Array<{ reason: string; title: string }> = [];

  for (const item of [...items].sort((left, right) => right.priority - left.priority || left.durationMinutes - right.durationMinutes)) {
    const window = windows.find((candidate) => candidate.end - candidate.start >= item.durationMinutes);

    if (!window) {
      deferredItems.push({
        reason: "No realistic room was left in the current day.",
        title: item.title,
      });
      continue;
    }

    const startTime = minutesToTime(window.start);
    const endTime = minutesToTime(window.start + item.durationMinutes);

    values.push(
      normalizeAssistantTaskValues({
        blockMode: "one_time",
        endTime,
        meetingLink: "",
        participants: [],
        startTime,
        taskDate: context.currentDate,
        taskType: item.taskType,
        title: item.title,
        weekdays: [],
      }),
    );

    window.start = ceilMinutesToInterval(window.start + item.durationMinutes + 15, 15);
  }

  if (values.length === 0) {
    return createFollowUp(
      `Your selected day already looks full. I couldn't fit those tasks into ${formatDateLabel(context.currentDate)} without overpacking it.`,
    );
  }

  const headline = `I turned your task dump into ${values.length} focused block${values.length === 1 ? "" : "s"} for ${formatShortDateLabel(context.currentDate)} and deferred ${deferredItems.length} item${deferredItems.length === 1 ? "" : "s"} so the day stays realistic.`;

  return createAssistantResponse(`${headline} Review the draft schedule and confirm it if it looks right.`, {
    deferredItems,
    headline,
    kind: "batch_create_tasks",
    values,
  });
}

function looksLikeSummaryRequest(message: string) {
  return /\b(summary|recap|how did i do|how am i doing|what's left|whats left|what is left|what do i have left)\b/i.test(
    message,
  );
}

function looksLikeDeleteRequest(message: string) {
  return /\b(delete|remove|cancel)\b/i.test(message);
}

function looksLikeToggleRequest(message: string) {
  return /\b(mark|set|reopen|undo)\b/i.test(message) && /\b(done|complete|completed|pending|unfinished)\b/i.test(message);
}

function looksLikeRescheduleRequest(message: string) {
  return /\b(move|reschedule|shift|push|retime)\b/i.test(message) || /\b(minutes?|hours?)\s*(later|earlier)\b/i.test(message);
}

function looksLikeUpdateRequest(message: string) {
  return /\b(rename|call it|change (?:the )?title|update (?:the )?title)\b/i.test(message);
}

function looksLikeCreateRequest(message: string) {
  return /\b(create|add|schedule|book|set up|make|plan|put)\b/i.test(message);
}

function classifyIntent(message: string): RoutedIntent {
  if (looksLikeSummaryRequest(message)) {
    return "today_summary";
  }

  if (isBrainDumpRequest(message)) {
    return "brain_dump_schedule";
  }

  if (looksLikeDeleteRequest(message)) {
    return "delete_task";
  }

  if (looksLikeToggleRequest(message)) {
    return "toggle_task_status";
  }

  if (looksLikeRescheduleRequest(message)) {
    return "reschedule_task";
  }

  if (looksLikeUpdateRequest(message)) {
    return "update_task";
  }

  if (looksLikeCreateRequest(message)) {
    return "create_task";
  }

  if (/\b(how|what|why|explain|guide|walk me through|what can you do)\b/i.test(message)) {
    return "help_explanation";
  }

  return "fallback";
}

function extractRescheduleChanges(message: string, task: AssistantContextTask | null) {
  const timeRange = extractTimeRange(message);
  const taskContext =
    task === null
      ? null
      : {
          currentDate: task.taskDate,
          currentTimeIso: new Date().toISOString(),
          recurringBlocks: [],
          streak: 0,
          summary: {
            completedTasks: 0,
            completionRate: 0,
            executionScore: 0,
            incompleteTasks: 0,
            successfulDay: false,
            summaryLine: "Single-task context",
            totalTasks: 0,
          },
          tasks: [task],
          timezone: "UTC",
        } satisfies AssistantContext;
  const changes: { endTime?: string; startTime?: string; taskDate?: string } = {};

  if (timeRange) {
    changes.startTime = timeRange.startTime;
    changes.endTime = timeRange.endTime;
  } else if (task) {
    const singleTime = extractStandaloneTime(message);
    const shiftMatch = message.match(/\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|min|m)\s*(later|earlier)\b/i);

    if (shiftMatch) {
      const amount = Number(shiftMatch[1]);
      const delta = /h/i.test(shiftMatch[2]) ? Math.round(amount * 60) : Math.round(amount);
      const signedDelta = shiftMatch[3].toLowerCase() === "earlier" ? delta * -1 : delta;
      changes.startTime = minutesToTime(toMinutes(task.startTime) + signedDelta);
      changes.endTime = minutesToTime(toMinutes(task.endTime) + signedDelta);
    } else if (singleTime) {
      const duration = toMinutes(task.endTime) - toMinutes(task.startTime);
      changes.startTime = singleTime;
      changes.endTime = minutesToTime(toMinutes(singleTime) + duration);
    }
  }

  if (taskContext) {
    const nextDate = extractDateFromMessage(message, taskContext);

    if (nextDate) {
      changes.taskDate = nextDate;
    }
  }

  return Object.values(changes).some((value) => value !== undefined) ? changes : null;
}

function extractUpdateChanges(message: string) {
  const changes: {
    meetingLink?: string | null;
    taskType?: TaskFormValues["taskType"];
    title?: string;
  } = {};
  const renamedTitle = extractRenameTitle(message);

  if (renamedTitle) {
    changes.title = renamedTitle;
  }

  const meetingLink = extractMeetingLink(message);

  if (meetingLink) {
    changes.meetingLink = meetingLink;
    changes.taskType = "meeting";
  }

  if (/\bmake (?:it )?blocked\b/i.test(message)) {
    changes.taskType = "blocked";
  } else if (/\bmake (?:it )?(?:a )?meeting\b/i.test(message)) {
    changes.taskType = "meeting";
  } else if (/\bmake (?:it )?(?:a )?(?:normal|generic)\b/i.test(message)) {
    changes.taskType = "generic";
  }

  return Object.values(changes).some((value) => value !== undefined) ? changes : null;
}

function buildCreateTaskResponse(message: string, context: AssistantContext) {
  const draft = mergeTaskDrafts(assistantTaskDraftSchema.parse({}), extractTaskDraftFromMessage(message, context));
  const missingField = getNextMissingCreateField(draft);

  if (missingField) {
    return createFollowUp(buildCreateFollowUpQuestion(missingField), {
      draft,
      kind: "create_task",
      missingField,
    });
  }

  try {
    const values = finalizeTaskDraft(draft, context);

    return createAssistantResponse(
      `I can add "${values.title}" on ${formatDateLabel(values.taskDate)} from ${formatClockTime(values.startTime)} to ${formatClockTime(values.endTime)}. Confirm it and I will place it on the grid.`,
      {
        kind: "create_task",
        values,
      },
    );
  } catch (error) {
    return createFollowUp(`I still need a cleaner time window for that block. ${getErrorMessage(error)}`, {
      draft,
      kind: "create_task",
      missingField: draft.startTime ? "endTime" : "startTime",
    });
  }
}

function buildDeleteTaskResponse(message: string, context: AssistantContext) {
  const match = matchVisibleTasks(message, context);

  if (match.selected) {
    return createAssistantResponse(
      `I can delete "${match.selected.title}". Confirm it and I will remove it from the day.`,
      {
        kind: "delete_task",
        recurrenceScope: inferRecurringScope(message),
        taskId: match.selected.id,
      },
    );
  }

  const candidates = match.candidates.map(mapTaskCandidate);

  if (candidates.length === 0) {
    return createFollowUp("There are no visible blocks on this day to delete.");
  }

  return createFollowUp(buildCandidateQuestion("delete_task", candidates), {
    candidates,
    intent: "delete_task",
    kind: "task_selection",
    recurrenceScope: inferRecurringScope(message),
  });
}

function buildToggleTaskStatusResponse(message: string, context: AssistantContext) {
  const status = extractRequestedStatus(message);

  if (!status) {
    return createFollowUp("Should I mark it complete or move it back to pending?");
  }

  const match = matchVisibleTasks(message, context);

  if (match.selected) {
    return createAssistantResponse(
      status === "completed"
        ? `I can mark "${match.selected.title}" complete. Confirm it and I will update the day.`
        : `I can reopen "${match.selected.title}". Confirm it and I will update the day.`,
      {
        kind: "toggle_task_status",
        status,
        taskId: match.selected.id,
      },
    );
  }

  const candidates = match.candidates.map(mapTaskCandidate);

  if (candidates.length === 0) {
    return createFollowUp("There are no visible blocks on this day to update.");
  }

  return createFollowUp(buildCandidateQuestion("toggle_task_status", candidates), {
    candidates,
    intent: "toggle_task_status",
    kind: "task_selection",
    status,
  });
}

function buildRescheduleTaskResponse(message: string, context: AssistantContext) {
  const match = matchVisibleTasks(message, context);
  const changes = match.selected ? extractRescheduleChanges(message, match.selected) : null;

  if (match.selected && changes) {
    return createAssistantResponse(
      `I can move "${match.selected.title}" to the new schedule you asked for. Confirm it and I will update the day.`,
      {
        changes,
        kind: "reschedule_task",
        recurrenceScope: inferRecurringScope(message),
        taskId: match.selected.id,
      },
    );
  }

  const candidates = match.candidates.map(mapTaskCandidate);

  if (!match.selected && candidates.length === 0) {
    return createFollowUp("There are no visible blocks on this day to move.");
  }

  return createFollowUp(
    match.selected
      ? `What time or date should I move "${match.selected.title}" to?`
      : buildCandidateQuestion(
          "reschedule_task",
          candidates,
          changes ? "I have the new timing. Which visible block should I move?" : undefined,
        ),
    {
      candidates: match.selected ? [mapTaskCandidate(match.selected)] : candidates,
      changes: changes ?? undefined,
      intent: "reschedule_task",
      kind: "task_selection",
      recurrenceScope: inferRecurringScope(message),
    },
  );
}

function buildUpdateTaskResponse(message: string, context: AssistantContext) {
  const match = matchVisibleTasks(message, context);
  const changes = extractUpdateChanges(message);

  if (match.selected && changes) {
    return createAssistantResponse(
      `I can update "${match.selected.title}" with those details. Confirm it and I will apply the change.`,
      {
        changes,
        kind: "update_task",
        recurrenceScope: inferRecurringScope(message),
        taskId: match.selected.id,
      },
    );
  }

  const candidates = match.candidates.map(mapTaskCandidate);

  if (!match.selected && candidates.length === 0) {
    return createFollowUp("There are no visible blocks on this day to change.");
  }

  return createFollowUp(
    match.selected ? `What should I change on "${match.selected.title}"?` : buildCandidateQuestion("update_task", candidates),
    {
      candidates: match.selected ? [mapTaskCandidate(match.selected)] : candidates,
      changes: changes ?? undefined,
      intent: "update_task",
      kind: "task_selection",
      recurrenceScope: inferRecurringScope(message),
    },
  );
}

function handleCreateTaskFollowUp(
  message: string,
  followUp: Extract<AssistantFollowUpContext, { kind: "create_task" }>,
  context: AssistantContext,
) {
  let nextDraft = mergeTaskDrafts(followUp.draft, extractTaskDraftFromMessage(message, context, followUp.draft));

  if (followUp.missingField === "title" && !nextDraft.title) {
    const title = sanitizeTaskTitle(message);

    if (title) {
      nextDraft = mergeTaskDrafts(nextDraft, {
        title,
      });
    }
  }

  if (followUp.missingField === "weekdays" && (!nextDraft.weekdays || nextDraft.weekdays.length === 0)) {
    const weekdays = extractWeekdays(message);

    if (weekdays.length > 0) {
      nextDraft = mergeTaskDrafts(nextDraft, {
        weekdays,
      });
    }
  }

  const missingField = getNextMissingCreateField(nextDraft);

  if (missingField) {
    return createFollowUp(buildCreateFollowUpQuestion(missingField), {
      draft: nextDraft,
      kind: "create_task",
      missingField,
    });
  }

  const values = finalizeTaskDraft(nextDraft, context);

  return createAssistantResponse(
    `I can add "${values.title}" on ${formatDateLabel(values.taskDate)} from ${formatClockTime(values.startTime)} to ${formatClockTime(values.endTime)}. Confirm it and I will place it on the grid.`,
    {
      kind: "create_task",
      values,
    },
  );
}

function handleTaskSelectionFollowUp(
  message: string,
  followUp: Extract<AssistantFollowUpContext, { kind: "task_selection" }>,
  context: AssistantContext,
) {
  const selectedCandidate = resolveCandidateFromFollowUp(message, followUp.candidates);
  const selectedTask = selectedCandidate
    ? context.tasks.find((task) => task.id === selectedCandidate.id) ?? null
    : null;

  if (!selectedCandidate) {
    const nextChanges =
      followUp.intent === "reschedule_task"
        ? extractRescheduleChanges(message, null)
        : followUp.intent === "update_task"
          ? extractUpdateChanges(message)
          : null;

    return createFollowUp(
      buildCandidateQuestion(
        followUp.intent,
        followUp.candidates,
        nextChanges ? "I have the update details. Which visible block should I use?" : undefined,
      ),
      {
        ...followUp,
        changes: nextChanges ?? followUp.changes,
      },
    );
  }

  if (followUp.intent === "delete_task") {
    return createAssistantResponse(
      `I can delete "${selectedCandidate.title}". Confirm it and I will remove it from the day.`,
      {
        kind: "delete_task",
        recurrenceScope: followUp.recurrenceScope ?? "occurrence_only",
        taskId: selectedCandidate.id,
      },
    );
  }

  if (followUp.intent === "toggle_task_status") {
    const status = followUp.status ?? extractRequestedStatus(message);

    if (!status) {
      return createFollowUp(`Should I mark "${selectedCandidate.title}" complete or move it back to pending?`, {
        ...followUp,
        candidates: [selectedCandidate],
      });
    }

    return createAssistantResponse(
      status === "completed"
        ? `I can mark "${selectedCandidate.title}" complete. Confirm it and I will update the day.`
        : `I can reopen "${selectedCandidate.title}". Confirm it and I will update the day.`,
      {
        kind: "toggle_task_status",
        status,
        taskId: selectedCandidate.id,
      },
    );
  }

  if (followUp.intent === "reschedule_task") {
    const nextChanges = {
      ...(followUp.changes ?? {}),
      ...(selectedTask ? extractRescheduleChanges(message, selectedTask) ?? {} : {}),
    };

    if (!Object.values(nextChanges).some((value) => value !== undefined)) {
      return createFollowUp(`What time or date should I move "${selectedCandidate.title}" to?`, {
        ...followUp,
        candidates: [selectedCandidate],
      });
    }

    return createAssistantResponse(
      `I can move "${selectedCandidate.title}" to the new schedule you picked. Confirm it and I will update the day.`,
      {
        changes: nextChanges,
        kind: "reschedule_task",
        recurrenceScope: followUp.recurrenceScope ?? "occurrence_only",
        taskId: selectedCandidate.id,
      },
    );
  }

  const nextChanges = {
    ...(followUp.changes ?? {}),
    ...(extractUpdateChanges(message) ?? {}),
  };

  if (!Object.values(nextChanges).some((value) => value !== undefined)) {
    return createFollowUp(`What should I change on "${selectedCandidate.title}"?`, {
      ...followUp,
      candidates: [selectedCandidate],
    });
  }

  return createAssistantResponse(
    `I can update "${selectedCandidate.title}" with those details. Confirm it and I will apply the change.`,
    {
      changes: nextChanges,
      kind: "update_task",
      recurrenceScope: followUp.recurrenceScope ?? "occurrence_only",
      taskId: selectedCandidate.id,
    },
  );
}

function routeAssistantMessage(input: AssistantChatRequest) {
  if (input.pendingFollowUp) {
    return input.pendingFollowUp.kind === "create_task"
      ? handleCreateTaskFollowUp(input.message, input.pendingFollowUp, input.context)
      : handleTaskSelectionFollowUp(input.message, input.pendingFollowUp, input.context);
  }

  const intent = classifyIntent(input.message);

  if (intent === "today_summary") {
    return buildTodaySummaryResponse(input.context);
  }

  if (intent === "brain_dump_schedule") {
    return buildBrainDumpScheduleResponse(input.message, input.context);
  }

  if (intent === "delete_task") {
    return buildDeleteTaskResponse(input.message, input.context);
  }

  if (intent === "toggle_task_status") {
    return buildToggleTaskStatusResponse(input.message, input.context);
  }

  if (intent === "reschedule_task") {
    return buildRescheduleTaskResponse(input.message, input.context);
  }

  if (intent === "update_task") {
    return buildUpdateTaskResponse(input.message, input.context);
  }

  if (intent === "create_task") {
    return buildCreateTaskResponse(input.message, input.context);
  }

  const localHelpReply = extractLocalHelpReply(input.message);
  return localHelpReply ? createAnswerOnly(localHelpReply) : null;
}

function getGroqApiKey() {
  return process.env.GROQ_API_KEY?.trim() ?? null;
}

function getGroqModel() {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
}

function extractJsonObject(content: string) {
  const trimmed = content.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  if (fenced.startsWith("{") && fenced.endsWith("}")) {
    return fenced;
  }

  const firstBrace = fenced.indexOf("{");
  const lastBrace = fenced.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("The assistant returned a non-JSON response.");
  }

  return fenced.slice(firstBrace, lastBrace + 1);
}

function normalizeAssistantActionPayload(raw: unknown) {
  if (typeof raw === "string") {
    return {
      kind: raw,
    };
  }

  if (!raw || typeof raw !== "object") {
    return raw;
  }

  const candidate = raw as Record<string, unknown>;

  if (typeof candidate.kind === "string") {
    return candidate;
  }

  if (typeof candidate.type === "string") {
    return {
      ...candidate,
      kind: candidate.type,
    };
  }

  if (typeof candidate.action === "string") {
    return {
      ...candidate,
      kind: candidate.action,
    };
  }

  return candidate;
}

function normalizeAssistantModelPayload(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return raw;
  }

  const candidate = raw as Record<string, unknown>;
  const normalizedAction = normalizeAssistantActionPayload(
    candidate.action ?? candidate.actionPayload ?? candidate.action_data ?? candidate,
  );

  const basePayload = {
    action: normalizedAction,
    reply:
      typeof candidate.reply === "string"
        ? candidate.reply
        : typeof candidate.message === "string"
          ? candidate.message
          : typeof candidate.response === "string"
            ? candidate.response
            : "",
  } satisfies Record<string, unknown>;

  if (normalizedAction && typeof normalizedAction === "object") {
    const actionRecord = normalizedAction as Record<string, unknown>;

    if (actionRecord.kind === "ask_followup" && typeof actionRecord.question !== "string") {
      actionRecord.question =
        typeof candidate.question === "string"
          ? candidate.question
          : typeof candidate.followupQuestion === "string"
            ? candidate.followupQuestion
            : basePayload.reply;
    }

    if (actionRecord.kind === "create_task" && actionRecord.values === undefined) {
      actionRecord.values =
        candidate.values ?? candidate.task ?? candidate.taskValues ?? candidate.data ?? undefined;
    }

    if ((actionRecord.kind === "update_task" || actionRecord.kind === "update_recurring_series") && actionRecord.changes === undefined) {
      actionRecord.changes =
        candidate.changes ?? candidate.values ?? candidate.updates ?? candidate.data ?? undefined;
    }

    if (actionRecord.kind === "reschedule_task" && actionRecord.changes === undefined) {
      actionRecord.changes =
        candidate.changes ?? candidate.schedule ?? candidate.values ?? candidate.data ?? undefined;
    }

    if ((actionRecord.kind === "update_task" || actionRecord.kind === "reschedule_task" || actionRecord.kind === "delete_task" || actionRecord.kind === "toggle_task_status") && actionRecord.taskId === undefined) {
      actionRecord.taskId =
        candidate.taskId ?? candidate.targetTaskId ?? candidate.id ?? undefined;
    }

    if ((actionRecord.kind === "update_recurring_series" || actionRecord.kind === "delete_recurring_series") && actionRecord.seriesId === undefined) {
      actionRecord.seriesId =
        candidate.seriesId ?? candidate.recurringSeriesId ?? candidate.targetSeriesId ?? candidate.id ?? undefined;
    }

    if (actionRecord.kind === "toggle_task_status" && actionRecord.status === undefined) {
      actionRecord.status = candidate.status ?? undefined;
    }

    if (actionRecord.kind === "delete_task" && actionRecord.recurrenceScope === undefined) {
      actionRecord.recurrenceScope = candidate.recurrenceScope ?? candidate.scope ?? undefined;
    }

    if (actionRecord.kind === "update_task" || actionRecord.kind === "reschedule_task") {
      if (actionRecord.recurrenceScope === undefined) {
        actionRecord.recurrenceScope = candidate.recurrenceScope ?? candidate.scope ?? undefined;
      }

      if (actionRecord.propagationMode === undefined) {
        actionRecord.propagationMode = candidate.propagationMode ?? undefined;
      }
    }

    if (actionRecord.kind === "update_recurring_series" || actionRecord.kind === "delete_recurring_series") {
      if (actionRecord.fromDate === undefined) {
        actionRecord.fromDate = candidate.fromDate ?? candidate.taskDate ?? candidate.effectiveStartDate ?? undefined;
      }
    }
  }

  return basePayload;
}

function formatContextForPrompt(input: AssistantChatRequest, displayName: string) {
  return JSON.stringify(
    {
      conversation: input.messages,
      currentDate: input.context.currentDate,
      currentTimeIso: input.context.currentTimeIso,
      displayName,
      pendingFollowUp: input.pendingFollowUp,
      recurringBlocks: input.context.recurringBlocks,
      streak: input.context.streak,
      summary: input.context.summary,
      tasks: input.context.tasks,
      timezone: input.context.timezone,
      userMessage: input.message,
    },
    null,
    2,
  );
}

export async function generateAssistantResponse(
  input: AssistantChatRequest,
  user: { email: string; full_name: string | null | undefined },
): Promise<AssistantModelResponse> {
  const routedResponse = routeAssistantMessage(input);

  if (routedResponse) {
    return routedResponse;
  }

  const apiKey = getGroqApiKey();

  if (!apiKey) {
    return createAnswerOnly(
      "I can help add blocks, move or delete visible ones, summarize the selected day, and turn a task dump into a balanced schedule. If you want a planner change, say it plainly and I will guide you.",
    );
  }

  try {
    const displayName = deriveDisplayName(user.full_name, user.email);
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        max_tokens: 900,
        messages: [
          {
            content: DAYSTACK_ASSISTANT_PRIMER,
            role: "system",
          },
          {
            content: formatContextForPrompt(input, displayName),
            role: "user",
          },
        ],
        model: getGroqModel(),
        response_format: {
          type: "json_object",
        },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error("Groq could not generate an assistant response.");
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
        };
      }>;
    };
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Groq returned an empty assistant response.");
    }

    return assistantModelResponseSchema.parse(
      normalizeAssistantModelPayload(JSON.parse(extractJsonObject(content))),
    );
  } catch {
    return createAnswerOnly(
      "I can help with DayStack planning, summaries, and schedule drafts. If you want a block created or changed, tell me the task, day, and time you want and I will guide you step by step.",
    );
  }
}

function findContextTask(context: AssistantContext, taskId: string) {
  return context.tasks.find((task) => task.id === taskId) ?? null;
}

function findContextRecurringBlock(context: AssistantContext, seriesId: string) {
  return context.recurringBlocks.find((block) => block.seriesId === seriesId) ?? null;
}

function requireContextTask(context: AssistantContext, taskId: string): AssistantContextTask {
  const task = findContextTask(context, taskId);

  if (!task) {
    throw new Error("That block is no longer visible in the current assistant context. Refresh the day and try again.");
  }

  return task;
}

function requireContextRecurringBlock(
  context: AssistantContext,
  seriesId: string,
): AssistantContextRecurringBlock {
  const block = findContextRecurringBlock(context, seriesId);

  if (!block) {
    throw new Error("That recurring block is no longer visible in the current assistant context. Refresh the day and try again.");
  }

  return block;
}

function buildSuccessMessage(action: AssistantMutationAction, context: AssistantContext) {
  if (action.kind === "create_task") {
    return `Added "${action.values.title}" for ${formatDateLabel(action.values.taskDate)}.`;
  }

  if (action.kind === "batch_create_tasks") {
    return `Added ${action.values.length} planned block${action.values.length === 1 ? "" : "s"} for ${formatDateLabel(action.values[0]?.taskDate ?? context.currentDate)}.`;
  }

  if (action.kind === "update_task") {
    const task = findContextTask(context, action.taskId);
    return `Updated "${task?.title ?? "your block"}".`;
  }

  if (action.kind === "reschedule_task") {
    const task = findContextTask(context, action.taskId);
    return `Rescheduled "${task?.title ?? "your block"}".`;
  }

  if (action.kind === "toggle_task_status") {
    const task = findContextTask(context, action.taskId);
    return action.status === "completed"
      ? `Marked "${task?.title ?? "your block"}" complete.`
      : `Reopened "${task?.title ?? "your block"}".`;
  }

  if (action.kind === "delete_task") {
    const task = findContextTask(context, action.taskId);
    return `Deleted "${task?.title ?? "your block"}".`;
  }

  if (action.kind === "update_recurring_series") {
    const block = findContextRecurringBlock(context, action.seriesId);
    const fromDate = action.fromDate ?? block?.nextOccurrenceDate ?? block?.effectiveStartDate ?? context.currentDate;
    return `Updated "${block?.title ?? "your recurring block"}" from ${formatShortDateLabel(fromDate)} onward.`;
  }

  const block = findContextRecurringBlock(context, action.seriesId);
  const fromDate = action.fromDate ?? block?.nextOccurrenceDate ?? block?.effectiveStartDate ?? context.currentDate;
  return `Deleted "${block?.title ?? "your recurring block"}" from ${formatShortDateLabel(fromDate)} onward.`;
}

export async function executeAssistantAction(
  userId: string,
  action: AssistantMutationAction,
  context: AssistantContext,
) {
  if (action.kind === "create_task") {
    const values = normalizeAssistantTaskValues(action.values);
    const task = await createTask(userId, values);

    return {
      message: buildSuccessMessage(action, context),
      recommendedDate: task.task_date,
    };
  }

  if (action.kind === "batch_create_tasks") {
    let recommendedDate = context.currentDate;

    for (const values of action.values) {
      const task = await createTask(userId, normalizeAssistantTaskValues(values));
      recommendedDate = task.task_date;
    }

    return {
      message: buildSuccessMessage(action, context),
      recommendedDate,
    };
  }

  if (action.kind === "update_task") {
    const baseTask = requireContextTask(context, action.taskId);
    const values = mergeTaskFormValues(buildTaskFormValuesFromContextTask(baseTask), action.changes);
    const task = await updateTask(
      userId,
      action.taskId,
      values,
      action.propagationMode ?? "owner_only",
      action.recurrenceScope ?? "occurrence_only",
    );

    return {
      message: buildSuccessMessage(action, context),
      recommendedDate: task.task_date,
    };
  }

  if (action.kind === "reschedule_task") {
    const baseTask = requireContextTask(context, action.taskId);
    const mergedValues = mergeTaskFormValues(buildTaskFormValuesFromContextTask(baseTask), action.changes);
    const task = await rescheduleTask(
      userId,
      action.taskId,
      {
        endTime: mergedValues.endTime,
        startTime: mergedValues.startTime,
        taskDate: mergedValues.taskDate,
      },
      action.propagationMode ?? "owner_only",
      action.recurrenceScope ?? "occurrence_only",
    );

    return {
      message: buildSuccessMessage(action, context),
      recommendedDate: task.task_date,
    };
  }

  if (action.kind === "toggle_task_status") {
    const task = await toggleTaskStatus(userId, action.taskId, action.status);

    return {
      message: buildSuccessMessage(action, context),
      recommendedDate: task.task_date,
    };
  }

  if (action.kind === "delete_task") {
    const taskDate = await deleteTask(userId, action.taskId, action.recurrenceScope ?? "occurrence_only");

    return {
      message: buildSuccessMessage(action, context),
      recommendedDate: taskDate,
    };
  }

  if (action.kind === "update_recurring_series") {
    const block = requireContextRecurringBlock(context, action.seriesId);
    const fromDate = action.fromDate ?? block.nextOccurrenceDate ?? block.effectiveStartDate;
    const values = mergeTaskFormValues(
      buildTaskFormValuesFromRecurringBlock(block, fromDate),
      action.changes,
    );

    await updateRecurringSeries(userId, action.seriesId, values);

    return {
      message: buildSuccessMessage(action, context),
      recommendedDate: values.taskDate,
    };
  }

  const block = requireContextRecurringBlock(context, action.seriesId);
  const fromDate = action.fromDate ?? block.nextOccurrenceDate ?? block.effectiveStartDate;
  await deleteRecurringSeries(userId, action.seriesId, fromDate);

  return {
    message: buildSuccessMessage(action, context),
    recommendedDate: fromDate,
  };
}

export function buildAssistantSystemNote(context: AssistantContext) {
  return `Active context: ${formatDateLabel(context.currentDate)} with ${context.tasks.length} visible block${context.tasks.length === 1 ? "" : "s"}.`;
}

export function buildAssistantActionHint(action: AssistantMutationAction, context: AssistantContext) {
  if (action.kind === "create_task") {
    return `${action.values.title} on ${formatDateLabel(action.values.taskDate)} at ${formatClockTime(action.values.startTime)}.`;
  }

  if (action.kind === "batch_create_tasks") {
    return `${action.values.length} planned block${action.values.length === 1 ? "" : "s"} for ${formatDateLabel(action.values[0]?.taskDate ?? context.currentDate)}.`;
  }

  if (action.kind === "update_recurring_series" || action.kind === "delete_recurring_series") {
    const block = findContextRecurringBlock(context, action.seriesId);
    const fromDate = action.fromDate ?? block?.nextOccurrenceDate ?? block?.effectiveStartDate ?? context.currentDate;
    return `${block?.title ?? "Recurring block"} from ${formatShortDateLabel(fromDate)} onward.`;
  }

  if ("taskId" in action) {
    const task = findContextTask(context, action.taskId);
    return task?.title ?? "Visible block";
  }

  return "Planner change";
}
