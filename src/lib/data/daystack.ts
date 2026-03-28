import "server-only";

import { and, asc, count, desc, eq, ilike, inArray, ne, or } from "drizzle-orm";

import { getDb } from "@/db/client";
import { daily_summaries, task_participants, tasks, users } from "@/db/schema";
import { expireTaskMentionNotifications, syncTaskMentionNotificationsForTask } from "@/lib/data/notifications";
import { syncTaskRemindersForTask } from "@/lib/data/reminders";
import { buildSummary, calculateActiveStreak, deriveDisplayName } from "@/lib/daystack";
import type {
  DailySummaryRecord,
  DashboardSnapshot,
  ParticipantProfile,
  PlannerTask,
  ProfileRecord,
  TaskFormValues,
  TaskPropagationMode,
  TaskParticipantRecord,
  TaskRecord,
} from "@/types/daystack";

type DayStackDb = NonNullable<ReturnType<typeof getDb>>;

function getRequiredDb(): DayStackDb {
  const db = getDb();

  if (!db) {
    throw new Error("Database is not configured.");
  }

  return db;
}

function createSummaryPayload(
  userId: string,
  taskDate: string,
  tasksForDay: Array<Pick<TaskRecord, "status" | "task_type">>,
) {
  const summary = buildSummary(tasksForDay);

  return {
    user_id: userId,
    summary_date: taskDate,
    total_tasks: summary.totalTasks,
    completed_tasks: summary.completedTasks,
    execution_score: summary.executionScore,
    successful_day: summary.successfulDay,
  };
}

function mapParticipantProfile(
  profile: Pick<ProfileRecord, "email" | "full_name" | "id">,
): ParticipantProfile {
  return {
    email: profile.email,
    id: profile.id,
    fullName: deriveDisplayName(profile.full_name, profile.email ?? undefined),
  };
}

async function fetchTaskParticipantsForTasks(
  db: DayStackDb,
  taskIds: string[],
): Promise<TaskParticipantRecord[]> {
  if (taskIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(task_participants)
    .where(inArray(task_participants.task_id, taskIds));
}

async function fetchAcceptedCopyCountsForTasks(
  db: DayStackDb,
  taskIds: string[],
): Promise<Map<string, number>> {
  if (taskIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      accepted_copy_count: count(),
      source_task_id: tasks.source_task_id,
    })
    .from(tasks)
    .where(inArray(tasks.source_task_id, taskIds))
    .groupBy(tasks.source_task_id);

  return new Map(
    rows.flatMap((row) =>
      row.source_task_id ? [[row.source_task_id, Number(row.accepted_copy_count)] as const] : [],
    ),
  );
}

async function hydrateTasksWithParticipants(
  db: DayStackDb,
  taskRows: TaskRecord[],
): Promise<PlannerTask[]> {
  if (taskRows.length === 0) {
    return [];
  }

  const taskIds = taskRows.map((task) => task.id);
  const [participantRows, acceptedCopyCounts] = await Promise.all([
    fetchTaskParticipantsForTasks(db, taskIds),
    fetchAcceptedCopyCountsForTasks(db, taskIds),
  ]);

  if (participantRows.length === 0) {
    return taskRows.map((task) => ({
      ...task,
      acceptedCopiesCount: acceptedCopyCounts.get(task.id) ?? 0,
      participants: [],
    }));
  }

  const participantIds = [...new Set(participantRows.map((participant) => participant.participant_id))];
  const profiles = await db
    .select({
      email: users.email,
      full_name: users.full_name,
      id: users.id,
    })
    .from(users)
    .where(inArray(users.id, participantIds));

  const profilesById = new Map(profiles.map((profile) => [profile.id, mapParticipantProfile(profile)]));
  const participantsByTaskId = participantRows.reduce<Map<string, ParticipantProfile[]>>((accumulator, participant) => {
    const profile = profilesById.get(participant.participant_id);

    if (!profile) {
      return accumulator;
    }

    const current = accumulator.get(participant.task_id) ?? [];
    current.push(profile);
    accumulator.set(participant.task_id, current);
    return accumulator;
  }, new Map());

  return taskRows.map((task) => ({
    ...task,
    acceptedCopiesCount: acceptedCopyCounts.get(task.id) ?? 0,
    participants: participantsByTaskId.get(task.id) ?? [],
  }));
}

async function replaceTaskParticipants(
  db: DayStackDb,
  taskId: string,
  participantIds: string[],
) {
  const uniqueIds = [...new Set(participantIds)];

  await db.delete(task_participants).where(eq(task_participants.task_id, taskId));

  if (uniqueIds.length === 0) {
    return;
  }

  await db.insert(task_participants).values(
    uniqueIds.map((participantId) => ({
      id: crypto.randomUUID(),
      participant_id: participantId,
      task_id: taskId,
    })),
  );
}

