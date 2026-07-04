import "server-only";

const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";
const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
const DEFAULT_OPENAI_MODEL = "gpt-5";

export interface PlanTaskInput {
  title: string;
  durationMinutes: number;
}

export interface PlannedTask {
  title: string;
  startTime: string;
  endTime: string;
}

export interface PlanRequest {
  date: string;
  startTime: string;
  endTime: string;
  tasks: PlanTaskInput[];
}

export interface PlanResponse {
  tasks: PlannedTask[];
}

const PLANNER_PROMPT = `You are DayStack Planner, an AI that optimally schedules tasks into a user's available time window.

Your goal: arrange the given tasks at the best times for maximum productivity.

## Productivity Scheduling Rules

### Time-of-day guidelines (default when tasks are ambiguous):
- 06:00-10:00 — Peak focus. Best for deep work: coding, writing, studying, designing, strategic thinking
- 10:00-12:00 — Good focus. Best for creative work, analysis, problem-solving, meetings
- 12:00-14:00 — Lunch/break window. Prefer the latest sensible lunch slot that still fits, usually 13:00-14:00 when available
- 13:00-15:00 — Post-lunch slump. Best for light work: email, reviews, admin, routine tasks
- 15:00-17:00 — Second wind. Best for collaborative work, learning, review, exercise
- 17:00+ — Wind-down / dinner. Best for planning, reflection, light preparation, dinner, and evening routines

### Task-type heuristics (override defaults based on task content):
- "lunch", "eat", "lunch break" → anchor around the latest sensible lunch time, usually 13:00-14:00 if the window allows it; do not waste peak morning focus on lunch
- "dinner", "supper", "evening meal" → anchor as late as possible inside the available window; never schedule dinner in the early afternoon unless the user's window ends early
- "break" → place between demanding tasks or during the post-lunch slump
- "gym", "workout", "exercise", "run", "walk", "yoga", "fitness" → late afternoon when the window allows it; otherwise morning before deep work
- "meditate", "meditation", "journal", "reflect", "gratitude" → morning or evening
- "code", "dev", "program", "build", "architect", "debug" → deep work → morning window
- "study", "learn", "read", "research", "analyze", "practice" → deep work → morning window
- "write", "draft", "compose", "create", "design" → creative → late morning
- "meeting", "sync", "standup", "call", "1:1", "catchup" → collaborative → late morning or early afternoon
- "email", "inbox", "admin", "organize", "plan", "schedule" → light → afternoon slump
- "review", "feedback", "pr", "approve" → collaborative → late afternoon
- Generic tasks without clear category should follow the AI plan order but still avoid consuming meal/exercise/deep-work priority windows.

### Additional rules:
- Leave small (5-15 min) gaps between tasks when possible
- Group similar task types together (batch all meetings, batch all deep work)
- Schedule the most cognitively demanding tasks first (morning)
- Treat meals, exercise, deep work, meetings, admin, and review as human-rhythm anchors, not generic tasks.
- Respect the user's available time window exactly
- Every task must fit within the window

Return a JSON object with the structure: { "tasks": [{ "title": string, "startTime": "HH:MM", "endTime": "HH:MM" }] }
Times must be in 24-hour format, within the user's available window, and each task's duration must match the requested durationMinutes.`;

function getGroqApiKey() {
  return process.env.GROQ_API_KEY?.trim() ?? null;
}

function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY?.trim() ?? null;
}

function getGroqModel() {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
}

