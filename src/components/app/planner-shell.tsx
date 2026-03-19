"use client";

import { useEffect, useMemo, useState } from "react";

import { DateSwitcher } from "@/components/app/date-switcher";
import { ExecutionLane } from "@/components/app/execution-lane";
import { PlannerHeader } from "@/components/app/planner-header";
import { TaskForm } from "@/components/app/task-form";
import { TaskModal } from "@/components/app/task-modal";
import { TimelineGrid } from "@/components/app/timeline-grid";
import { TimelineList } from "@/components/app/timeline-list";
import type { PlannerViewMode } from "@/components/app/view-toggle";
import {
  createTask,
  deleteTask,
  fetchDashboardSnapshot,
  rescheduleTask,
  toggleTaskStatus,
  updateTask,
} from "@/lib/client/daystack";
import {
  addMinutesToTime,
  buildSummary,
  calculateActiveStreak,
  ceilMinutesToInterval,
  formatDateKey,
  formatDateLabel,
  getPlannerDateMode,
  getRelativeDateLabel,
  getTaskAnchorId,
  getTaskVisualState,
  getTaskWindow,
  getUpcomingTasks,
  isBlockedTask,
  isValidDateKey,
  minutesToTime,
  toMinutes,
} from "@/lib/daystack";
import { cn, getErrorMessage } from "@/lib/utils";
import type {
  DailySummaryRecord,
  DashboardSnapshot,
  PlannerTask,
  TaskFormValues,
  UserNotificationPreferencesRecord,
} from "@/types/daystack";

interface PlannerShellProps {
  displayName: string;
  email?: string;
  initialNotificationPreferences: UserNotificationPreferencesRecord;
  userId: string;
  initialSnapshot: DashboardSnapshot;
}

type NoticeState =
  | {
      type: "success" | "error";
      message: string;
    }
  | null;

type BusyMode = "minor" | "navigation" | null;

function roundTime(now: Date) {
  const next = new Date(now);
  const roundedMinutes = ceilMinutesToInterval(now.getHours() * 60 + now.getMinutes(), 15);

  next.setHours(Math.floor(roundedMinutes / 60), roundedMinutes % 60, 0, 0);

  return minutesToTime(next.getHours() * 60 + next.getMinutes());
}

function getDefaultStartTime(taskDate: string, now: Date, startTimeOverride?: string) {
  if (startTimeOverride) {
    return startTimeOverride;
  }

  return taskDate === formatDateKey(now) ? roundTime(now) : "09:00";
}

function createDefaultTask(taskDate: string, now: Date, startTimeOverride?: string): TaskFormValues {
  const startTime = getDefaultStartTime(taskDate, now, startTimeOverride);

  return {
    title: "",
    taskDate,
    startTime,
    endTime: addMinutesToTime(startTime),
    taskType: "generic",
    meetingLink: "",
    participants: [],
  };
}

function getPlannerHref(taskDate: string, now: Date) {
  const todayDate = formatDateKey(now);
  return taskDate === todayDate ? "/app" : `/app?date=${taskDate}`;
}

function getSettingsHref(taskDate: string, now: Date) {
  const todayDate = formatDateKey(now);
  return taskDate === todayDate ? "/app/settings" : `/app/settings?date=${taskDate}`;
}