interface AcceptedCopyUpdateResult {
  previousDate: string;
  task: TaskRecord;
}

function getAcceptedCopyParticipantIds(sourceTaskOwnerId: string, participantIds: string[], acceptedUserId: string) {
  return [...new Set([sourceTaskOwnerId, ...participantIds])].filter(
    (participantId) => participantId !== acceptedUserId,
  );
}

async function fetchAcceptedCopiesForSourceTask(db: DayStackDb, taskId: string) {
  return db.select().from(tasks).where(eq(tasks.source_task_id, taskId));
}

async function syncAcceptedCopiesFromSourceTask(
  db: DayStackDb,
  sourceTask: Pick<
    TaskRecord,
    "end_time" | "id" | "meeting_link" | "start_time" | "task_date" | "task_type" | "title" | "user_id"
  >,
  participantIds: string[],
) {
  const acceptedCopies = await fetchAcceptedCopiesForSourceTask(db, sourceTask.id);

  if (acceptedCopies.length === 0) {
    return [];
  }

  const now = new Date().toISOString();
  const results: AcceptedCopyUpdateResult[] = [];

  for (const acceptedCopy of acceptedCopies) {
    const [updatedCopy] = await db
      .update(tasks)
      .set({
        end_time: sourceTask.end_time,
        meeting_link: sourceTask.task_type === "meeting" ? sourceTask.meeting_link : null,
        start_time: sourceTask.start_time,
        task_date: sourceTask.task_date,
        task_type: sourceTask.task_type,
        title: sourceTask.title,
        updated_at: now,
      })
      .where(eq(tasks.id, acceptedCopy.id))
      .returning();

    if (!updatedCopy) {
      continue;
    }

    const acceptedCopyParticipantIds =
      sourceTask.task_type === "meeting"
        ? getAcceptedCopyParticipantIds(sourceTask.user_id, participantIds, updatedCopy.user_id)
        : [];

    await replaceTaskParticipants(db, updatedCopy.id, acceptedCopyParticipantIds);
    results.push({
      previousDate: acceptedCopy.task_date,
      task: updatedCopy,
    });
  }

  return results;
}

async function syncAcceptedCopyDependencies(updatedAcceptedCopies: AcceptedCopyUpdateResult[]) {
  if (updatedAcceptedCopies.length === 0) {
    return;
  }

  const summaryTargets = new Map<string, { taskDate: string; userId: string }>();

  const addSummaryTarget = (userId: string, taskDate: string) => {
    summaryTargets.set(`${userId}:${taskDate}`, {
      taskDate,
      userId,
    });
  };

  await Promise.all(
    updatedAcceptedCopies.map(async ({ previousDate, task }) => {
      await syncTaskRemindersForTask(task.user_id, task);
      addSummaryTarget(task.user_id, previousDate);
      addSummaryTarget(task.user_id, task.task_date);
    }),
  );

  await Promise.all(
    [...summaryTargets.values()].map(({ taskDate, userId }) => syncDailySummaryForDate(userId, taskDate)),
  );
}

async function fetchTaskRowsForDate(
  db: DayStackDb,
  userId: string,
  taskDate: string,
): Promise<TaskRecord[]> {
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.user_id, userId), eq(tasks.task_date, taskDate)))
    .orderBy(asc(tasks.start_time), asc(tasks.end_time));
}

export async function fetchTasksForDate(
  userId: string,
  taskDate: string,
): Promise<PlannerTask[]> {
  const db = getRequiredDb();
  const rows = await fetchTaskRowsForDate(db, userId, taskDate);
  return hydrateTasksWithParticipants(db, rows);
}

export async function fetchRecentSummaries(
  userId: string,
  limit = 45,
): Promise<DailySummaryRecord[]> {
  const db = getRequiredDb();

  return db
    .select()
    .from(daily_summaries)
    .where(eq(daily_summaries.user_id, userId))
    .orderBy(desc(daily_summaries.summary_date))
    .limit(limit);
}

export async function fetchProfile(userId: string): Promise<ProfileRecord | null> {
  const db = getRequiredDb();
  const [profile] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return profile ?? null;
}