function getOpenAiModel() {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

function extractJsonObject(text: string): string {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("No JSON object found in AI response.");
  }

  return text.slice(firstBrace, lastBrace + 1);
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToClock(minutes: number) {
  const normalized = Math.max(0, Math.min(24 * 60 - 1, minutes));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;

  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

function includesAny(value: string, words: string[]) {
  const normalized = value.toLowerCase();

  return words.some((word) => normalized.includes(word));
}

function getTaskDuration(task: PlannedTask, inputTasks: PlanTaskInput[]) {
  const matchingInput = inputTasks.find((item) => item.title.toLowerCase() === task.title.toLowerCase());

  return matchingInput?.durationMinutes ?? timeToMinutes(task.endTime) - timeToMinutes(task.startTime);
}

function findLatestSlot({
  duration,
  intervals,
  latestStart,
  windowStart,
}: {
  duration: number;
  intervals: Array<{ end: number; start: number }>;
  latestStart: number;
  windowStart: number;
}) {
  for (let start = latestStart; start >= windowStart; start -= 5) {
    const end = start + duration;
    const overlaps = intervals.some((interval) => start < interval.end && end > interval.start);

    if (!overlaps) {
      return start;
    }
  }

  return null;
}

function findEarliestSlot({
  duration,
  intervals,
  windowEnd,
  windowStart,
}: {
  duration: number;
  intervals: Array<{ end: number; start: number }>;
  windowEnd: number;
  windowStart: number;
}) {
  for (let start = windowStart; start + duration <= windowEnd; start += 5) {
    const end = start + duration;
    const overlaps = intervals.some((interval) => start < interval.end && end > interval.start);

    if (!overlaps) {
      return start;
    }
  }

  return null;
}

function findClosestSlot({
  duration,
  intervals,
  preferredStart,
  windowEnd,
  windowStart,
}: {
  duration: number;
  intervals: Array<{ end: number; start: number }>;
  preferredStart: number;
  windowEnd: number;
  windowStart: number;
}) {
  const minStart = windowStart;
  const maxStart = windowEnd - duration;
  const target = Math.max(minStart, Math.min(maxStart, preferredStart));

  for (let offset = 0; target - offset >= minStart || target + offset <= maxStart; offset += 5) {
    const candidates = [target - offset, target + offset].filter(
      (candidate, index, all) =>
        candidate >= minStart && candidate <= maxStart && all.indexOf(candidate) === index,
    );

    for (const start of candidates) {
      const end = start + duration;
      const overlaps = intervals.some((interval) => start < interval.end && end > interval.start);

      if (!overlaps) {
        return start;
      }
    }
  }

  return null;
}

function getTaskPreference({
  duration,
  index,
  task,
  windowEnd,
  windowStart,
}: {
  duration: number;
  index: number;
  task: PlannedTask;
  windowEnd: number;
  windowStart: number;
}) {
  const latestStart = windowEnd - duration;
  const clamp = (value: number) => Math.max(windowStart, Math.min(latestStart, value));

  if (includesAny(task.title, ["dinner", "supper", "evening meal"])) {
    return { placement: "latest" as const, preferredStart: latestStart, priority: 100 };
  }

  if (includesAny(task.title, ["lunch", "lunch break", "eat"])) {
    return { placement: "latest" as const, preferredStart: clamp(13 * 60), priority: 95 };
  }

  if (includesAny(task.title, ["code", "dev", "program", "build", "architect", "debug", "study", "learn", "read", "research", "analyze", "practice", "calculus", "math"])) {
    return { placement: "closest" as const, preferredStart: clamp(Math.max(windowStart, 9 * 60)), priority: 90 };
  }

  if (includesAny(task.title, ["write", "draft", "compose", "create", "design"])) {
    return { placement: "closest" as const, preferredStart: clamp(10 * 60 + 30), priority: 80 };
  }

  if (includesAny(task.title, ["meeting", "sync", "standup", "call", "1:1", "catchup"])) {
    return { placement: "closest" as const, preferredStart: clamp(11 * 60), priority: 70 };
  }

  if (includesAny(task.title, ["gym", "workout", "exercise", "run", "walk", "yoga", "fitness"])) {
    return { placement: "closest" as const, preferredStart: clamp(windowEnd >= 17 * 60 ? 16 * 60 : 15 * 60), priority: 65 };
  }

  if (includesAny(task.title, ["review", "feedback", "pr", "approve"])) {
    return { placement: "closest" as const, preferredStart: clamp(15 * 60), priority: 60 };
  }

  if (includesAny(task.title, ["email", "inbox", "admin", "organize", "schedule"])) {
    return { placement: "closest" as const, preferredStart: clamp(14 * 60), priority: 50 };
  }

  if (includesAny(task.title, ["plan", "reflect", "journal", "gratitude"])) {
    return { placement: "latest" as const, preferredStart: latestStart, priority: 45 };
  }

  if (includesAny(task.title, ["meditate", "meditation", "routine"])) {
    return { placement: "closest" as const, preferredStart: clamp(windowStart), priority: 40 };
  }

  if (includesAny(task.title, ["break"])) {
    return { placement: "closest" as const, preferredStart: clamp(14 * 60), priority: 30 };
  }

  return { placement: "earliest" as const, preferredStart: windowStart, priority: 10 - index / 100 };
}

function optimizeTaskTiming(input: PlanRequest, plan: PlanResponse): PlanResponse {
  const windowStart = timeToMinutes(input.startTime);
  const windowEnd = timeToMinutes(input.endTime);
  const intervals: Array<{ end: number; start: number }> = [];
  const scheduled = new Map<string, PlannedTask>();
  const tasksWithDuration = plan.tasks
    .map((task, index) => {
      const duration = getTaskDuration(task, input.tasks);

      return {
        duration,
        index,
        key: `${index}-${task.title}`,
        preference: getTaskPreference({ duration, index, task, windowEnd, windowStart }),
        task,
      };
    })
    .sort((left, right) => right.preference.priority - left.preference.priority);

  for (const item of tasksWithDuration) {
    const start =
      item.preference.placement === "latest"
        ? findLatestSlot({
            duration: item.duration,
            intervals,
            latestStart: Math.min(item.preference.preferredStart, windowEnd - item.duration),
            windowStart,
          })
        : item.preference.placement === "closest"
          ? findClosestSlot({
              duration: item.duration,
              intervals,
              preferredStart: item.preference.preferredStart,
              windowEnd,
              windowStart,
            })
          : findEarliestSlot({
              duration: item.duration,
              intervals,
              windowEnd,
              windowStart,
            });

    if (start === null) {
      scheduled.set(item.key, item.task);
      continue;
    }

    intervals.push({ start, end: start + item.duration });
    scheduled.set(item.key, {
      title: item.task.title,
      startTime: minutesToClock(start),
      endTime: minutesToClock(start + item.duration),
    });
  }

  return {
    tasks: [...scheduled.values()].sort((left, right) => timeToMinutes(left.startTime) - timeToMinutes(right.startTime)),
  };
}
export async function planDay(input: PlanRequest): Promise<PlanResponse> {
  const apiKey = getOpenAiApiKey() || getGroqApiKey();
  const endpoint = getOpenAiApiKey() ? OPENAI_CHAT_COMPLETIONS_URL : GROQ_CHAT_COMPLETIONS_URL;
  const model = getOpenAiApiKey() ? getOpenAiModel() : getGroqModel();

  if (!apiKey) {
    throw new Error("AI provider not configured. Add OPENAI_API_KEY or GROQ_API_KEY.");
  }

  const taskList = input.tasks
    .map((task, index) => `${index + 1}. "${task.title}" — ${task.durationMinutes} min`)
    .join("\n");

  const userPrompt = [
    `Date: ${input.date}`,
    `Available window: ${input.startTime} — ${input.endTime}`,
    `Tasks to schedule:`,
    taskList,
    `Schedule each task at the optimal time within the window. Return JSON.`,
  ].join("\n");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      max_tokens: 1500,
      messages: [
        { content: PLANNER_PROMPT, role: "system" },
        { content: userPrompt, role: "user" },
      ],
      model,
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error("AI planner could not generate a schedule.");
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("AI planner returned an empty response.");
  }

  const parsed = JSON.parse(extractJsonObject(content)) as PlanResponse;

  if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
    throw new Error("AI planner returned an invalid schedule.");
  }

  return optimizeTaskTiming(input, parsed);
}
