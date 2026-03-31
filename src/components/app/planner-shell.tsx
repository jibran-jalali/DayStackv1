"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DateSwitcher } from "@/components/app/date-switcher";
import { DashboardView } from "@/components/app/dashboard-view";
import { LeaderboardView } from "@/components/app/leaderboard-view";
import { PlannerHeader } from "@/components/app/planner-header";
import { RecurringBlocksView } from "@/components/app/recurring-blocks-view";
import { RecurringScopeModal } from "@/components/app/recurring-scope-modal";
import { TaskForm } from "@/components/app/task-form";
import { TaskModal } from "@/components/app/task-modal";
import { TimelineGrid } from "@/components/app/timeline-grid";
import { TimelineList } from "@/components/app/timeline-list";
import type { PlannerViewMode } from "@/components/app/view-toggle";
import {
  createTask,
  deleteRecurringSeries,
  deleteTask,
  fetchDashboardSnapshot,
  rescheduleTask,
  toggleTaskStatus,
  updateRecurringSeries,
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
  getTaskVisualState,
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
  RecurringBlockSummary,
  RecurringTaskScope,
  TaskFormValues,
  TaskNotificationAcceptResult,
  TaskPropagationMode,
} from "@/types/daystack";

interface PlannerShellProps {
  displayName: string;
  email?: string;
  initialNowIso: string;
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

type RecurringScopeRequest =
  | {
      actionLabel: string;
      resolve: (scope: RecurringTaskScope | null) => void;
      task: PlannerTask;
    }
  | null;

type RecurringSeriesEditorState =
  | {
      block: RecurringBlockSummary;
      fromDate: string;
    }
  | null;

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
    blockMode: "one_time",
    title: "",
    taskDate,
    startTime,
    endTime: addMinutesToTime(startTime),
    taskType: "generic",
    meetingLink: "",
    participants: [],
    weekdays: [],
  };
}

function getPlannerHref(taskDate: string, now: Date) {
  const todayDate = formatDateKey(now);
  return taskDate === todayDate ? "/app" : `/app?date=${taskDate}`;
}

function getPomodoroHref(taskDate: string, now: Date, params?: Record<string, string>) {
  const todayDate = formatDateKey(now);
  const searchParams = new URLSearchParams();

  if (taskDate !== todayDate) {
    searchParams.set("date", taskDate);
  }

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      searchParams.set(key, value);
    });
  }

  const query = searchParams.toString();

  return query ? `/app/pomodoro?${query}` : "/app/pomodoro";
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

function resolvePropagationMode(task: PlannerTask, actionLabel: string): TaskPropagationMode {
  if (task.task_type !== "meeting" || task.acceptedCopiesCount === 0) {
    return "owner_only";
  }

  const updateAcceptedCopies = window.confirm(
    `${task.acceptedCopiesCount} accepted cop${task.acceptedCopiesCount === 1 ? "y is" : "ies are"} linked to this meeting. Click OK to ${actionLabel} both your block and the accepted copies, or Cancel to change only your block.`,
  );

  return updateAcceptedCopies ? "owner_and_accepted_copies" : "owner_only";
}