export async function syncDailySummaryForDate(
  userId: string,
  taskDate: string,
): Promise<DailySummaryRecord> {
  const db = getRequiredDb();
  const tasksForDay = await fetchTaskRowsForDate(db, userId, taskDate);
  const payload = createSummaryPayload(userId, taskDate, tasksForDay);
  const now = new Date().toISOString();

  const [summary] = await db
    .insert(daily_summaries)
    .values({
      id: crypto.randomUUID(),
      ...payload,
      created_at: now,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: [daily_summaries.user_id, daily_summaries.summary_date],
      set: {
        ...payload,
        updated_at: now,
      },
    })
    .returning();

  return summary;
}

export async function fetchDashboardSnapshot(
  userId: string,
  taskDate: string,
): Promise<DashboardSnapshot> {
  const db = getRequiredDb();
  const [tasksForDay, persistedSummary, recentSummaries] = await Promise.all([
    fetchTasksForDate(userId, taskDate),
    db
      .select()
      .from(daily_summaries)
      .where(and(eq(daily_summaries.user_id, userId), eq(daily_summaries.summary_date, taskDate)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    fetchRecentSummaries(userId),
  ]);

  const summary = buildSummary(tasksForDay);
  const liveSummary = (persistedSummary ?? {
    id: `live-${taskDate}`,
    user_id: userId,
    summary_date: taskDate,
    total_tasks: summary.totalTasks,
    completed_tasks: summary.completedTasks,
    execution_score: summary.executionScore,
    successful_day: summary.successfulDay,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }) as DailySummaryRecord;

  const mergedSummaries = [
    liveSummary,
    ...recentSummaries.filter((item) => item.summary_date !== taskDate),
  ] as DailySummaryRecord[];

  return {
    taskDate,
    tasks: tasksForDay,
    recentSummaries: mergedSummaries,
    summary,
    streak: calculateActiveStreak(mergedSummaries, taskDate),
  };
}

export async function createTask(
  userId: string,
  values: TaskFormValues,
): Promise<TaskRecord> {
  const db = getRequiredDb();
  const taskId = crypto.randomUUID();

  const [createdTask] = await db
    .insert(tasks)
    .values({
      id: taskId,
      user_id: userId,
      title: values.title,
      task_date: values.taskDate,
      start_time: values.startTime,
      end_time: values.endTime,
      task_type: values.taskType,
      meeting_link: values.taskType === "meeting" ? values.meetingLink || null : null,
      status: "pending",
    })
    .returning();

  const participantIds =
    values.taskType === "meeting" ? values.participants.map((participant) => participant.id) : [];

  await replaceTaskParticipants(db, createdTask.id, participantIds);
  await Promise.all([
    syncTaskMentionNotificationsForTask(userId, createdTask.id),
    syncTaskRemindersForTask(userId, createdTask),
    syncDailySummaryForDate(userId, values.taskDate),
  ]);

  return createdTask;
}

export async function updateTask(
  userId: string,
  taskId: string,
  values: TaskFormValues,
  propagationMode: TaskPropagationMode = "owner_only",
): Promise<TaskRecord> {
  const db = getRequiredDb();
  const [existingTask] = await db
    .select({
      task_date: tasks.task_date,
    })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.user_id, userId)))
    .limit(1);

  if (!existingTask) {
    throw new Error("Task not found.");
  }

  const [updatedTask] = await db
    .update(tasks)
    .set({
      title: values.title,
      task_date: values.taskDate,
      start_time: values.startTime,
      end_time: values.endTime,
      task_type: values.taskType,
      meeting_link: values.taskType === "meeting" ? values.meetingLink || null : null,
      updated_at: new Date().toISOString(),
    })
    .where(and(eq(tasks.id, taskId), eq(tasks.user_id, userId)))
    .returning();

  const participantIds =
    values.taskType === "meeting" ? values.participants.map((participant) => participant.id) : [];
  let updatedAcceptedCopies: AcceptedCopyUpdateResult[] = [];

  if (propagationMode === "owner_and_accepted_copies") {
    updatedAcceptedCopies = await syncAcceptedCopiesFromSourceTask(
      db,
      {
        end_time: updatedTask.end_time,
        id: updatedTask.id,
        meeting_link: updatedTask.meeting_link,
        start_time: updatedTask.start_time,
        task_date: updatedTask.task_date,
        task_type: updatedTask.task_type,
        title: updatedTask.title,
        user_id: updatedTask.user_id,
      },
      participantIds,
    );
  }

  await replaceTaskParticipants(db, taskId, participantIds);
  await Promise.all([
    syncTaskMentionNotificationsForTask(userId, updatedTask.id),
    syncTaskRemindersForTask(userId, updatedTask),
  ]);
  await syncAcceptedCopyDependencies(updatedAcceptedCopies);

  if (existingTask.task_date !== values.taskDate) {
    await Promise.all([
      syncDailySummaryForDate(userId, existingTask.task_date),
      syncDailySummaryForDate(userId, values.taskDate),
    ]);
  } else {
    await syncDailySummaryForDate(userId, values.taskDate);
  }

  return updatedTask;
}

