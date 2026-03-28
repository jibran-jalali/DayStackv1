"use client";

import { useEffect } from "react";

import { PomodoroPanel } from "@/components/app/pomodoro-panel";
import { usePomodoro } from "@/components/app/use-pomodoro";

export function PomodoroWindowShell() {
  const pomodoro = usePomodoro();

  useEffect(() => {
    document.title = `${pomodoro.formattedRemaining} - DayStack Timer`;
  }, [pomodoro.formattedRemaining]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(24,190,239,0.12),transparent_42%),linear-gradient(180deg,#f8fbff_0%,#eff5fd_100%)] p-2">
      <PomodoroPanel
        variant="window"
        formattedRemaining={pomodoro.formattedRemaining}
        onPause={pomodoro.pause}
        onReset={pomodoro.reset}
        onResume={pomodoro.resume}
        onSkipBreak={pomodoro.skipBreak}
        onStart={pomodoro.start}
        onUnlinkTask={pomodoro.unlinkTask}
        state={pomodoro.state}
      />
    </main>
  );
}