export function PlannerShell({
  displayName,
  email,
  initialNowIso,
  userId,
  initialSnapshot,
}: PlannerShellProps) {
  const router = useRouter();
  const initialNow = useMemo(() => new Date(initialNowIso), [initialNowIso]);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [busyMode, setBusyMode] = useState<BusyMode>(null);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [now, setNow] = useState(initialNow);
  const [viewMode, setViewMode] = useState<PlannerViewMode>("grid");
  const [editorTask, setEditorTask] = useState<PlannerTask | null>(null);
  const [recurringSeriesEditor, setRecurringSeriesEditor] = useState<RecurringSeriesEditorState>(null);
  const [composerDefaults, setComposerDefaults] = useState<TaskFormValues | null>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [followToday, setFollowToday] = useState(() => initialSnapshot.taskDate === formatDateKey(initialNow));
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [recurringScopeRequest, setRecurringScopeRequest] = useState<RecurringScopeRequest>(null);
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

  function clearSelection() {
    setSelectionMode(false);
    setSelectedTaskIds([]);
  }

  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId],
    );
  }

  function requestRecurringScope(task: PlannerTask, actionLabel: string) {
    if (!task.recurring_rule_id) {
      return Promise.resolve<RecurringTaskScope | null>("occurrence_only");
    }

    return new Promise<RecurringTaskScope | null>((resolve) => {
      setRecurringScopeRequest({
        actionLabel,
        resolve,
        task,
      });
    });
  }

  function handleCloseRecurringScope() {
    setRecurringScopeRequest((current) => {
      if (current) {
        current.resolve(null);
      }

      return null;
    });
  }

  function handleChooseRecurringScope(scope: RecurringTaskScope) {
    setRecurringScopeRequest((current) => {
      if (current) {
        current.resolve(scope);
      }

      return null;
    });
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  const todayDate = formatDateKey(now);

  useEffect(() => {
    if (viewMode === "list") {
      return;
    }

    setSelectionMode(false);
    setSelectedTaskIds([]);
  }, [viewMode]);

  useEffect(() => {
    setSelectedTaskIds((current) => current.filter((id) => snapshot.tasks.some((task) => task.id === id)));
  }, [snapshot.tasks]);

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

  async function handleSaveTask(values: TaskFormValues) {
    const recurrenceScope = editorTask ? await requestRecurringScope(editorTask, "change") : "occurrence_only";

    if (editorTask && !recurrenceScope) {
      return;
    }

    const propagationMode = editorTask
      ? resolvePropagationMode(editorTask, "edit")
      : "owner_only";
    const isRecurringCreate = !editorTask && values.blockMode === "recurring";
    const isRecurringSeriesEdit = Boolean(
      editorTask?.recurring_rule_id && recurrenceScope !== "occurrence_only",
    );
    const shouldRefreshSnapshot =
      values.taskDate !== snapshot.taskDate ||
      propagationMode === "owner_and_accepted_copies" ||
      isRecurringCreate ||
      isRecurringSeriesEdit;

    setBusyMode(shouldRefreshSnapshot ? "navigation" : "minor");

    try {
      const savedTask = editorTask
        ? await updateTask(editorTask.id, values, propagationMode, recurrenceScope ?? "occurrence_only")
        : await createTask(values);

      const nextPlannerTask: PlannerTask = {
        acceptedCopiesCount: editorTask?.acceptedCopiesCount ?? 0,
        ...savedTask,
        participants: values.taskType === "meeting" ? values.participants : [],
        recurringSeriesId: editorTask?.recurringSeriesId ?? null,
        recurringWeekdays: editorTask?.recurringWeekdays ?? [],
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
    setRecurringSeriesEditor(null);
    setEditorTask(task);
    setComposerDefaults(null);
    setNotice(null);
  }

  function handleEditRecurringBlock(block: RecurringBlockSummary) {
    setEditorTask(null);
    setComposerDefaults(null);
    setRecurringSeriesEditor({
      block,
      fromDate: getRecurringSeriesEditDate(block),
    });
    setNotice(null);
  }

  function handleCreateTask(startTime?: string) {
    setEditorTask(null);
    setRecurringSeriesEditor(null);
    setComposerDefaults(createDefaultTask(snapshot.taskDate, now, startTime));
    setNotice(null);
  }

  function handleCancelEditor() {
    setEditorTask(null);
    setRecurringSeriesEditor(null);
    setComposerDefaults(null);
  }

  async function handleSaveRecurringBlock(values: TaskFormValues) {
    if (!recurringSeriesEditor) {
      return;
    }

    setBusyMode("navigation");

    try {
      await updateRecurringSeries(recurringSeriesEditor.block.seriesId, values);
      const nextSnapshot = await fetchDashboardSnapshot(snapshot.taskDate);
      setSnapshot(nextSnapshot);
      setRecurringSeriesEditor(null);
      setComposerDefaults(null);
      setNotice({
        type: "success",
        message: "Recurring block updated.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setBusyMode(null);
    }
  }

  function handleDeleteRecurringBlock(block: RecurringBlockSummary) {
    const fromDate = getRecurringSeriesEditDate(block);
    const confirmed = window.confirm(
      `Delete "${block.title}" from ${formatDateLabel(fromDate)} onward? Past blocks will stay in your history.`,
    );

    if (!confirmed) {
      return;
    }

    setBusyMode("navigation");

    void (async () => {
      try {
        await deleteRecurringSeries(block.seriesId, fromDate);
        const refreshedSnapshot = await fetchDashboardSnapshot(snapshot.taskDate);
        setSnapshot(refreshedSnapshot);

        if (recurringSeriesEditor?.block.seriesId === block.seriesId) {
          setRecurringSeriesEditor(null);
        }

        setComposerDefaults(null);
        setNotice({
          type: "success",
          message: "Recurring block deleted.",
        });
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

  function handleSelectDate(nextDate: string) {
    if (!isValidDateKey(nextDate) || nextDate === snapshot.taskDate) {
      return;
    }

    clearSelection();
    setEditorTask(null);
    setRecurringSeriesEditor(null);
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
    void (async () => {
      const recurrenceScope = await requestRecurringScope(task, "delete");

      if (!recurrenceScope) {
        return;
      }

      const confirmed = window.confirm(
        recurrenceScope === "occurrence_only"
          ? `Delete "${task.title}"?`
          : `Delete "${task.title}" and apply it to the selected recurring scope?`,
      );

      if (!confirmed) {
        return;
      }

      const previousSnapshot = snapshot;
      const shouldRefreshSnapshot = Boolean(task.recurring_rule_id && recurrenceScope !== "occurrence_only");
      setBusyMode(shouldRefreshSnapshot ? "navigation" : "minor");

      try {
        const taskDate = await deleteTask(task.id, recurrenceScope);

        if (shouldRefreshSnapshot) {
          const refreshedSnapshot = await fetchDashboardSnapshot(snapshot.taskDate);
          setSnapshot(refreshedSnapshot);
        } else {
          applyTasksToCurrentSnapshot((currentTasks) =>
            currentTasks.filter((currentTask) => currentTask.id !== task.id),
          );
        }

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

  function handleDeleteSelectedTasks() {
    if (selectedTaskIds.length === 0) {
      return;
    }

    const idsToDelete = [...selectedTaskIds];
    const confirmed = window.confirm(
      `Delete ${idsToDelete.length} selected block${idsToDelete.length === 1 ? "" : "s"}?`,
    );

    if (!confirmed) {
      return;
    }

    setBusyMode("minor");

    void (async () => {
      try {
        let taskDate = snapshot.taskDate;

        for (const taskId of idsToDelete) {
          taskDate = await deleteTask(taskId);
        }

        applyTasksToCurrentSnapshot((currentTasks) =>
          currentTasks.filter((currentTask) => !idsToDelete.includes(currentTask.id)),
        );
        setFollowToday(taskDate === formatDateKey(new Date()));
        syncPlannerLocation(taskDate);

        if (editorTask && idsToDelete.includes(editorTask.id)) {
          setEditorTask(null);
          setComposerDefaults(null);
        }

        clearSelection();
        setNotice({
          type: "success",
          message: `${idsToDelete.length} block${idsToDelete.length === 1 ? "" : "s"} deleted.`,
        });
      } catch (error) {
        try {
          const refreshedSnapshot = await fetchDashboardSnapshot(snapshot.taskDate);
          setSnapshot(refreshedSnapshot);
          setFollowToday(snapshot.taskDate === formatDateKey(new Date()));
          syncPlannerLocation(snapshot.taskDate);
        } catch {
          // Keep the current error notice; the next full refresh can recover if the snapshot reload also fails.
        }

        clearSelection();
        setNotice({
          type: "error",
          message: getErrorMessage(error),
        });
      } finally {
        setBusyMode(null);
      }
    })();
  }

  function handleRescheduleTask(task: PlannerTask, nextStartTime: string, nextEndTime: string) {
    void (async () => {
      const recurrenceScope = await requestRecurringScope(task, "reschedule");

      if (!recurrenceScope) {
        return;
      }

      const previousSnapshot = snapshot;
      const propagationMode = resolvePropagationMode(task, "reschedule");
      const canUseOptimisticUpdate =
        propagationMode !== "owner_and_accepted_copies" && recurrenceScope === "occurrence_only";

      if (canUseOptimisticUpdate) {
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
      }

      setBusyMode(canUseOptimisticUpdate ? "minor" : "navigation");

      try {
        await rescheduleTask(
          task.id,
          {
            endTime: nextEndTime,
            startTime: nextStartTime,
            taskDate: snapshot.taskDate,
          },
          propagationMode,
          recurrenceScope,
        );

        if (!canUseOptimisticUpdate) {
          const refreshedSnapshot = await fetchDashboardSnapshot(snapshot.taskDate);
          setSnapshot(refreshedSnapshot);
        }
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

  function handleStartFocusTask(task: PlannerTask) {
    router.push(
      getPomodoroHref(task.task_date, new Date(), {
        autostart: "1",
        taskId: task.id,
      }),
    );
  }

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

  const dateMode = useMemo(() => getPlannerDateMode(snapshot.taskDate, now), [now, snapshot.taskDate]);
  const dateLabel = useMemo(() => formatDateLabel(snapshot.taskDate), [snapshot.taskDate]);
  const pomodoroHref = useMemo(
    () => getPomodoroHref(snapshot.taskDate, now),
    [now, snapshot.taskDate],
  );
  const notificationsHref = useMemo(
    () => (snapshot.taskDate === todayDate ? "/app/notifications" : `/app/notifications?date=${snapshot.taskDate}`),
    [snapshot.taskDate, todayDate],
  );
  const relativeDateLabel = useMemo(
    () => getRelativeDateLabel(snapshot.taskDate, now),
    [now, snapshot.taskDate],
  );
  const blockedCount = useMemo(
    () => snapshot.tasks.filter((task) => isBlockedTask(task)).length,
    [snapshot.tasks],
  );
  const viewCopy = useMemo(() => {
    if (viewMode === "recurring") {
      return {
        description: "See every recurring block already in your weekly rhythm and change the series without another page load.",
        eyebrow: "Weekly rhythm",
        title: "Recurring Blocks",
      };
    }

    if (viewMode === "leaderboard") {
      return {
        description: "See the strongest current streaks across DayStack without leaving the planner surface.",
        eyebrow: "Competition",
        title: "Leaderboard",
      };
    }

    if (viewMode === "dashboard") {
      return {
        description:
          dateMode === "future"
            ? "See progress, streak, and the first move for this plan."
            : dateMode === "past"
              ? "See progress, streak, and the next move for this day."
              : "See progress, streak, and the next move in one place.",
        eyebrow: "Command center",
        title: "Dashboard",
      };
    }

    return {
      description:
        dateMode === "future"
          ? "Choose the day you want to structure and place blocks before it starts."
          : dateMode === "past"
            ? "Review the timeline for this day and what was left open."
            : "See the schedule by time and keep the next move clear.",
      eyebrow: "Day Plan",
      title: "Day Plan",
    };
  }, [dateMode, viewMode]);
  const headerMetric = useMemo<{
    label: string;
    tone: "brand" | "default" | "success" | "warning";
  }>(() => {
    if (viewMode === "recurring") {
      return {
        label:
          snapshot.recurringBlocks.length > 0
            ? `${snapshot.recurringBlocks.length} recurring`
            : "No series",
        tone: snapshot.recurringBlocks.length > 0 ? "brand" : "default",
      };
    }

    if (viewMode === "leaderboard") {
      const topStreak = snapshot.leaderboard[0]?.currentStreak ?? 0;

      return {
        label: topStreak > 0 ? `${topStreak} day best` : "Top 10",
        tone: topStreak > 0 ? "brand" : "default",
      };
    }

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
  }, [
    blockedCount,
    dateMode,
    snapshot.leaderboard,
    snapshot.recurringBlocks.length,
    snapshot.summary.executionScore,
    snapshot.summary.totalTasks,
    viewMode,
  ]);
  const isComposerOpen = editorTask !== null || recurringSeriesEditor !== null || composerDefaults !== null;
  const formValues = useMemo<TaskFormValues>(
    () =>
      editorTask
        ? {
            blockMode: editorTask.recurring_rule_id ? "recurring" : "one_time",
            title: editorTask.title,
            taskDate: editorTask.task_date,
            startTime: editorTask.start_time.slice(0, 5),
            endTime: editorTask.end_time.slice(0, 5),
            taskType: editorTask.task_type,
            meetingLink: editorTask.meeting_link ?? "",
            participants: editorTask.participants,
            weekdays: editorTask.recurringWeekdays,
          }
        : recurringSeriesEditor
          ? {
              blockMode: "recurring",
              title: recurringSeriesEditor.block.title,
              taskDate: recurringSeriesEditor.fromDate,
              startTime: recurringSeriesEditor.block.startTime.slice(0, 5),
              endTime: recurringSeriesEditor.block.endTime.slice(0, 5),
              taskType: recurringSeriesEditor.block.taskType,
              meetingLink: recurringSeriesEditor.block.meetingLink ?? "",
              participants: recurringSeriesEditor.block.participants,
              weekdays: recurringSeriesEditor.block.weekdays,
            }
        : composerDefaults ?? createDefaultTask(snapshot.taskDate, now),
    [composerDefaults, editorTask, now, recurringSeriesEditor, snapshot.taskDate],
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
          notificationsHref={notificationsHref}
          showNotificationCenter
          streak={snapshot.streak}
          subtitle={
            dateMode === "future"
              ? "Plan another day without losing the timeline."
              : dateMode === "past"
                ? "Review what this day looked like."
                : "Plan and execute in one surface."
          }
          viewMode={viewMode}
          pomodoroHref={pomodoroHref}
          onAddTask={() => handleCreateTask()}
          onNotice={setNotice}
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

        <section className="min-w-0">
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
                  <p className="section-label">{viewCopy.eyebrow}</p>
                  <h2 className="mt-1 font-display text-2xl font-semibold text-foreground sm:text-[2rem]">
                    {viewCopy.title}
                  </h2>
                  <p className="mt-1.5 text-sm text-secondary-foreground">{viewCopy.description}</p>
                </div>
                <div className="hidden flex-wrap items-center gap-2 sm:flex">
                  <span className="data-chip">{relativeDateLabel}</span>
                  <span className="data-chip">
                    {viewMode === "recurring"
                      ? `${snapshot.recurringBlocks.length} recurring`
                      : `${snapshot.tasks.length} block${snapshot.tasks.length === 1 ? "" : "s"}`}
                  </span>
                  {viewMode === "list" && snapshot.tasks.length > 0 && !selectionMode ? (
                    <button
                      suppressHydrationWarning
                      type="button"
                      className="inline-flex h-9 items-center justify-center rounded-full border border-border/80 bg-white/92 px-3 text-sm font-semibold text-foreground shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-[transform,opacity,box-shadow,background-color,border-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_16px_32px_rgba(15,23,42,0.09)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)] disabled:translate-y-0 disabled:opacity-60"
                      onClick={() => setSelectionMode(true)}
                      disabled={isPending}
                    >
                      Select
                    </button>
                  ) : null}
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

              {viewMode === "list" && snapshot.tasks.length > 0 && !selectionMode ? (
                <div className="sm:hidden">
                  <button
                    suppressHydrationWarning
                    type="button"
                    className="inline-flex h-10 items-center justify-center rounded-full border border-border/80 bg-white/92 px-4 text-sm font-semibold text-foreground shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-[transform,opacity,box-shadow,background-color,border-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_16px_32px_rgba(15,23,42,0.09)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)] disabled:translate-y-0 disabled:opacity-60"
                    onClick={() => setSelectionMode(true)}
                    disabled={isPending}
                  >
                    Select
                  </button>
                </div>
              ) : null}

              {viewMode === "list" && selectionMode ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-border/80 bg-white/86 px-3 py-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {selectedTaskIds.length} selected
                    </span>
                    <span className="hidden text-xs text-secondary-foreground sm:inline">
                      Choose the blocks you want to delete together.
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      suppressHydrationWarning
                      type="button"
                      className="inline-flex h-10 items-center justify-center rounded-full border border-red-200 bg-red-50 px-4 text-sm font-semibold text-danger shadow-[0_10px_24px_rgba(239,68,68,0.1)] transition-[transform,opacity,box-shadow,background-color,border-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:bg-red-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)] disabled:translate-y-0 disabled:opacity-60"
                      onClick={handleDeleteSelectedTasks}
                      disabled={isPending || selectedTaskIds.length === 0}
                    >
                      Delete selected
                    </button>
                    <button
                      suppressHydrationWarning
                      type="button"
                      className="inline-flex h-10 items-center justify-center rounded-full border border-border/80 bg-white/92 px-4 text-sm font-semibold text-foreground shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-[transform,opacity,box-shadow,background-color,border-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_16px_32px_rgba(15,23,42,0.09)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)] disabled:translate-y-0 disabled:opacity-60"
                      onClick={clearSelection}
                      disabled={isPending}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4">
              {viewMode === "dashboard" ? (
                <DashboardView
                  dateLabel={dateLabel}
                  dateMode={dateMode}
                  isPending={isPending}
                  now={now}
                  onAddTask={() => handleCreateTask()}
                  onEditTask={handleEditTask}
                  onStartFocusTask={handleStartFocusTask}
                  streak={snapshot.streak}
                  summary={snapshot.summary}
                  taskDate={snapshot.taskDate}
                  tasks={snapshot.tasks}
                />
              ) : viewMode === "recurring" ? (
                <RecurringBlocksView
                  blocks={snapshot.recurringBlocks}
                  isPending={isPending}
                  onDeleteBlock={handleDeleteRecurringBlock}
                  onEditBlock={handleEditRecurringBlock}
                />
              ) : viewMode === "leaderboard" ? (
                <LeaderboardView currentUserId={userId} entries={snapshot.leaderboard} />
              ) : viewMode === "grid" ? (
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
                  onStartFocusTask={handleStartFocusTask}
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
                  onStartFocusTask={handleStartFocusTask}
                  onToggleTaskSelection={toggleTaskSelection}
                  onToggleTask={handleToggleTask}
                  selectedTaskIds={selectedTaskIds}
                  selectionMode={selectionMode}
                />
              )}
            </div>
          </div>
        </section>
      </div>

      <TaskModal
        open={isComposerOpen}
        title={editorTask || recurringSeriesEditor ? "Edit block" : "Add block"}
        description={
          recurringSeriesEditor
            ? `Changes will apply from ${formatDateLabel(formValues.taskDate)} onward for this recurring block.`
            : editorTask
              ? "Adjust the timing, date, or details for this block."
              : `Add the next focused block for ${formatDateLabel(formValues.taskDate)}.`
        }
        eyebrow={recurringSeriesEditor ? "Recurring series" : undefined}
        onClose={handleCancelEditor}
      >
        <TaskForm
          key={`${editorTask?.id ?? recurringSeriesEditor?.block.seriesId ?? formValues.startTime}-${snapshot.taskDate}-${isComposerOpen ? "open" : "closed"}`}
          currentUserId={userId}
          mode={editorTask || recurringSeriesEditor ? "edit" : "create"}
          initialValues={formValues}
          isPending={isPending}
          onCancel={handleCancelEditor}
          onDelete={
            recurringSeriesEditor
              ? () => handleDeleteRecurringBlock(recurringSeriesEditor.block)
              : editorTask
                ? () => handleDeleteTask(editorTask)
                : undefined
          }
          onSubmit={recurringSeriesEditor ? handleSaveRecurringBlock : handleSaveTask}
        />
      </TaskModal>

      <RecurringScopeModal
        open={recurringScopeRequest !== null}
        taskTitle={recurringScopeRequest?.task.title ?? "this block"}
        actionLabel={recurringScopeRequest?.actionLabel ?? "change"}
        onChoose={handleChooseRecurringScope}
        onClose={handleCloseRecurringScope}
      />
    </main>
  );
}

function getRecurringSeriesEditDate(block: RecurringBlockSummary) {
  return block.nextOccurrenceDate ?? block.effectiveStartDate;
}
