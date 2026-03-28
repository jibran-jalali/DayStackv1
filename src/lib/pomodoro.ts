import type { PlannerTask } from "@/types/daystack";

export type PomodoroMode = "standalone" | "task-linked";
export type PomodoroPhase = "break" | "work";
export type PomodoroStatus = "idle" | "paused" | "running";

export interface PomodoroLinkedTask {
  id: string;
  taskDate: string;
  title: string;
}

export interface PomodoroState {
  breakDurationSeconds: number;
  completedWorkSessions: number;
  lastTransitionId: string | null;
  linkedTask: PomodoroLinkedTask | null;
  mode: PomodoroMode;
  phase: PomodoroPhase;
  phaseEndsAt: string | null;
  remainingSeconds: number;
  status: PomodoroStatus;
  updatedAt: string;
  workDurationSeconds: number;
}

export const POMODORO_STORAGE_KEY = "daystack:pomodoro-state:v1";
export const POMODORO_CHANNEL_NAME = "daystack-pomodoro";
export const POMODORO_WINDOW_NAME = "daystack-pomodoro-window";
export const POMODORO_WINDOW_PATH = "/app/pomodoro-window";
export const DEFAULT_WORK_DURATION_SECONDS = 25 * 60;
export const DEFAULT_BREAK_DURATION_SECONDS = 5 * 60;
export const POMODORO_WINDOW_FEATURES = [
  "popup=yes",
  "width=336",
  "height=248",
  "left=80",
  "top=80",
  "resizable=yes",
  "scrollbars=no",
].join(",");

let pomodoroAudioContext: AudioContext | null = null;

function createTimestamp(value = Date.now()) {
  return new Date(value).toISOString();
}

function clampRemainingSeconds(value: number) {
  return Math.max(0, Math.floor(value));
}

function sanitizeLinkedTask(value: unknown): PomodoroLinkedTask | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<PomodoroLinkedTask>;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.taskDate !== "string" ||
    typeof candidate.title !== "string"
  ) {
    return null;
  }

  return {
    id: candidate.id,
    taskDate: candidate.taskDate,
    title: candidate.title,
  };
}

function sanitizeDuration(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}

export function createDefaultPomodoroState(): PomodoroState {
  return {
    breakDurationSeconds: DEFAULT_BREAK_DURATION_SECONDS,
    completedWorkSessions: 0,
    lastTransitionId: null,
    linkedTask: null,
    mode: "standalone",
    phase: "work",
    phaseEndsAt: null,
    remainingSeconds: DEFAULT_WORK_DURATION_SECONDS,
    status: "idle",
    updatedAt: createTimestamp(),
    workDurationSeconds: DEFAULT_WORK_DURATION_SECONDS,
  };
}

export function sanitizePomodoroState(value: unknown): PomodoroState {
  const fallback = createDefaultPomodoroState();

  if (!value || typeof value !== "object") {
    return fallback;
  }

  const candidate = value as Partial<PomodoroState>;
  const workDurationSeconds = sanitizeDuration(candidate.workDurationSeconds, DEFAULT_WORK_DURATION_SECONDS);
  const breakDurationSeconds = sanitizeDuration(candidate.breakDurationSeconds, DEFAULT_BREAK_DURATION_SECONDS);
  const phase = candidate.phase === "break" ? "break" : "work";
  const status =
    candidate.status === "paused" || candidate.status === "running" ? candidate.status : "idle";

  return {
    breakDurationSeconds,
    completedWorkSessions:
      typeof candidate.completedWorkSessions === "number" && Number.isFinite(candidate.completedWorkSessions)
        ? Math.max(0, Math.floor(candidate.completedWorkSessions))
        : 0,
    lastTransitionId: typeof candidate.lastTransitionId === "string" ? candidate.lastTransitionId : null,
    linkedTask: sanitizeLinkedTask(candidate.linkedTask),
    mode: candidate.mode === "task-linked" ? "task-linked" : "standalone",
    phase,
    phaseEndsAt: typeof candidate.phaseEndsAt === "string" ? candidate.phaseEndsAt : null,
    remainingSeconds: clampRemainingSeconds(
      typeof candidate.remainingSeconds === "number"
        ? candidate.remainingSeconds
        : phase === "work"
          ? workDurationSeconds
          : breakDurationSeconds,
    ),
    status,
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : fallback.updatedAt,
    workDurationSeconds,
  };
}

export function readPomodoroState(): PomodoroState {
  if (typeof window === "undefined") {
    return createDefaultPomodoroState();
  }

  const rawValue = window.localStorage.getItem(POMODORO_STORAGE_KEY);

  if (!rawValue) {
    return createDefaultPomodoroState();
  }

  try {
    return sanitizePomodoroState(JSON.parse(rawValue));
  } catch {
    return createDefaultPomodoroState();
  }
}

export function writePomodoroState(state: PomodoroState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify(state));
}

export function createPomodoroTaskLink(
  task: Pick<PlannerTask, "id" | "task_date" | "title">,
): PomodoroLinkedTask {
  return {
    id: task.id,
    taskDate: task.task_date,
    title: task.title,
  };
}

export function getRemainingPomodoroSeconds(state: PomodoroState, now = Date.now()) {
  if (state.status !== "running" || !state.phaseEndsAt) {
    return clampRemainingSeconds(state.remainingSeconds);
  }

  return clampRemainingSeconds((Date.parse(state.phaseEndsAt) - now) / 1000);
}

function withUpdatedState(state: PomodoroState, updates: Partial<PomodoroState>): PomodoroState {
  return {
    ...state,
    ...updates,
    updatedAt: createTimestamp(),
  };
}

