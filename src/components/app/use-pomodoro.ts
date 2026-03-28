"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  advancePomodoroPhase,
  createPomodoroChannel,
  createDefaultPomodoroState,
  createPomodoroTaskLink,
  formatPomodoroClock,
  getRemainingPomodoroSeconds,
  pausePomodoro,
  POMODORO_STORAGE_KEY,
  playPomodoroAmbientAlert,
  primePomodoroAudio,
  readPomodoroState,
  resetPomodoro,
  resumePomodoro,
  sendPomodoroNotification,
  skipPomodoroBreak,
  startStandalonePomodoro,
  startTaskPomodoro,
  syncPomodoroTaskLink,
  unlinkPomodoroTask,
  writePomodoroState,
  type PomodoroState,
} from "@/lib/pomodoro";
import type { PlannerTask } from "@/types/daystack";

interface UsePomodoroOptions {
  taskDate?: string;
  tasks?: PlannerTask[];
}

interface PomodoroSnapshot {
  formattedRemaining: string;
  remainingSeconds: number;
  state: PomodoroState;
}

function readAndStoreState(setState: (state: PomodoroState) => void, stateRef: React.MutableRefObject<PomodoroState>) {
  const nextState = readPomodoroState();
  stateRef.current = nextState;
  setState(nextState);
  return nextState;
}

export function usePomodoro(options?: UsePomodoroOptions) {
  const [state, setState] = useState<PomodoroState>(createDefaultPomodoroState);
  const [now, setNow] = useState(() => Date.now());
  const stateRef = useRef(state);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const syncFromStorage = useCallback(() => {
    return readAndStoreState(setState, stateRef);
  }, []);

  const commitState = useCallback(
    (nextState: PomodoroState) => {
      writePomodoroState(nextState);
      channelRef.current?.postMessage({
        type: "pomodoro-sync",
        updatedAt: nextState.updatedAt,
      });
      return syncFromStorage();
    },
    [syncFromStorage],
  );

  const emitWorkCompleteAlert = useCallback(
    async (transitionId: string, linkedTaskTitle?: string | null) => {
      const latestState = readPomodoroState();

      if (latestState.lastTransitionId !== transitionId) {
        return;
      }

      sendPomodoroNotification(
        "Break started",
        linkedTaskTitle ? `${linkedTaskTitle} is done for this round. Take five.` : "Your five-minute break has started.",
      );

      await playPomodoroAmbientAlert().catch(() => undefined);
    },
    [],
  );

  const advanceIfNeeded = useCallback(async () => {
    const currentState = readPomodoroState();

    if (currentState.status !== "running") {
      if (currentState.updatedAt !== stateRef.current.updatedAt) {
        syncFromStorage();
      }

      return;
    }

    const remainingSeconds = getRemainingPomodoroSeconds(currentState, Date.now());

    if (remainingSeconds > 0) {
      if (currentState.updatedAt !== stateRef.current.updatedAt) {
        syncFromStorage();
      }

      return;
    }

    const { alertKind, nextState, transitionId } = advancePomodoroPhase(currentState, Date.now());
    const storedState = commitState(nextState);

    if (alertKind === "work-complete" && storedState.lastTransitionId === transitionId) {
      await emitWorkCompleteAlert(transitionId, storedState.linkedTask?.title);
    }
  }, [commitState, emitWorkCompleteAlert, syncFromStorage]);

  useEffect(() => {
    syncFromStorage();
    channelRef.current = createPomodoroChannel();

    function handleStorage(event: StorageEvent) {
      if (event.key === null || event.key === POMODORO_STORAGE_KEY) {
        syncFromStorage();
      }
    }

    channelRef.current?.addEventListener("message", syncFromStorage);
    window.addEventListener("storage", handleStorage);

    return () => {
      channelRef.current?.removeEventListener("message", syncFromStorage);
      channelRef.current?.close();
      window.removeEventListener("storage", handleStorage);
    };
  }, [syncFromStorage]);

  useEffect(() => {
    if (state.status !== "running") {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
      void advanceIfNeeded();
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [advanceIfNeeded, state.status]);

  useEffect(() => {
    if (!options?.tasks || !options.taskDate) {
      return;
    }

    const linkedTask = stateRef.current.linkedTask;

    if (!linkedTask || linkedTask.taskDate !== options.taskDate) {
      return;
    }

    const matchingTask = options.tasks.find((task) => task.id === linkedTask.id);

    if (!matchingTask) {
      commitState(unlinkPomodoroTask(stateRef.current));
      return;
    }

    if (matchingTask.title !== linkedTask.title) {
      commitState(syncPomodoroTaskLink(stateRef.current, createPomodoroTaskLink(matchingTask)));
    }
  }, [commitState, options?.taskDate, options?.tasks]);

  const snapshot = useMemo<PomodoroSnapshot>(() => {
    const remainingSeconds = getRemainingPomodoroSeconds(state, now);

    return {
      formattedRemaining: formatPomodoroClock(remainingSeconds),
      remainingSeconds,
      state,
    };
  }, [now, state]);

  const startStandalone = useCallback(async () => {
    await primePomodoroAudio().catch(() => undefined);
    commitState(startStandalonePomodoro(stateRef.current, Date.now()));
  }, [commitState]);

  const start = useCallback(async () => {
    if (stateRef.current.mode === "task-linked" && stateRef.current.linkedTask) {
      await primePomodoroAudio().catch(() => undefined);
      commitState(startTaskPomodoro(stateRef.current, stateRef.current.linkedTask, Date.now()));
      return;
    }

    await startStandalone();
  }, [commitState, startStandalone]);

  const startForTask = useCallback(
    async (task: Pick<PlannerTask, "id" | "task_date" | "title">) => {
      await primePomodoroAudio().catch(() => undefined);
      commitState(startTaskPomodoro(stateRef.current, createPomodoroTaskLink(task), Date.now()));
    },
    [commitState],
  );

  const pause = useCallback(() => {
    commitState(pausePomodoro(stateRef.current, Date.now()));
  }, [commitState]);

  const resume = useCallback(async () => {
    await primePomodoroAudio().catch(() => undefined);
    commitState(resumePomodoro(stateRef.current, Date.now()));
  }, [commitState]);

  const reset = useCallback(() => {
    commitState(resetPomodoro(stateRef.current));
  }, [commitState]);

  const skipBreak = useCallback(() => {
    commitState(skipPomodoroBreak(stateRef.current, Date.now()));
  }, [commitState]);

  const unlinkTask = useCallback(() => {
    commitState(unlinkPomodoroTask(stateRef.current));
  }, [commitState]);

  return {
    ...snapshot,
    pause,
    reset,
    resume,
    skipBreak,
    start,
    startForTask,
    startStandalone,
    unlinkTask,
  };
}
