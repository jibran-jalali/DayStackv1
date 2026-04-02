"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Bell, Mail, Plus } from "lucide-react";

import { DateSwitcher } from "@/components/app/date-switcher";
import { DashboardView } from "@/components/app/dashboard-view";
import { LeaderboardView } from "@/components/app/leaderboard-view";
import { MobileBottomNav } from "@/components/app/mobile-bottom-nav";
import { MobileDayStrip } from "@/components/app/mobile-day-strip";
import { MobileWorkspaceHeader } from "@/components/app/mobile-workspace-header";
import { PlannerHeader } from "@/components/app/planner-header";
import { RecurringBlocksView } from "@/components/app/recurring-blocks-view";
import { RecurringScopeModal } from "@/components/app/recurring-scope-modal";
import { TaskForm } from "@/components/app/task-form";
import { TaskModal } from "@/components/app/task-modal";
import { TimelineGrid } from "@/components/app/timeline-grid";
import { TimelineList } from "@/components/app/timeline-list";
import { useActionFeedback } from "@/components/app/use-action-feedback";
import { useNotificationSettings } from "@/components/app/use-notification-settings";
import type { PlannerViewMode } from "@/components/app/view-toggle";
import { WorkspaceNotificationsContent } from "@/components/app/workspace-notifications-content";
import { WorkspaceSettingsContent } from "@/components/app/workspace-settings-content";
import { Button } from "@/components/shared/button";
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
  PlannerNotification,
  PlannerTask,
  RecurringBlockSummary,
  RecurringTaskScope,
  TaskFormValues,
  TaskNotificationAcceptResult,
  TaskPropagationMode,
  UserNotificationPreferencesRecord,
  WorkspaceTab,
} from "@/types/daystack";