function createRunningPhaseEndsAt(now: number, remainingSeconds: number) {
  return createTimestamp(now + remainingSeconds * 1000);
}

export function startStandalonePomodoro(current: PomodoroState, now = Date.now()): PomodoroState {
  return withUpdatedState(current, {
    lastTransitionId: null,
    linkedTask: null,
    mode: "standalone",
    phase: "work",
    phaseEndsAt: createRunningPhaseEndsAt(now, current.workDurationSeconds),
    remainingSeconds: current.workDurationSeconds,
    status: "running",
  });
}

export function startTaskPomodoro(
  current: PomodoroState,
  task: PomodoroLinkedTask,
  now = Date.now(),
): PomodoroState {
  return withUpdatedState(current, {
    lastTransitionId: null,
    linkedTask: task,
    mode: "task-linked",
    phase: "work",
    phaseEndsAt: createRunningPhaseEndsAt(now, current.workDurationSeconds),
    remainingSeconds: current.workDurationSeconds,
    status: "running",
  });
}

export function pausePomodoro(current: PomodoroState, now = Date.now()): PomodoroState {
  return withUpdatedState(current, {
    phaseEndsAt: null,
    remainingSeconds: getRemainingPomodoroSeconds(current, now),
    status: "paused",
  });
}

export function resumePomodoro(current: PomodoroState, now = Date.now()): PomodoroState {
  const remainingSeconds =
    current.remainingSeconds > 0
      ? current.remainingSeconds
      : current.phase === "work"
        ? current.workDurationSeconds
        : current.breakDurationSeconds;

  return withUpdatedState(current, {
    phaseEndsAt: createRunningPhaseEndsAt(now, remainingSeconds),
    remainingSeconds,
    status: "running",
  });
}

export function resetPomodoro(current: PomodoroState): PomodoroState {
  return withUpdatedState(current, {
    lastTransitionId: null,
    phase: "work",
    phaseEndsAt: null,
    remainingSeconds: current.workDurationSeconds,
    status: "idle",
  });
}

export function unlinkPomodoroTask(current: PomodoroState): PomodoroState {
  return withUpdatedState(current, {
    linkedTask: null,
    mode: "standalone",
  });
}

export function syncPomodoroTaskLink(
  current: PomodoroState,
  task: PomodoroLinkedTask,
): PomodoroState {
  return withUpdatedState(current, {
    linkedTask: task,
    mode: "task-linked",
  });
}

export function skipPomodoroBreak(current: PomodoroState, now = Date.now()): PomodoroState {
  const nextStatus = current.status === "running" ? "running" : "paused";

  return withUpdatedState(current, {
    lastTransitionId: null,
    phase: "work",
    phaseEndsAt:
      nextStatus === "running"
        ? createRunningPhaseEndsAt(now, current.workDurationSeconds)
        : null,
    remainingSeconds: current.workDurationSeconds,
    status: nextStatus,
  });
}

export function advancePomodoroPhase(current: PomodoroState, now = Date.now()) {
  if (current.phase === "work") {
    const transitionId = crypto.randomUUID();

    return {
      alertKind: "work-complete" as const,
      nextState: withUpdatedState(current, {
        completedWorkSessions: current.completedWorkSessions + 1,
        lastTransitionId: transitionId,
        phase: "break",
        phaseEndsAt: createRunningPhaseEndsAt(now, current.breakDurationSeconds),
        remainingSeconds: current.breakDurationSeconds,
        status: "running",
      }),
      transitionId,
    };
  }

  const transitionId = crypto.randomUUID();

  return {
    alertKind: null,
    nextState: withUpdatedState(current, {
      lastTransitionId: transitionId,
      phase: "work",
      phaseEndsAt: createRunningPhaseEndsAt(now, current.workDurationSeconds),
      remainingSeconds: current.workDurationSeconds,
      status: "running",
    }),
    transitionId,
  };
}

export function formatPomodoroClock(totalSeconds: number) {
  const safeTotal = clampRemainingSeconds(totalSeconds);
  const minutes = Math.floor(safeTotal / 60);
  const seconds = safeTotal % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function openPomodoroWindow() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.open(POMODORO_WINDOW_PATH, POMODORO_WINDOW_NAME, POMODORO_WINDOW_FEATURES);
}

export function createPomodoroChannel() {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }

  return new BroadcastChannel(POMODORO_CHANNEL_NAME);
}

export async function primePomodoroAudio() {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextConstructor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  pomodoroAudioContext = pomodoroAudioContext ?? new AudioContextConstructor();

  if (pomodoroAudioContext.state === "suspended") {
    await pomodoroAudioContext.resume();
  }

  return pomodoroAudioContext;
}

export async function playPomodoroAmbientAlert() {
  const audioContext = await primePomodoroAudio();

  if (!audioContext) {
    return;
  }

  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gainNode.connect(audioContext.destination);

  const noteDurations = [0.22, 0.24, 0.38];
  const noteOffsets = [0, 0.28, 0.62];
  const noteFrequencies = [392, 523.25, 659.25];

  noteFrequencies.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + noteOffsets[index]);
    oscillator.connect(gainNode);

    const noteStart = audioContext.currentTime + noteOffsets[index];
    const noteEnd = noteStart + noteDurations[index];

    gainNode.gain.exponentialRampToValueAtTime(0.08, noteStart + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.03);
  });
}

export function sendPomodoroNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  new Notification(title, {
    body,
    silent: true,
  });
}