function sortTasksForPlanner(tasks: PlannerTask[]) {
  return [...tasks].sort((left, right) => {
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
}

function syncSnapshotWithTasks(
  current: DashboardSnapshot,
  userId: string,
  nextTasks: PlannerTask[],
): DashboardSnapshot {
  const tasks = sortTasksForPlanner(nextTasks);
  const summary = buildSummary(tasks);
  const existingSummary = current.recentSummaries.find((item) => item.summary_date === current.taskDate);
  const timestamp = new Date().toISOString();
  const liveSummary = (existingSummary ?? {
    id: `live-${current.taskDate}`,
    user_id: userId,
    summary_date: current.taskDate,
    created_at: timestamp,
    updated_at: timestamp,
  }) as DailySummaryRecord;
  const nextLiveSummary = {
    ...liveSummary,
    completed_tasks: summary.completedTasks,
    execution_score: summary.executionScore,
    successful_day: summary.successfulDay,
    total_tasks: summary.totalTasks,
    updated_at: timestamp,
  } satisfies DailySummaryRecord;
  const recentSummaries = [
    nextLiveSummary,
    ...current.recentSummaries.filter((item) => item.summary_date !== current.taskDate),
  ] as DailySummaryRecord[];

  return {
    ...current,
    recentSummaries,
    streak: calculateActiveStreak(recentSummaries, current.taskDate),
    summary,
    tasks,
  };
}

export function PlannerShell({
  displayName,
  email,
  initialNotificationPreferences,
  userId,
  initialSnapshot,
}: PlannerShellProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [busyMode, setBusyMode] = useState<BusyMode>(null);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [now, setNow] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<PlannerViewMode>("grid");
  const [editorTask, setEditorTask] = useState<PlannerTask | null>(null);
  const [composerDefaults, setComposerDefaults] = useState<TaskFormValues | null>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [followToday, setFollowToday] = useState(() => initialSnapshot.taskDate === formatDateKey(new Date()));
  const [settingsHighlighted, setSettingsHighlighted] = useState(false);
  const isPending = busyMode !== null;
  const isSurfaceRefreshing = busyMode === "navigation";

  function applyTasksToCurrentSnapshot(
    nextTasks: PlannerTask[] | ((currentTasks: PlannerTask[]) => PlannerTask[]),
  ) {
    setSnapshot((current) =>
      syncSnapshotWithTasks(
        current,
        userId,
        typeof nextTasks === "function" ? nextTasks(current.tasks) : nextTasks,
      ),
    );
  }

  function syncPlannerLocation(taskDate: string) {
    window.history.replaceState(window.history.state, "", getPlannerHref(taskDate, new Date()));
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  const todayDate = formatDateKey(now);

  useEffect(() => {
    if (!followToday || todayDate === snapshot.taskDate) {
      return;
    }

    setBusyMode("navigation");

    void (async () => {
      try {
        const nextSnapshot = await fetchDashboardSnapshot(todayDate);
        setSnapshot(nextSnapshot);
        setFollowToday(true);
        syncPlannerLocation(todayDate);
      } catch (error) {
        setNotice({
          type: "error",
          message: getErrorMessage(error),
        });
      } finally {
        setBusyMode(null);
      }
    })();
  }, [followToday, snapshot.taskDate, todayDate]);

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
    if (!settingsHighlighted) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSettingsHighlighted(false);
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [settingsHighlighted]);

  async function handleSaveTask(values: TaskFormValues) {
    const shouldHighlightSettings =
      !editorTask &&
      snapshot.tasks.length === 0 &&
      !initialNotificationPreferences.push_enabled;
    const shouldRefreshSnapshot = values.taskDate !== snapshot.taskDate;

    setBusyMode(shouldRefreshSnapshot ? "navigation" : "minor");

    try {
      const savedTask = editorTask
        ? await updateTask(editorTask.id, values)
        : await createTask(values);

      const nextPlannerTask: PlannerTask = {
        ...savedTask,
        participants: values.taskType === "meeting" ? values.participants : [],
      };

      if (shouldRefreshSnapshot) {
        const nextSnapshot = await fetchDashboardSnapshot(values.taskDate);
        setSnapshot(nextSnapshot);
      } else if (editorTask) {
        applyTasksToCurrentSnapshot((currentTasks) =>
          currentTasks.map((task) => (task.id === editorTask.id ? nextPlannerTask : task)),
        );
      } else {
        applyTasksToCurrentSnapshot((currentTasks) => [...currentTasks, nextPlannerTask]);
      }

      setFollowToday(values.taskDate === formatDateKey(new Date()));
      syncPlannerLocation(values.taskDate);
      setEditorTask(null);
      setComposerDefaults(null);
      setNotice({
        type: "success",
        message: editorTask ? "Block updated." : "Block added.",
      });

      if (shouldHighlightSettings) {
        setSettingsHighlighted(true);
      }
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setBusyMode(null);
    }
  }

  function handleEditTask(task: PlannerTask) {
    setEditorTask(task);
    setComposerDefaults(null);
    setNotice(null);
  }

  function handleCreateTask(startTime?: string) {
    setEditorTask(null);
    setComposerDefaults(createDefaultTask(snapshot.taskDate, now, startTime));
    setNotice(null);
  }

  function handleCancelEditor() {
    setEditorTask(null);
    setComposerDefaults(null);
  }

  function handleSelectDate(nextDate: string) {
    if (!isValidDateKey(nextDate) || nextDate === snapshot.taskDate) {
      return;
    }

    setEditorTask(null);
    setComposerDefaults(null);
    setFocusedTaskId(null);
    setNotice(null);

    setBusyMode("navigation");

    void (async () => {
      try {
        const nextSnapshot = await fetchDashboardSnapshot(nextDate);
        setSnapshot(nextSnapshot);
        setFollowToday(nextDate === formatDateKey(new Date()));
        syncPlannerLocation(nextDate);
      } catch (error) {
        setNotice({
          type: "error",
          message: getErrorMessage(error),
        });
      } finally {
        setBusyMode(null);
      }
    })();
  }

  function handleDeleteTask(task: PlannerTask) {
    const confirmed = window.confirm(`Delete "${task.title}"?`);

    if (!confirmed) {
      return;
    }

    const previousSnapshot = snapshot;
    setBusyMode("minor");

    void (async () => {
      try {
        const taskDate = await deleteTask(task.id);
        applyTasksToCurrentSnapshot((currentTasks) =>
          currentTasks.filter((currentTask) => currentTask.id !== task.id),
        );
        setFollowToday(taskDate === formatDateKey(new Date()));
        syncPlannerLocation(taskDate);

        if (editorTask?.id === task.id) {
          setEditorTask(null);
          setComposerDefaults(null);
        }

        setNotice({
          type: "success",
          message: "Block deleted.",
        });
      } catch (error) {
        setSnapshot(previousSnapshot);
        setNotice({
          type: "error",
          message: getErrorMessage(error),
        });
      } finally {
        setBusyMode(null);
      }
    })();
  }

  function handleToggleTask(task: PlannerTask) {
    const previousSnapshot = snapshot;
    const nextStatus = task.status === "completed" ? "pending" : "completed";

    applyTasksToCurrentSnapshot((currentTasks) =>
      currentTasks.map((currentTask) =>
        currentTask.id === task.id
          ? {
              ...currentTask,
              status: nextStatus,
            }
          : currentTask,
      ),
    );
    setBusyMode("minor");

    void (async () => {
      try {
        await toggleTaskStatus(task.id, nextStatus);
        setFollowToday(task.task_date === formatDateKey(new Date()));
        syncPlannerLocation(task.task_date);
        setNotice({
          type: "success",
          message: task.status === "completed" ? "Block marked pending." : "Block marked complete.",
        });
      } catch (error) {
        setSnapshot(previousSnapshot);
        setNotice({
          type: "error",
          message: getErrorMessage(error),
        });
      } finally {
        setBusyMode(null);
      }
    })();
  }

  function handleNotificationNotice(nextNotice: NonNullable<NoticeState>) {
    setNotice(nextNotice);
  }

  async function handleNotificationAccepted(result: { acceptedTaskId: string | null; taskDate: string }) {
    if (result.taskDate !== snapshot.taskDate) {
      return;
    }

    setBusyMode("minor");

    try {
      const nextSnapshot = await fetchDashboardSnapshot(result.taskDate);
      setSnapshot(nextSnapshot);
      setFollowToday(result.taskDate === formatDateKey(new Date()));

      if (result.acceptedTaskId) {
        window.setTimeout(() => {
          handleFocusTask(result.acceptedTaskId!);
        }, 80);
      }
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setBusyMode(null);
    }
  }

  function handleRescheduleTask(task: PlannerTask, nextStartTime: string, nextEndTime: string) {
    const previousSnapshot = snapshot;
    const optimisticTasks = sortTasksForPlanner(
      snapshot.tasks.map((currentTask) =>
        currentTask.id === task.id
          ? {
              ...currentTask,
              end_time: nextEndTime,
              start_time: nextStartTime,
            }
          : currentTask,
      ),
    );

    applyTasksToCurrentSnapshot(optimisticTasks);
    setBusyMode("minor");

    void (async () => {
      try {
        await rescheduleTask(task.id, {
          endTime: nextEndTime,
          startTime: nextStartTime,
          taskDate: snapshot.taskDate,
        });
      } catch (error) {
        setSnapshot(previousSnapshot);
        setNotice({
          type: "error",
          message: getErrorMessage(error),
        });
      } finally {
        setBusyMode(null);
      }
    })();
  }

  function handleFocusTask(taskId: string) {
    setFocusedTaskId(taskId);

    window.requestAnimationFrame(() => {
      document.getElementById(getTaskAnchorId(taskId))?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });

    window.setTimeout(() => {
      setFocusedTaskId((current) => (current === taskId ? null : current));
    }, 1800);
  }

  const dateMode = useMemo(() => getPlannerDateMode(snapshot.taskDate, now), [now, snapshot.taskDate]);
  const currentWindow = useMemo(
    () => getTaskWindow(snapshot.tasks, now, snapshot.taskDate),
    [now, snapshot.taskDate, snapshot.tasks],
  );
  const queue = useMemo(() => {
    const blockedIds = new Set(
      [currentWindow.currentTask?.id, currentWindow.nextTask?.id].filter(Boolean),
    );

    return getUpcomingTasks(snapshot.tasks, now, snapshot.taskDate, 6)
      .filter((task) => !blockedIds.has(task.id))
      .slice(0, 4);
  }, [currentWindow.currentTask?.id, currentWindow.nextTask?.id, now, snapshot.taskDate, snapshot.tasks]);
  const dateLabel = useMemo(() => formatDateLabel(snapshot.taskDate), [snapshot.taskDate]);
  const relativeDateLabel = useMemo(
    () => getRelativeDateLabel(snapshot.taskDate, now),
    [now, snapshot.taskDate],
  );
  const blockedCount = useMemo(
    () => snapshot.tasks.filter((task) => isBlockedTask(task)).length,
    [snapshot.tasks],
  );
  const plannerHref = useMemo(() => getPlannerHref(snapshot.taskDate, now), [now, snapshot.taskDate]);
  const settingsHref = useMemo(() => getSettingsHref(snapshot.taskDate, now), [now, snapshot.taskDate]);
  const headerMetric = useMemo<{
    label: string;
    tone: "brand" | "default" | "success" | "warning";
  }>(() => {
    if (dateMode === "future") {
      return {
        label:
          snapshot.summary.totalTasks > 0
            ? `${snapshot.summary.totalTasks} planned`
            : blockedCount > 0
              ? `${blockedCount} blocked`
              : "Open day",
        tone: snapshot.summary.totalTasks > 0 ? "brand" : "default",
      };
    }

    if (dateMode === "past") {
      return {
        label: `${snapshot.summary.executionScore}% complete`,
        tone:
          snapshot.summary.executionScore >= 70
            ? "success"
            : snapshot.summary.executionScore > 0
              ? "warning"
              : "default",
      };
    }

    return {
      label: `${snapshot.summary.executionScore}% score`,
      tone:
        snapshot.summary.executionScore >= 70
          ? "success"
          : snapshot.summary.executionScore > 0
            ? "warning"
            : "default",
    };
  }, [blockedCount, dateMode, snapshot.summary.executionScore, snapshot.summary.totalTasks]);
  const isComposerOpen = editorTask !== null || composerDefaults !== null;
  const formValues = useMemo(
    () =>
      editorTask
        ? {
            title: editorTask.title,
            taskDate: editorTask.task_date,
            startTime: editorTask.start_time.slice(0, 5),
            endTime: editorTask.end_time.slice(0, 5),
            taskType: editorTask.task_type,
            meetingLink: editorTask.meeting_link ?? "",
            participants: editorTask.participants,
          }
        : composerDefaults ?? createDefaultTask(snapshot.taskDate, now),
    [composerDefaults, editorTask, now, snapshot.taskDate],
  );

  return (
    <main className="container-shell min-h-screen py-4 sm:py-6">
      <div className="space-y-4 sm:space-y-5">
        <PlannerHeader
          activePage="planner"
          displayName={displayName}
          email={email}
          dateLabel={dateLabel}
          dateMode={dateMode}
          metricLabel={headerMetric.label}
          metricTone={headerMetric.tone}
          plannerHref={plannerHref}
          settingsHighlighted={settingsHighlighted}
          settingsHref={settingsHref}
          streak={snapshot.streak}
          subtitle={
            dateMode === "future"
              ? "Plan another day without losing the timeline."
              : dateMode === "past"
                ? "Review what this day looked like."
                : "Plan and execute in one surface."
          }
          viewMode={viewMode}
          onAddTask={() => handleCreateTask()}
          onNotice={handleNotificationNotice}
          onTaskAccepted={handleNotificationAccepted}
          onViewChange={setViewMode}
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

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="min-w-0 space-y-4">
            <div
              className={cn("glass-panel relative p-4 sm:p-5", isSurfaceRefreshing && "opacity-90")}
              aria-busy={isSurfaceRefreshing}
            >
              <div
                className={cn(
                  "pointer-events-none absolute inset-x-6 top-0 h-px bg-brand-gradient transition-opacity duration-150",
                  isSurfaceRefreshing ? "opacity-100" : "opacity-0",
                )}
              />

              <div className="flex flex-col gap-4 border-b border-border/70 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="section-label">Day Plan</p>
                    <h2 className="mt-1 font-display text-2xl font-semibold text-foreground sm:text-[2rem]">
                      Day Plan
                    </h2>
                    <p className="mt-1.5 text-sm text-secondary-foreground">
                      {dateMode === "future"
                        ? "Choose the day you want to structure and place blocks before it starts."
                        : dateMode === "past"
                          ? "Review the timeline for this day and what was left open."
                          : "See the schedule by time and keep the next move clear."}
                    </p>
                  </div>
                  <div className="hidden flex-wrap items-center gap-2 sm:flex">
                    <span className="data-chip">{relativeDateLabel}</span>
                    <span className="data-chip">
                      {snapshot.tasks.length} block{snapshot.tasks.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                <DateSwitcher
                  dateLabel={dateLabel}
                  dateMode={dateMode}
                  isPending={isSurfaceRefreshing}
                  onSelectDate={handleSelectDate}
                  selectedDate={snapshot.taskDate}
                  todayDate={todayDate}
                />
              </div>

              <div className="mt-4">
                {viewMode === "grid" ? (
                  <TimelineGrid
                    focusedTaskId={focusedTaskId}
                    tasks={snapshot.tasks}
                    taskDate={snapshot.taskDate}
                    now={now}
                    resolveVisualState={(task) => getTaskVisualState(task, now, snapshot.taskDate)}
                    isPending={isPending}
                    onAddTask={handleCreateTask}
                    onEditTask={handleEditTask}
                    onRescheduleTask={handleRescheduleTask}
                    onToggleTask={handleToggleTask}
                  />
                ) : (
                  <TimelineList
                    focusedTaskId={focusedTaskId}
                    tasks={snapshot.tasks}
                    resolveVisualState={(task) => getTaskVisualState(task, now, snapshot.taskDate)}
                    isPending={isPending}
                    onAddTask={handleCreateTask}
                    onEditTask={handleEditTask}
                    onDeleteTask={handleDeleteTask}
                    onToggleTask={handleToggleTask}
                  />
                )}
              </div>
            </div>
          </section>

          <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start">
            <ExecutionLane
              currentTask={currentWindow.currentTask}
              dateLabel={dateLabel}
              dateMode={dateMode}
              isPending={isPending}
              nextTask={currentWindow.nextTask}
              onEditTask={handleEditTask}
              onFocusTask={handleFocusTask}
              onToggleTask={handleToggleTask}
              queue={queue}
              streak={snapshot.streak}
              summary={snapshot.summary}
              tasks={snapshot.tasks}
            />
          </aside>
        </div>
      </div>

      <TaskModal
        open={isComposerOpen}
        title={editorTask ? "Edit block" : "Add block"}
        description={
          editorTask
            ? "Adjust the timing, date, or details for this block."
            : `Add the next focused block for ${formatDateLabel(formValues.taskDate)}.`
        }
        onClose={handleCancelEditor}
      >
        <TaskForm
          key={`${editorTask?.id ?? formValues.startTime}-${snapshot.taskDate}-${isComposerOpen ? "open" : "closed"}`}
          currentUserId={userId}
          mode={editorTask ? "edit" : "create"}
          initialValues={formValues}
          isPending={isPending}
          onCancel={handleCancelEditor}
          onDelete={editorTask ? () => handleDeleteTask(editorTask) : undefined}
          onSubmit={handleSaveTask}
        />
      </TaskModal>
    </main>
  );
}