interface PlannerShellProps {
  displayName: string;
  email?: string;
  initialNotificationPreferences: UserNotificationPreferencesRecord;
  initialNotifications: PlannerNotification[];
  initialNowIso: string;
  initialTab: WorkspaceTab;
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

function getWorkspaceHref(taskDate: string, now: Date, tab: WorkspaceTab) {
  const todayDate = formatDateKey(now);
  const searchParams = new URLSearchParams();

  if (tab !== "plan") {
    searchParams.set("tab", tab);
  }

  if (taskDate !== todayDate) {
    searchParams.set("date", taskDate);
  }

  const query = searchParams.toString();

  return query ? `/app?${query}` : "/app";
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
  initialNotificationPreferences,
  initialNotifications,
  initialNowIso,
  initialTab,
  userId,
  initialSnapshot,
}: PlannerShellProps) {
  const router = useRouter();
  const initialNow = useMemo(() => new Date(initialNowIso), [initialNowIso]);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>(initialTab);
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
  const {
    isNotificationPending,
    notificationPreferences,
    sendTestNotification,
    toggleEmailReminders,
    toggleMeetingMentionEmails,
    updateEmailReminderLeadMinutes,
  } = useNotificationSettings({
    initialPreferences: initialNotificationPreferences,
    onNotice: setNotice,
  });
  const { playActionFeedback, setSoundsEnabled, soundsEnabled } = useActionFeedback({
    onNotice: setNotice,
  });

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

  const syncWorkspaceLocation = useCallback(
    (taskDate: string, tab = workspaceTab) => {
      window.history.replaceState(window.history.state, "", getWorkspaceHref(taskDate, new Date(), tab));
    },
    [workspaceTab],
  );

  function handleOpenWorkspaceTab(nextTab: WorkspaceTab) {
    if (nextTab === workspaceTab) {
      return;
    }

    playActionFeedback("navigate");
    clearSelection();
    setEditorTask(null);
    setRecurringSeriesEditor(null);
    setComposerDefaults(null);
    setFocusedTaskId(null);
    handleCloseRecurringScope();
    setWorkspaceTab(nextTab);
    setNotice(null);
    syncWorkspaceLocation(snapshot.taskDate, nextTab);
  }

  function handleChangePlannerView(nextView: PlannerViewMode) {
    setViewMode(nextView);

    if (workspaceTab !== "plan") {
      handleOpenWorkspaceTab("plan");
    }
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
        syncWorkspaceLocation(todayDate);
      } catch (error) {
        setNotice({
          type: "error",
          message: getErrorMessage(error),
        });
      } finally {
        setBusyMode(null);
      }
    })();
  }, [followToday, snapshot.taskDate, syncWorkspaceLocation, todayDate]);

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
      syncWorkspaceLocation(values.taskDate);
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
    playActionFeedback("add");
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

  function handleSelectDate(nextDate: string, options?: { nextTab?: WorkspaceTab }) {
    if (!isValidDateKey(nextDate) || nextDate === snapshot.taskDate) {
      if (options?.nextTab) {
        handleOpenWorkspaceTab(options.nextTab);
      }

      return;
    }

    playActionFeedback("navigate");
    clearSelection();
    setEditorTask(null);
    setRecurringSeriesEditor(null);
    setComposerDefaults(null);
    setFocusedTaskId(null);
    setNotice(null);
    setWorkspaceTab(options?.nextTab ?? "plan");

    setBusyMode("navigation");

    void (async () => {
      try {
        const nextSnapshot = await fetchDashboardSnapshot(nextDate);
        setSnapshot(nextSnapshot);
        setFollowToday(nextDate === formatDateKey(new Date()));
        syncWorkspaceLocation(nextDate, options?.nextTab);
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
        syncWorkspaceLocation(taskDate);

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
        if (nextStatus === "completed") {
          playActionFeedback("complete");
        }
        setFollowToday(task.task_date === formatDateKey(new Date()));
        syncWorkspaceLocation(task.task_date);
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
        syncWorkspaceLocation(taskDate);

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
          syncWorkspaceLocation(snapshot.taskDate);
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
    playActionFeedback("navigate");
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

  function handleOpenTaskDay(taskDate: string) {
    if (taskDate === snapshot.taskDate) {
      handleOpenWorkspaceTab("plan");
      return;
    }

    handleSelectDate(taskDate, {
      nextTab: "plan",
    });
  }

  async function handleSignOut() {
    try {
      await signOut({
        redirect: false,
        callbackUrl: "/login",
      });

      window.location.assign("/login");
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(error),
      });
    }
  }

  const dateMode = useMemo(() => getPlannerDateMode(snapshot.taskDate, now), [now, snapshot.taskDate]);
  const dateLabel = useMemo(() => formatDateLabel(snapshot.taskDate), [snapshot.taskDate]);
  const pomodoroHref = useMemo(() => getPomodoroHref(snapshot.taskDate, now), [now, snapshot.taskDate]);
  const plannerHref = useMemo(
    () => getWorkspaceHref(snapshot.taskDate, now, "plan"),
    [now, snapshot.taskDate],
  );
  const settingsHref = useMemo(
    () => getWorkspaceHref(snapshot.taskDate, now, "settings"),
    [now, snapshot.taskDate],
  );
  const notificationsHref = useMemo(
    () => getWorkspaceHref(snapshot.taskDate, now, "notifications"),
    [now, snapshot.taskDate],
  );
  const auxiliarySelectedDate = snapshot.taskDate === todayDate ? undefined : snapshot.taskDate;
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
  const activeChannelCount = [
    notificationPreferences.email_enabled,
    notificationPreferences.meeting_mention_email_enabled,
  ].filter(Boolean).length;
  const activePage =
    workspaceTab === "plan"
      ? "planner"
      : workspaceTab === "settings"
        ? "settings"
        : "notifications";
  const activeMetricLabel =
    workspaceTab === "plan"
      ? headerMetric.label
      : workspaceTab === "settings"
        ? activeChannelCount > 0
          ? `${activeChannelCount} channel${activeChannelCount === 1 ? "" : "s"} on`
          : "All alerts off"
        : "Meeting mentions";
  const activeMetricTone =
    workspaceTab === "plan"
      ? headerMetric.tone
      : workspaceTab === "settings"
        ? activeChannelCount > 0
          ? "brand"
          : "default"
        : "brand";
  const activeMetricIcon =
    workspaceTab === "plan"
      ? undefined
      : workspaceTab === "settings"
        ? activeChannelCount > 0
          ? Mail
          : Bell
        : Bell;
  const activeDateLabel =
    workspaceTab === "plan"
      ? dateLabel
      : workspaceTab === "settings"
        ? "Notifications & reminders"
        : "Notifications";
  const activeSubtitle =
    workspaceTab === "plan"
      ? dateMode === "future"
        ? "Plan another day without losing the timeline."
        : dateMode === "past"
          ? "Review what this day looked like."
          : "Plan and execute in one surface."
      : workspaceTab === "settings"
        ? "Manage how DayStack nudges the plan."
        : "Approve meeting blocks and open the linked schedule in one place.";
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
  const mobilePlanView: "dashboard" | "leaderboard" | "list" | "recurring" =
    viewMode === "grid" ? "list" : viewMode;
  const mobileHeaderTitle =
    workspaceTab === "plan"
      ? dateMode === "today"
        ? "Today"
        : relativeDateLabel
      : workspaceTab === "settings"
        ? "Settings"
        : "Inbox";
  const mobileHeaderSubtitle =
    workspaceTab === "plan"
      ? dateLabel
      : workspaceTab === "settings"
        ? "Manage reminders, meeting emails, and app feedback."
        : "Meeting mentions and approvals in one stream.";
  const mobileSecondaryMetricLabel =
    workspaceTab === "plan" && snapshot.streak > 0 ? `${snapshot.streak} day streak` : undefined;
  const mobileTaskCountLabel =
    workspaceTab === "plan"
      ? `${snapshot.tasks.length} block${snapshot.tasks.length === 1 ? "" : "s"}`
      : workspaceTab === "settings"
        ? activeChannelCount > 0
          ? `${activeChannelCount} active`
          : "Alerts off"
        : `${initialNotifications.length} updates`;

  return (
    <main className="min-h-screen">
      <div className="mobile-app-shell mobile-safe-x min-h-screen pb-[calc(var(--mobile-bottom-nav-height)+1.75rem+env(safe-area-inset-bottom))] lg:hidden">
        <MobileWorkspaceHeader
          title={mobileHeaderTitle}
          subtitle={mobileHeaderSubtitle}
          metricLabel={activeMetricLabel}
          metricTone={activeMetricTone}
          secondaryMetricLabel={mobileSecondaryMetricLabel ?? mobileTaskCountLabel}
          secondaryMetricTone={mobileSecondaryMetricLabel ? "success" : "default"}
          action={
            workspaceTab === "plan" ? (
              <Button
                size="sm"
                className="h-11 min-w-[7.25rem] px-4"
                onClick={() => handleCreateTask()}
                disabled={isPending}
              >
                <Plus className="h-4 w-4" />
                Add block
              </Button>
            ) : undefined
          }
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
          {workspaceTab === "plan" ? (
            <>
              <section className="mobile-surface relative overflow-hidden px-4 py-4">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(24,190,239,0.16),transparent)]" />
                <div className="relative">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="section-label">Daily progress</p>
                      <p className="mt-2 font-display text-[2.8rem] font-semibold tracking-[-0.06em] text-foreground">
                        {snapshot.summary.completionRate}%
                      </p>
                      <p className="mt-1 text-sm text-secondary-foreground">{snapshot.summary.summaryLine}</p>
                    </div>
                    <div className="rounded-[22px] bg-white/82 px-3 py-2 text-right shadow-[0_12px_26px_rgba(15,23,42,0.08)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/72">
                        {dateMode === "future" ? "Planned" : "Done"}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {dateMode === "future"
                          ? snapshot.summary.totalTasks
                          : `${snapshot.summary.completedTasks}/${snapshot.summary.totalTasks || 0}`}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/72">
                    <div
                      className="h-full rounded-full bg-brand-gradient transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      style={{ width: `${snapshot.summary.completionRate}%` }}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <div className="rounded-full border border-border/70 bg-white/84 px-3 py-1.5 text-xs font-semibold text-secondary-foreground shadow-[0_10px_22px_rgba(15,23,42,0.05)]">
                      {relativeDateLabel}
                    </div>
                    <div className="rounded-full border border-border/70 bg-white/84 px-3 py-1.5 text-xs font-semibold text-secondary-foreground shadow-[0_10px_22px_rgba(15,23,42,0.05)]">
                      {snapshot.tasks.length} block{snapshot.tasks.length === 1 ? "" : "s"}
                    </div>
                    {snapshot.streak > 0 ? (
                      <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-[0_10px_22px_rgba(34,197,94,0.08)]">
                        {snapshot.streak} day streak
                      </div>
                    ) : null}
                    {mobilePlanView === "list" && snapshot.tasks.length > 0 && !selectionMode ? (
                      <button
                        type="button"
                        className="ml-auto inline-flex h-9 items-center justify-center rounded-full border border-border/80 bg-white px-3 text-sm font-semibold text-foreground shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-[transform,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98]"
                        onClick={() => setSelectionMode(true)}
                        disabled={isPending}
                      >
                        Select
                      </button>
                    ) : null}
                  </div>
                </div>
              </section>

              <MobileDayStrip
                isPending={isSurfaceRefreshing}
                onSelectDate={handleSelectDate}
                selectedDate={snapshot.taskDate}
                todayDate={todayDate}
              />

              <section className="mobile-surface px-3 py-3">
                <div className="flex items-center gap-2 overflow-x-auto px-0.5 pb-1 soft-scrollbar">
                  {[
                    { key: "list", label: "Tasks" },
                    { key: "dashboard", label: "Overview" },
                    { key: "recurring", label: "Recurring" },
                    { key: "leaderboard", label: "Top" },
                  ].map((option) => {
                    const isActive = mobilePlanView === option.key;

                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={cn(
                          "inline-flex h-11 shrink-0 items-center justify-center rounded-full px-4 text-sm font-semibold transition-[transform,box-shadow,background-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98]",
                          isActive
                            ? "bg-brand-gradient text-white shadow-[var(--shadow-brand-pill)]"
                            : "bg-muted/52 text-secondary-foreground",
                        )}
                        onClick={() => {
                          playActionFeedback("navigate");
                          setViewMode(option.key as PlannerViewMode);
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              {mobilePlanView === "list" && selectionMode ? (
                <section className="mobile-card p-4">
                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{selectedTaskIds.length} selected</p>
                      <p className="mt-1 text-xs text-secondary-foreground">Choose the blocks you want to delete together.</p>
                    </div>
                    <div className="grid gap-2">
                      <button
                        type="button"
                        className="inline-flex h-10 w-full items-center justify-center rounded-full border border-red-200 bg-red-50 px-4 text-sm font-semibold text-danger shadow-[0_10px_24px_rgba(239,68,68,0.1)]"
                        onClick={handleDeleteSelectedTasks}
                        disabled={isPending || selectedTaskIds.length === 0}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-10 w-full items-center justify-center rounded-full border border-border/80 bg-white px-4 text-sm font-semibold text-foreground shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
                        onClick={clearSelection}
                        disabled={isPending}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </section>
              ) : null}

              <section aria-busy={isSurfaceRefreshing} className={cn(isSurfaceRefreshing && "opacity-90")}>
                {mobilePlanView === "dashboard" ? (
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
                ) : mobilePlanView === "recurring" ? (
                  <RecurringBlocksView
                    blocks={snapshot.recurringBlocks}
                    isPending={isPending}
                    onDeleteBlock={handleDeleteRecurringBlock}
                    onEditBlock={handleEditRecurringBlock}
                  />
                ) : mobilePlanView === "leaderboard" ? (
                  <LeaderboardView currentUserId={userId} entries={snapshot.leaderboard} />
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
              </section>
            </>
          ) : workspaceTab === "settings" ? (
            <WorkspaceSettingsContent
              compact
              actionSoundsEnabled={soundsEnabled}
              displayName={displayName}
              email={email}
              isBusy={isNotificationPending}
              notificationPreferences={notificationPreferences}
              onNotice={setNotice}
              onOpenPlanner={() => handleOpenWorkspaceTab("plan")}
              onSendTest={sendTestNotification}
              onSaveLeadMinutes={updateEmailReminderLeadMinutes}
              onSignOut={handleSignOut}
              onToggleActionSounds={setSoundsEnabled}
              onToggleEmail={toggleEmailReminders}
              onToggleMeetingMentionEmail={toggleMeetingMentionEmails}
              selectedDate={auxiliarySelectedDate}
            />
          ) : (
            <WorkspaceNotificationsContent
              compact
              displayName={displayName}
              email={email}
              initialNotifications={initialNotifications}
              isActive={workspaceTab === "notifications"}
              onNotice={setNotice}
              onOpenPlanner={() => handleOpenWorkspaceTab("plan")}
              onOpenTaskDay={handleOpenTaskDay}
              onTaskAccepted={handleNotificationAccepted}
              selectedDate={auxiliarySelectedDate}
            />
          )}
        </div>

        <MobileBottomNav
          activeTab={workspaceTab === "plan" ? "plan" : workspaceTab}
          notificationsHref={notificationsHref}
          onOpenNotifications={() => handleOpenWorkspaceTab("notifications")}
          onOpenPlan={() => handleOpenWorkspaceTab("plan")}
          onOpenSettings={() => handleOpenWorkspaceTab("settings")}
          onPlayNavigate={() => playActionFeedback("navigate")}
          plannerHref={plannerHref}
          pomodoroHref={pomodoroHref}
          settingsHref={settingsHref}
        />
      </div>

      <div className="container-shell hidden min-h-screen py-4 sm:py-6 lg:block">
      <div className="space-y-4 sm:space-y-5">
        <PlannerHeader
          activePage={activePage}
          displayName={displayName}
          email={email}
          dateLabel={activeDateLabel}
          dateMode={workspaceTab === "plan" ? dateMode : undefined}
          metricIcon={activeMetricIcon}
          metricLabel={activeMetricLabel}
          metricTone={activeMetricTone}
          notificationsHref={notificationsHref}
          onNotice={setNotice}
          onOpenNotifications={() => handleOpenWorkspaceTab("notifications")}
          onOpenPlanner={() => handleOpenWorkspaceTab("plan")}
          onOpenSettings={() => handleOpenWorkspaceTab("settings")}
          onOpenTaskDay={handleOpenTaskDay}
          onTaskAccepted={handleNotificationAccepted}
          plannerHref={plannerHref}
          settingsHref={settingsHref}
          showNotificationCenter={workspaceTab === "plan"}
          streak={workspaceTab === "plan" ? snapshot.streak : undefined}
          subtitle={activeSubtitle}
          viewMode={viewMode}
          pomodoroHref={pomodoroHref}
          onAddTask={workspaceTab === "plan" ? () => handleCreateTask() : undefined}
          onViewChange={handleChangePlannerView}
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

        <section className={cn("min-w-0", workspaceTab !== "plan" && "hidden")}>
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

        <section className={cn("min-w-0", workspaceTab !== "settings" && "hidden")}>
          <WorkspaceSettingsContent
            actionSoundsEnabled={soundsEnabled}
            displayName={displayName}
            email={email}
            isBusy={isNotificationPending}
            notificationPreferences={notificationPreferences}
            onNotice={setNotice}
            onOpenPlanner={() => handleOpenWorkspaceTab("plan")}
            onSendTest={sendTestNotification}
            onSaveLeadMinutes={updateEmailReminderLeadMinutes}
            onSignOut={handleSignOut}
            onToggleActionSounds={setSoundsEnabled}
            onToggleEmail={toggleEmailReminders}
            onToggleMeetingMentionEmail={toggleMeetingMentionEmails}
            selectedDate={auxiliarySelectedDate}
          />
        </section>

        <section className={cn("min-w-0", workspaceTab !== "notifications" && "hidden")}>
          <WorkspaceNotificationsContent
            displayName={displayName}
            email={email}
            initialNotifications={initialNotifications}
            isActive={workspaceTab === "notifications"}
            onNotice={setNotice}
            onOpenPlanner={() => handleOpenWorkspaceTab("plan")}
            onOpenTaskDay={handleOpenTaskDay}
            onTaskAccepted={handleNotificationAccepted}
            selectedDate={auxiliarySelectedDate}
          />
        </section>
      </div>
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
