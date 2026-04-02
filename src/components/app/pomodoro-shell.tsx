"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock3 } from "lucide-react";

import { MobileBottomNav } from "@/components/app/mobile-bottom-nav";
import { MobileWorkspaceHeader } from "@/components/app/mobile-workspace-header";
import { PlannerHeader } from "@/components/app/planner-header";
import { PomodoroPanel } from "@/components/app/pomodoro-panel";
import { useActionFeedback } from "@/components/app/use-action-feedback";
import { usePomodoro } from "@/components/app/use-pomodoro";
import { fetchDashboardSnapshot } from "@/lib/client/daystack";
import { formatDateKey, formatDateLabel } from "@/lib/daystack";
import { openPomodoroWindow } from "@/lib/pomodoro";
import { getErrorMessage } from "@/lib/utils";
import type { DashboardSnapshot, TaskNotificationAcceptResult } from "@/types/daystack";

interface PomodoroShellProps {
  displayName: string;
  email?: string;
  initialNowIso: string;
  initialSnapshot: DashboardSnapshot;
}

type NoticeState =
  | {
      type: "success" | "error";
      message: string;
    }
  | null;

function getPlannerHref(taskDate: string, now: Date) {
  const todayDate = formatDateKey(now);
  return taskDate === todayDate ? "/app" : `/app?date=${taskDate}`;
}

function getPomodoroHref(taskDate: string, now: Date) {
  const todayDate = formatDateKey(now);
  return taskDate === todayDate ? "/app/pomodoro" : `/app/pomodoro?date=${taskDate}`;
}

function getSettingsHref(taskDate: string, now: Date) {
  const todayDate = formatDateKey(now);
  return taskDate === todayDate ? "/app/settings" : `/app/settings?date=${taskDate}`;
}