export async function rescheduleTask(
  userId: string,
  taskId: string,
  values: Pick<TaskFormValues, "endTime" | "startTime" | "taskDate">,
  propagationMode: TaskPropagationMode = "owner_only",
): Promise<TaskRecord> {
  const db = getRequiredDb();
  const [existingTask] = await db
    .select({
      task_date: tasks.task_date,
    })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.user_id, userId)))
    .limit(1);

  if (!existingTask) {
    throw new Error("Task not found.");
  }

  const [participantRows, rescheduledTask] = await Promise.all([
    db
      .select({ participant_id: task_participants.participant_id })
      .from(task_participants)
      .where(eq(task_participants.task_id, taskId)),
    db
      .update(tasks)
      .set({
        end_time: values.endTime,
        start_time: values.startTime,
        task_date: values.taskDate,
        updated_at: new Date().toISOString(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.user_id, userId)))
      .returning()
      .then((rows) => rows[0]),
  ]);

  if (!rescheduledTask) {
    throw new Error("Task not found.");
  }

  const participantIds = participantRows.map((participant) => participant.participant_id);
  let updatedAcceptedCopies: AcceptedCopyUpdateResult[] = [];

  if (propagationMode === "owner_and_accepted_copies") {
    updatedAcceptedCopies = await syncAcceptedCopiesFromSourceTask(
      db,
      {
        end_time: rescheduledTask.end_time,
        id: rescheduledTask.id,
        meeting_link: rescheduledTask.meeting_link,
        start_time: rescheduledTask.start_time,
        task_date: rescheduledTask.task_date,
        task_type: rescheduledTask.task_type,
        title: rescheduledTask.title,
        user_id: rescheduledTask.user_id,
      },
      participantIds,
    );
  }

  await Promise.all([
    syncTaskMentionNotificationsForTask(userId, rescheduledTask.id),
    syncTaskRemindersForTask(userId, rescheduledTask),
  ]);
  await syncAcceptedCopyDependencies(updatedAcceptedCopies);

  if (existingTask.task_date !== values.taskDate) {
    await Promise.all([
      syncDailySummaryForDate(userId, existingTask.task_date),
      syncDailySummaryForDate(userId, values.taskDate),
    ]);
  } else {
    await syncDailySummaryForDate(userId, values.taskDate);
  }

  return rescheduledTask;
}

export async function deleteTask(userId: string, taskId: string): Promise<string> {
  const db = getRequiredDb();
  const [task] = await db
    .select({ task_date: tasks.task_date })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.user_id, userId)))
    .limit(1);

  if (!task) {
    throw new Error("Task not found.");
  }

  await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.user_id, userId)));

  await Promise.all([
    expireTaskMentionNotifications(userId, taskId),
    syncDailySummaryForDate(userId, task.task_date),
  ]);

  return task.task_date;
}

export async function toggleTaskStatus(
  userId: string,
  taskId: string,
  status: "pending" | "completed",
): Promise<TaskRecord> {
  const db = getRequiredDb();
  const [nextTask] = await db
    .update(tasks)
    .set({
      status,
      updated_at: new Date().toISOString(),
    })
    .where(and(eq(tasks.id, taskId), eq(tasks.user_id, userId)))
    .returning();

  if (!nextTask) {
    throw new Error("Task not found.");
  }

  await syncTaskRemindersForTask(userId, nextTask);
  await syncDailySummaryForDate(userId, nextTask.task_date);

  return nextTask;
}

export async function searchProfiles(
  query: string,
  options?: {
    excludeUserId?: string;
    limit?: number;
  },
): Promise<ParticipantProfile[]> {
  const db = getRequiredDb();
  const limit = options?.limit ?? 6;
  const normalizedQuery = query.trim();
  const conditions = [];

  if (options?.excludeUserId) {
    conditions.push(ne(users.id, options.excludeUserId));
  }

  if (normalizedQuery.length > 0) {
    conditions.push(
      or(
        ilike(users.full_name, `%${normalizedQuery}%`),
        ilike(users.email, `%${normalizedQuery}%`),
      )!,
    );
  }

  const results = await db
    .select({
      email: users.email,
      full_name: users.full_name,
      id: users.id,
    })
    .from(users)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(users.full_name), asc(users.email))
    .limit(limit);

  return results.map((profile) => mapParticipantProfile(profile));
}