export function PomodoroShell({ displayName, email, initialNowIso, initialSnapshot }: PomodoroShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialNow = useMemo(() => new Date(initialNowIso), [initialNowIso]);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [now, setNow] = useState(initialNow);
  const pomodoroWindowRef = useRef<Window | null>(null);
  const consumedAutostartRef = useRef<string | null>(null);
  const pomodoro = usePomodoro({
    taskDate: snapshot.taskDate,
    tasks: snapshot.tasks,
  });
  const { playActionFeedback } = useActionFeedback({
    onNotice: setNotice,
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (notice?.type !== "success") {
      return;
    }

    const timer = window.setTimeout(() => {
      setNotice(null);
    }, 2400);

    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (pomodoroWindowRef.current?.closed) {
        pomodoroWindowRef.current = null;
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const taskId = searchParams.get("taskId");
    const autostart = searchParams.get("autostart");
    const requestedDate = searchParams.get("date") ?? snapshot.taskDate;

    if (autostart !== "1" || !taskId || requestedDate !== snapshot.taskDate) {
      return;
    }

    const requestKey = `${taskId}:${requestedDate}:${autostart}`;

    if (consumedAutostartRef.current === requestKey) {
      return;
    }

    consumedAutostartRef.current = requestKey;

    const linkedTask = snapshot.tasks.find((task) => task.id === taskId);
    const cleanHref = getPomodoroHref(snapshot.taskDate, new Date());

    void (async () => {
      if (!linkedTask) {
        setNotice({
          type: "error",
          message: "The selected block could not be found on this day.",
        });
        router.replace(cleanHref);
        return;
      }

      await pomodoro.startForTask(linkedTask);
      setNotice({
        type: "success",
        message: `Pomodoro linked to "${linkedTask.title}".`,
      });
      router.replace(cleanHref);
    })();
  }, [pomodoro, router, searchParams, snapshot.taskDate, snapshot.tasks]);

  async function handleNotificationAccepted(result: TaskNotificationAcceptResult) {
    if (result.taskDate !== snapshot.taskDate) {
      return;
    }

    try {
      const refreshedSnapshot = await fetchDashboardSnapshot(snapshot.taskDate);
      setSnapshot(refreshedSnapshot);
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(error),
      });
    }
  }

  function handleOpenPomodoroWindow() {
    if (pomodoroWindowRef.current && !pomodoroWindowRef.current.closed) {
      pomodoroWindowRef.current.focus();
      return;
    }

    const nextWindow = openPomodoroWindow();

    if (!nextWindow) {
      setNotice({
        type: "error",
        message: "The timer window was blocked by the browser. Allow pop-ups for DayStack and try again.",
      });
      return;
    }

    pomodoroWindowRef.current = nextWindow;
    nextWindow.focus();
  }

  const dateLabel = useMemo(() => formatDateLabel(snapshot.taskDate), [snapshot.taskDate]);
  const plannerHref = useMemo(
    () => getPlannerHref(snapshot.taskDate, now),
    [now, snapshot.taskDate],
  );
  const pomodoroHref = useMemo(
    () => getPomodoroHref(snapshot.taskDate, now),
    [now, snapshot.taskDate],
  );
  const settingsHref = useMemo(
    () => getSettingsHref(snapshot.taskDate, now),
    [now, snapshot.taskDate],
  );
  const notificationsHref = useMemo(
    () =>
      snapshot.taskDate === formatDateKey(now)
        ? "/app/notifications"
        : `/app/notifications?date=${snapshot.taskDate}`,
    [now, snapshot.taskDate],
  );

  return (
    <main className="min-h-screen">
      <div className="mobile-app-shell mobile-safe-x min-h-screen pb-[calc(var(--mobile-bottom-nav-height)+1.75rem+env(safe-area-inset-bottom))] lg:hidden">
        <MobileWorkspaceHeader
          title="Focus"
          subtitle={dateLabel}
          metricLabel={pomodoro.state.phase === "break" ? "Break live" : "Focus timer"}
          metricTone={pomodoro.state.phase === "break" ? "success" : "brand"}
          secondaryMetricLabel={`${snapshot.tasks.length} block${snapshot.tasks.length === 1 ? "" : "s"}`}
        />

        {notice ? (
          <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+8.75rem)] z-40 flex justify-center lg:hidden">
            <div className="mobile-shell-width mx-auto">
              <div
                aria-live="polite"
                className={`pointer-events-auto min-w-[16rem] rounded-full border px-4 py-2.5 text-sm shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl ${
                  notice.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-danger"
                }`}
              >
                {notice.message}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mobile-shell-width mobile-stack mx-auto pt-4">
          <div className="mobile-card p-4">
            <PomodoroPanel
              variant="page"
              formattedRemaining={pomodoro.formattedRemaining}
              onOpenWindow={handleOpenPomodoroWindow}
              onPause={pomodoro.pause}
              onReset={pomodoro.reset}
              onResume={pomodoro.resume}
              onSkipBreak={pomodoro.skipBreak}
              onStart={pomodoro.start}
              onUnlinkTask={pomodoro.unlinkTask}
              state={pomodoro.state}
            />
          </div>

          <section className="mobile-card p-4">
            <p className="section-label">Pomodoro flow</p>
            <p className="mt-2 text-sm font-semibold text-foreground">Stay in sync with your plan</p>
            <p className="mt-1 text-sm text-secondary-foreground">
              Start focus from any block, keep the timer linked, and pop it out when you want a dedicated floating surface.
            </p>
          </section>
        </div>

        <MobileBottomNav
          activeTab={null}
          notificationsHref={notificationsHref}
          onPlayNavigate={() => playActionFeedback("navigate")}
          plannerHref={plannerHref}
          settingsHref={settingsHref}
        />
      </div>

      <div className="container-shell hidden min-h-screen py-4 sm:py-6 lg:block">
      <div className="space-y-4 sm:space-y-5">
        <PlannerHeader
          activePage="pomodoro"
          dateLabel={dateLabel}
          displayName={displayName}
          email={email}
          metricIcon={Clock3}
          metricLabel={pomodoro.state.phase === "break" ? "Break live" : "Focus timer"}
          metricTone={pomodoro.state.phase === "break" ? "success" : "brand"}
          notificationsHref={notificationsHref}
          plannerHref={plannerHref}
          pomodoroHref={pomodoroHref}
          settingsHref={settingsHref}
          showNotificationCenter
          subtitle="Run focused rounds in a dedicated surface and keep the mini timer in sync."
          onNotice={setNotice}
          onTaskAccepted={handleNotificationAccepted}
          onSignOutError={(message) =>
            setNotice({
              type: "error",
              message,
            })
          }
        />

        {notice ? (
          <div className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center px-4">
            <div
              aria-live="polite"
              className={`pointer-events-auto min-w-[16rem] rounded-full border px-4 py-2.5 text-sm shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl ${
                notice.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-danger"
              }`}
            >
              {notice.message}
            </div>
          </div>
        ) : null}

        <section className="min-w-0">
          <div className="glass-panel relative p-4 sm:p-5">
            <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-brand-gradient" />
            <div className="mx-auto max-w-3xl">
              <PomodoroPanel
                variant="page"
                formattedRemaining={pomodoro.formattedRemaining}
                onOpenWindow={handleOpenPomodoroWindow}
                onPause={pomodoro.pause}
                onReset={pomodoro.reset}
                onResume={pomodoro.resume}
                onSkipBreak={pomodoro.skipBreak}
                onStart={pomodoro.start}
                onUnlinkTask={pomodoro.unlinkTask}
                state={pomodoro.state}
              />
            </div>
          </div>
        </section>
      </div>
      </div>
    </main>
  );
}
