import "server-only";

import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, ne, or } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  daily_summaries,
  recurring_rule_exceptions,
  recurring_rule_participants,
  recurring_rules,
  task_participants,
  tasks,
  users,
} from "@/db/schema";
import { fetchLeaderboard } from "@/lib/data/leaderboard";
import { expireTaskMentionNotifications, syncTaskMentionNotificationsForTask } from "@/lib/data/notifications";
import { syncTaskRemindersForTask } from "@/lib/data/reminders";
import { buildSummary, calculateActiveStreak, deriveDisplayName } from "@/lib/daystack";
import type {
  DailySummaryRecord,
  DashboardSnapshot,
  ParticipantProfile,
  PlannerTask,
  ProfileRecord,
  RecurringBlockSummary,
  RecurringRuleParticipantRecord,
  RecurringRuleRecord,
  RecurringTaskScope,
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

function parseDateKey(taskDate: string) {
  const [year, month, day] = taskDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getWeekdayFromDateKey(taskDate: string) {
  return parseDateKey(taskDate).getUTCDay();
}

function shiftDateKey(taskDate: string, offsetDays: number) {
  const nextDate = parseDateKey(taskDate);
  nextDate.setUTCDate(nextDate.getUTCDate() + offsetDays);
  return formatDateKey(nextDate);
}

function compareDateKeys(left: string, right: string) {
  return left.localeCompare(right);
}

function sortWeekdays(weekdays: number[]) {
  return [...weekdays].sort((left, right) => left - right);
}

function getNextRecurringOccurrenceDate(
  weekdays: number[],
  effectiveStartDate: string,
  effectiveEndDate: string | null,
  fromDate: string,
) {
  if (weekdays.length === 0) {
    return null;
  }

  const searchStartDate = compareDateKeys(fromDate, effectiveStartDate) > 0
    ? fromDate
    : effectiveStartDate;

  if (effectiveEndDate && compareDateKeys(searchStartDate, effectiveEndDate) > 0) {
    return null;
  }

  const weekdaySet = new Set(weekdays);

  for (let offset = 0; offset < 7; offset += 1) {
    const candidateDate = shiftDateKey(searchStartDate, offset);

    if (effectiveEndDate && compareDateKeys(candidateDate, effectiveEndDate) > 0) {
      return null;
    }

    if (weekdaySet.has(getWeekdayFromDateKey(candidateDate))) {
      return candidateDate;
    }
  }

  return null;
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

async function fetchRecurringRuleParticipantRows(
  db: DayStackDb,
  ruleIds: string[],
): Promise<RecurringRuleParticipantRecord[]> {
  if (ruleIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(recurring_rule_participants)
    .where(inArray(recurring_rule_participants.recurring_rule_id, ruleIds));
}

async function fetchParticipantProfilesById(
  db: DayStackDb,
  participantIds: string[],
) {
  if (participantIds.length === 0) {
    return new Map<string, ParticipantProfile>();
  }

  const profiles = await db
    .select({
      email: users.email,
      full_name: users.full_name,
      id: users.id,
    })
    .from(users)
    .where(inArray(users.id, participantIds));

  return new Map(profiles.map((profile) => [profile.id, mapParticipantProfile(profile)]));
}

async function fetchRecurringRuleParticipantIds(
  db: DayStackDb,
  ruleIds: string[],
): Promise<Map<string, string[]>> {
  const participantRows = await fetchRecurringRuleParticipantRows(db, ruleIds);

  return participantRows.reduce<Map<string, string[]>>((accumulator, participant) => {
    const current = accumulator.get(participant.recurring_rule_id) ?? [];
    current.push(participant.participant_id);
    accumulator.set(participant.recurring_rule_id, current);
    return accumulator;
  }, new Map());
}

async function fetchRecurringSeriesMetadataForRules(
  db: DayStackDb,
  ruleIds: string[],
) {
  if (ruleIds.length === 0) {
    return new Map<string, { seriesId: string; weekdays: number[] }>();
  }

  const sourceRules = await db
    .select({
      ruleId: recurring_rules.id,
      seriesId: recurring_rules.series_id,
    })
    .from(recurring_rules)
    .where(inArray(recurring_rules.id, ruleIds));

  const seriesIds = [...new Set(sourceRules.map((row) => row.seriesId))];
  const seriesRules = await db
    .select({
      seriesId: recurring_rules.series_id,
      weekday: recurring_rules.weekday,
    })
    .from(recurring_rules)
    .where(inArray(recurring_rules.series_id, seriesIds));
  const weekdaysBySeriesId = seriesRules.reduce<Map<string, number[]>>((accumulator, row) => {
    const current = accumulator.get(row.seriesId) ?? [];
    current.push(row.weekday);
    accumulator.set(row.seriesId, current);
    return accumulator;
  }, new Map());

  return new Map(
    sourceRules.map((row) => [
      row.ruleId,
      {
        seriesId: row.seriesId,
        weekdays: sortWeekdays(weekdaysBySeriesId.get(row.seriesId) ?? []),
      },
    ]),
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
  const recurringRuleIds = [...new Set(taskRows.flatMap((task) => (task.recurring_rule_id ? [task.recurring_rule_id] : [])))];
  const [participantRows, acceptedCopyCounts] = await Promise.all([
    fetchTaskParticipantsForTasks(db, taskIds),
    fetchAcceptedCopyCountsForTasks(db, taskIds),
  ]);
  const recurringSeriesMetadata = await fetchRecurringSeriesMetadataForRules(db, recurringRuleIds);

  if (participantRows.length === 0) {
    return taskRows.map((task) => ({
      ...task,
      acceptedCopiesCount: acceptedCopyCounts.get(task.id) ?? 0,
      participants: [],
      recurringSeriesId: task.recurring_rule_id
        ? recurringSeriesMetadata.get(task.recurring_rule_id)?.seriesId ?? null
        : null,
      recurringWeekdays: task.recurring_rule_id
        ? recurringSeriesMetadata.get(task.recurring_rule_id)?.weekdays ?? []
        : [],
    }));
  }

  const participantIds = [...new Set(participantRows.map((participant) => participant.participant_id))];
  const profilesById = await fetchParticipantProfilesById(db, participantIds);
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
    recurringSeriesId: task.recurring_rule_id
      ? recurringSeriesMetadata.get(task.recurring_rule_id)?.seriesId ?? null
      : null,
    recurringWeekdays: task.recurring_rule_id
      ? recurringSeriesMetadata.get(task.recurring_rule_id)?.weekdays ?? []
      : [],
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

async function replaceRecurringRuleParticipants(
  db: DayStackDb,
  recurringRuleId: string,
  participantIds: string[],
) {
  const uniqueIds = [...new Set(participantIds)];

  await db
    .delete(recurring_rule_participants)
    .where(eq(recurring_rule_participants.recurring_rule_id, recurringRuleId));

  if (uniqueIds.length === 0) {
    return;
  }

  await db.insert(recurring_rule_participants).values(
    uniqueIds.map((participantId) => ({
      id: crypto.randomUUID(),
      participant_id: participantId,
      recurring_rule_id: recurringRuleId,
    })),
  );
}

async function fetchApplicableRecurringRulesForDate(
  db: DayStackDb,
  userId: string,
  taskDate: string,
): Promise<RecurringRuleRecord[]> {
  const weekday = getWeekdayFromDateKey(taskDate);
  return db
    .select()
    .from(recurring_rules)
    .where(
      and(
        eq(recurring_rules.user_id, userId),
        eq(recurring_rules.weekday, weekday),
        eq(recurring_rules.is_active, true),
        lte(recurring_rules.effective_start_date, taskDate),
        or(isNull(recurring_rules.effective_end_date), gte(recurring_rules.effective_end_date, taskDate)),
      ),
    )
    .orderBy(asc(recurring_rules.start_time), asc(recurring_rules.end_time));
}

async function fetchRecurringSkipRuleIdsForDate(
  db: DayStackDb,
  ruleIds: string[],
  taskDate: string,
) {
  if (ruleIds.length === 0) {
    return new Set<string>();
  }

  const rows = await db
    .select({
      recurringRuleId: recurring_rule_exceptions.recurring_rule_id,
    })
    .from(recurring_rule_exceptions)
    .where(
      and(
        inArray(recurring_rule_exceptions.recurring_rule_id, ruleIds),
        eq(recurring_rule_exceptions.occurrence_date, taskDate),
      ),
    );

  return new Set(rows.map((row) => row.recurringRuleId));
}

async function createRecurringOccurrenceTask(
  db: DayStackDb,
  userId: string,
  taskDate: string,
  recurringRule: RecurringRuleRecord,
  participantIds: string[],
) {
  const [createdTask] = await db
    .insert(tasks)
    .values({
      id: crypto.randomUUID(),
      user_id: userId,
      title: recurringRule.title,
      task_date: taskDate,
      start_time: recurringRule.start_time,
      end_time: recurringRule.end_time,
      task_type: recurringRule.task_type,
      meeting_link: recurringRule.task_type === "meeting" ? recurringRule.meeting_link : null,
      recurring_rule_id: recurringRule.id,
      recurring_occurrence_date: taskDate,
      recurrence_override: false,
      status: "pending",
    })
    .onConflictDoNothing({
      target: [tasks.user_id, tasks.recurring_rule_id, tasks.recurring_occurrence_date],
    })
    .returning();

  if (!createdTask) {
    return null;
  }

  await replaceTaskParticipants(
    db,
    createdTask.id,
    recurringRule.task_type === "meeting" ? participantIds : [],
  );
  await Promise.all([
    syncTaskMentionNotificationsForTask(userId, createdTask.id),
    syncTaskRemindersForTask(userId, createdTask),
  ]);

  return createdTask;
}

async function ensureRecurringTasksForDate(
  db: DayStackDb,
  userId: string,
  taskDate: string,
  syncSummary = true,
) {
  const applicableRules = await fetchApplicableRecurringRulesForDate(db, userId, taskDate);

  if (applicableRules.length === 0) {
    return;
  }

  const ruleIds = applicableRules.map((rule) => rule.id);
  const [existingOccurrences, skippedRuleIds, participantIdsByRule] = await Promise.all([
    db
      .select({
        recurringRuleId: tasks.recurring_rule_id,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.user_id, userId),
          eq(tasks.recurring_occurrence_date, taskDate),
          inArray(tasks.recurring_rule_id, ruleIds),
        ),
      ),
    fetchRecurringSkipRuleIdsForDate(db, ruleIds, taskDate),
    fetchRecurringRuleParticipantIds(db, ruleIds),
  ]);

  const existingRuleIds = new Set(
    existingOccurrences.flatMap((row) => (row.recurringRuleId ? [row.recurringRuleId] : [])),
  );
  let createdCount = 0;

  for (const rule of applicableRules) {
    if (existingRuleIds.has(rule.id) || skippedRuleIds.has(rule.id)) {
      continue;
    }

    const createdTask = await createRecurringOccurrenceTask(
      db,
      userId,
      taskDate,
      rule,
      participantIdsByRule.get(rule.id) ?? [],
    );

    if (createdTask) {
      createdCount += 1;
    }
  }

  if (createdCount > 0 && syncSummary) {
    await syncDailySummaryForDate(userId, taskDate);
  }
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

async function fetchTaskRowsForDateRaw(
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

async function fetchTaskRowsForDate(
  db: DayStackDb,
  userId: string,
  taskDate: string,
): Promise<TaskRecord[]> {
  await ensureRecurringTasksForDate(db, userId, taskDate);
  return fetchTaskRowsForDateRaw(db, userId, taskDate);
}

async function fetchRecurringBlocksForDate(
  db: DayStackDb,
  userId: string,
  taskDate: string,
): Promise<RecurringBlockSummary[]> {
  const rows = await db
    .select()
    .from(recurring_rules)
    .where(
      and(
        eq(recurring_rules.user_id, userId),
        eq(recurring_rules.is_active, true),
        or(isNull(recurring_rules.effective_end_date), gte(recurring_rules.effective_end_date, taskDate)),
      ),
    )
    .orderBy(asc(recurring_rules.start_time), asc(recurring_rules.title), asc(recurring_rules.weekday));

  if (rows.length === 0) {
    return [];
  }

  const ruleIds = rows.map((rule) => rule.id);
  const participantIdsByRule = await fetchRecurringRuleParticipantIds(db, ruleIds);
  const participantIds = [...new Set([...participantIdsByRule.values()].flat())];
  const profilesById = await fetchParticipantProfilesById(db, participantIds);
  const blocksBySeriesId = new Map<
    string,
    {
      effectiveEndDate: string | null;
      effectiveStartDate: string;
      endTime: string;
      meetingLink: string | null;
      participants: Map<string, ParticipantProfile>;
      startTime: string;
      taskType: RecurringRuleRecord["task_type"];
      title: string;
      weekdays: number[];
    }
  >();

  for (const rule of rows) {
    const current = blocksBySeriesId.get(rule.series_id) ?? {
      effectiveEndDate: rule.effective_end_date,
      effectiveStartDate: rule.effective_start_date,
      endTime: rule.end_time,
      meetingLink: rule.meeting_link,
      participants: new Map<string, ParticipantProfile>(),
      startTime: rule.start_time,
      taskType: rule.task_type,
      title: rule.title,
      weekdays: [],
    };

    current.weekdays.push(rule.weekday);

    if (compareDateKeys(rule.effective_start_date, current.effectiveStartDate) < 0) {
      current.effectiveStartDate = rule.effective_start_date;
    }

    if (
      current.effectiveEndDate === null ||
      (rule.effective_end_date !== null && compareDateKeys(rule.effective_end_date, current.effectiveEndDate) > 0)
    ) {
      current.effectiveEndDate = rule.effective_end_date;
    }

    for (const participantId of participantIdsByRule.get(rule.id) ?? []) {
      const participant = profilesById.get(participantId);

      if (participant) {
        current.participants.set(participant.id, participant);
      }
    }

    blocksBySeriesId.set(rule.series_id, current);
  }

  return [...blocksBySeriesId.entries()]
    .map(([seriesId, block]) => {
      const weekdays = sortWeekdays([...new Set(block.weekdays)]);
      const nextOccurrenceDate = getNextRecurringOccurrenceDate(
        weekdays,
        block.effectiveStartDate,
        block.effectiveEndDate,
        taskDate,
      );

      return {
        effectiveEndDate: block.effectiveEndDate,
        effectiveStartDate: block.effectiveStartDate,
        endTime: block.endTime,
        meetingLink: block.meetingLink,
        nextOccurrenceDate,
        participants: [...block.participants.values()].sort((left, right) => left.fullName.localeCompare(right.fullName)),
        seriesId,
        startTime: block.startTime,
        taskType: block.taskType,
        title: block.title,
        weekdays,
      } satisfies RecurringBlockSummary;
    })
    .filter((block) => block.nextOccurrenceDate !== null)
    .sort((left, right) => {
      const byNextDate = (left.nextOccurrenceDate ?? "").localeCompare(right.nextOccurrenceDate ?? "");

      if (byNextDate !== 0) {
        return byNextDate;
      }

      const byStartTime = left.startTime.localeCompare(right.startTime);

      if (byStartTime !== 0) {
        return byStartTime;
      }

      return left.title.localeCompare(right.title);
    });
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
  await ensureRecurringTasksForDate(db, userId, taskDate, false);
  const tasksForDay = await fetchTaskRowsForDateRaw(db, userId, taskDate);
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
  const [tasksForDay, persistedSummary, recentSummaries, leaderboard, recurringBlocks] = await Promise.all([
    fetchTasksForDate(userId, taskDate),
    db
      .select()
      .from(daily_summaries)
      .where(and(eq(daily_summaries.user_id, userId), eq(daily_summaries.summary_date, taskDate)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    fetchRecentSummaries(userId),
    fetchLeaderboard(),
    fetchRecurringBlocksForDate(db, userId, taskDate),
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
    leaderboard,
    recurringBlocks,
    taskDate,
    tasks: tasksForDay,
    recentSummaries: mergedSummaries,
    summary,
    streak: calculateActiveStreak(mergedSummaries, taskDate),
  };
}

function getOccurrenceDateForTask(task: Pick<TaskRecord, "recurring_occurrence_date" | "task_date">) {
  return task.recurring_occurrence_date ?? task.task_date;
}

function createTaskUpdatePayload(values: TaskFormValues) {
  return {
    title: values.title,
    task_date: values.taskDate,
    start_time: values.startTime,
    end_time: values.endTime,
    task_type: values.taskType,
    meeting_link: values.taskType === "meeting" ? values.meetingLink || null : null,
  };
}

async function fetchOwnedTask(db: DayStackDb, userId: string, taskId: string) {
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.user_id, userId)))
    .limit(1);

  return task ?? null;
}

async function fetchRecurringRule(
  db: DayStackDb,
  userId: string,
  recurringRuleId: string,
) {
  const [rule] = await db
    .select()
    .from(recurring_rules)
    .where(and(eq(recurring_rules.id, recurringRuleId), eq(recurring_rules.user_id, userId)))
    .limit(1);

  return rule ?? null;
}

async function fetchRecurringSeriesRules(
  db: DayStackDb,
  userId: string,
  seriesId: string,
) {
  return db
    .select()
    .from(recurring_rules)
    .where(and(eq(recurring_rules.user_id, userId), eq(recurring_rules.series_id, seriesId)))
    .orderBy(asc(recurring_rules.weekday), asc(recurring_rules.start_time));
}

async function upsertRecurringSkipException(
  db: DayStackDb,
  recurringRuleId: string,
  occurrenceDate: string,
) {
  const now = new Date().toISOString();

  await db
    .insert(recurring_rule_exceptions)
    .values({
      id: crypto.randomUUID(),
      recurring_rule_id: recurringRuleId,
      occurrence_date: occurrenceDate,
      exception_type: "skip",
      created_at: now,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: [recurring_rule_exceptions.recurring_rule_id, recurring_rule_exceptions.occurrence_date],
      set: {
        exception_type: "skip",
        updated_at: now,
      },
    });
}

async function deleteRecurringTasksFromDate(
  db: DayStackDb,
  userId: string,
  recurringRuleIds: string[],
  fromOccurrenceDate: string,
  excludeTaskId?: string,
) {
  if (recurringRuleIds.length === 0) {
    return [] as string[];
  }

  const rows = await db
    .select({
      id: tasks.id,
      taskDate: tasks.task_date,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.user_id, userId),
        inArray(tasks.recurring_rule_id, recurringRuleIds),
        eq(tasks.recurrence_override, false),
        gte(tasks.recurring_occurrence_date, fromOccurrenceDate),
      ),
    );

  const taskIds = rows
    .map((row) => row.id)
    .filter((taskId) => (excludeTaskId ? taskId !== excludeTaskId : true));

  if (taskIds.length === 0) {
    return [] as string[];
  }

  await db.delete(tasks).where(inArray(tasks.id, taskIds));

  return [...new Set(
    rows
      .filter((row) => (excludeTaskId ? row.id !== excludeTaskId : true))
      .map((row) => row.taskDate),
  )];
}

function normalizeRecurringWeekdays(values: Pick<TaskFormValues, "taskDate" | "weekdays">) {
  const selectedWeekdays = values.weekdays.length > 0
    ? values.weekdays
    : [getWeekdayFromDateKey(values.taskDate)];

  return sortWeekdays([...new Set(selectedWeekdays)]);
}

function findRecurringRuleForTaskDate(rules: RecurringRuleRecord[], taskDate: string) {
  const weekday = getWeekdayFromDateKey(taskDate);
  return rules.find((rule) => rule.weekday === weekday) ?? null;
}

async function createRecurringSeriesRules(
  db: DayStackDb,
  userId: string,
  values: TaskFormValues,
  participantIds: string[],
  options?: {
    effectiveEndDate?: string | null;
    effectiveStartDate?: string;
    isActive?: boolean;
    seriesId?: string;
  },
) {
  const now = new Date().toISOString();
  const weekdays = normalizeRecurringWeekdays(values);
  const seriesId = options?.seriesId ?? crypto.randomUUID();
  const createdRules = await db
    .insert(recurring_rules)
    .values(
      weekdays.map((weekday) => ({
        id: crypto.randomUUID(),
        user_id: userId,
        series_id: seriesId,
        template_id: null,
        title: values.title,
        weekday,
        effective_start_date: options?.effectiveStartDate ?? values.taskDate,
        effective_end_date: options?.effectiveEndDate ?? null,
        start_time: values.startTime,
        end_time: values.endTime,
        task_type: values.taskType,
        meeting_link: values.taskType === "meeting" ? values.meetingLink || null : null,
        is_active: options?.isActive ?? true,
        created_at: now,
        updated_at: now,
      })),
    )
    .returning();

  await Promise.all(
    createdRules.map((rule) => replaceRecurringRuleParticipants(db, rule.id, participantIds)),
  );

  return createdRules;
}

async function endRecurringSeriesFromDate(
  db: DayStackDb,
  seriesRules: RecurringRuleRecord[],
  fromDate: string,
  updatedAt: string,
) {
  await Promise.all(
    seriesRules.map((rule) =>
      db
        .update(recurring_rules)
        .set(
          compareDateKeys(fromDate, rule.effective_start_date) <= 0
            ? {
                is_active: false,
                updated_at: updatedAt,
              }
            : {
                effective_end_date: shiftDateKey(fromDate, -1),
                updated_at: updatedAt,
              },
        )
        .where(eq(recurring_rules.id, rule.id)),
    ),
  );
}

async function syncTaskSummaries(userId: string, taskDates: string[]) {
  const uniqueDates = [...new Set(taskDates)];

  if (uniqueDates.length === 0) {
    return;
  }

  await Promise.all(uniqueDates.map((taskDate) => syncDailySummaryForDate(userId, taskDate)));
}

export async function createTask(
  userId: string,
  values: TaskFormValues,
): Promise<TaskRecord> {
  const db = getRequiredDb();
  const participantIds =
    values.taskType === "meeting" ? values.participants.map((participant) => participant.id) : [];

  if (values.blockMode === "recurring") {
    const createdRules = await createRecurringSeriesRules(db, userId, values, participantIds);
    await ensureRecurringTasksForDate(db, userId, values.taskDate);
    await syncDailySummaryForDate(userId, values.taskDate);

    const sourceRule = findRecurringRuleForTaskDate(createdRules, values.taskDate);

    if (!sourceRule) {
      throw new Error("Recurring block creation failed.");
    }

    const [createdTask] = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.user_id, userId),
          eq(tasks.recurring_rule_id, sourceRule.id),
          eq(tasks.recurring_occurrence_date, values.taskDate),
        ),
      )
      .limit(1);

    if (!createdTask) {
      throw new Error("Recurring block creation failed.");
    }

    return createdTask;
  }

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
  recurrenceScope: RecurringTaskScope = "occurrence_only",
): Promise<TaskRecord> {
  const db = getRequiredDb();
  const existingTask = await fetchOwnedTask(db, userId, taskId);

  if (!existingTask) {
    throw new Error("Task not found.");
  }

  const participantIds =
    values.taskType === "meeting" ? values.participants.map((participant) => participant.id) : [];
  const updatePayload = createTaskUpdatePayload(values);
  const now = new Date().toISOString();
  let updatedTask: TaskRecord | null = null;

  if (!existingTask.recurring_rule_id || recurrenceScope === "occurrence_only") {
    [updatedTask] = await db
      .update(tasks)
      .set({
        ...updatePayload,
        recurrence_override: existingTask.recurring_rule_id ? true : existingTask.recurrence_override,
        updated_at: now,
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.user_id, userId)))
      .returning();
  } else {
    const sourceRule = await fetchRecurringRule(db, userId, existingTask.recurring_rule_id);

    if (!sourceRule) {
      [updatedTask] = await db
        .update(tasks)
        .set({
          ...updatePayload,
          recurrence_override: true,
          updated_at: now,
        })
        .where(and(eq(tasks.id, taskId), eq(tasks.user_id, userId)))
        .returning();
    } else {
      if (values.taskDate < existingTask.task_date) {
        throw new Error("Recurring updates can only start from this block or a later date.");
      }

      const existingSeriesRules = await fetchRecurringSeriesRules(db, userId, sourceRule.series_id);
      const existingRuleIds = existingSeriesRules.map((rule) => rule.id);
      const deletedTaskDates = await deleteRecurringTasksFromDate(
        db,
        userId,
        existingRuleIds,
        existingTask.task_date,
        taskId,
      );
      await endRecurringSeriesFromDate(db, existingSeriesRules, existingTask.task_date, now);

      const nextRules = await createRecurringSeriesRules(db, userId, values, participantIds);
      const nextRule = findRecurringRuleForTaskDate(nextRules, values.taskDate);

      if (!nextRule) {
        throw new Error("Task update failed.");
      }

      [updatedTask] = await db
        .update(tasks)
        .set({
          ...updatePayload,
          recurring_rule_id: nextRule.id,
          recurring_occurrence_date: values.taskDate,
          recurrence_override: false,
          updated_at: now,
        })
        .where(and(eq(tasks.id, taskId), eq(tasks.user_id, userId)))
        .returning();

      await syncTaskSummaries(userId, [existingTask.task_date, values.taskDate, ...deletedTaskDates]);
    }
  }

  if (!updatedTask) {
    throw new Error("Task update failed.");
  }

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

  if (!existingTask.recurring_rule_id || recurrenceScope === "occurrence_only") {
    await syncTaskSummaries(userId, [existingTask.task_date, values.taskDate]);
  }

  return updatedTask;
}

export async function rescheduleTask(
  userId: string,
  taskId: string,
  values: Pick<TaskFormValues, "endTime" | "startTime" | "taskDate">,
  propagationMode: TaskPropagationMode = "owner_only",
  recurrenceScope: RecurringTaskScope = "occurrence_only",
): Promise<TaskRecord> {
  const db = getRequiredDb();
  const existingTask = await fetchOwnedTask(db, userId, taskId);

  if (!existingTask) {
    throw new Error("Task not found.");
  }

  const participantRows = await db
    .select({ participant_id: task_participants.participant_id })
    .from(task_participants)
    .where(eq(task_participants.task_id, taskId));
  const participantIds = participantRows.map((participant) => participant.participant_id);
  const profilesById = await fetchParticipantProfilesById(db, participantIds);
  let weekdays: number[] = [];

  if (existingTask.recurring_rule_id) {
    const sourceRule = await fetchRecurringRule(db, userId, existingTask.recurring_rule_id);

    if (sourceRule) {
      const seriesRules = await fetchRecurringSeriesRules(db, userId, sourceRule.series_id);
      const currentWeekday = getWeekdayFromDateKey(existingTask.task_date);
      const nextWeekday = getWeekdayFromDateKey(values.taskDate);
      weekdays =
        recurrenceScope === "this_and_future"
          ? sortWeekdays(
              [...seriesRules.map((rule) => rule.weekday).filter((weekday) => weekday !== currentWeekday), nextWeekday],
            )
          : [nextWeekday];
    }
  }

  return updateTask(
    userId,
    taskId,
    {
      blockMode: existingTask.recurring_rule_id ? "recurring" : "one_time",
      title: existingTask.title,
      taskDate: values.taskDate,
      startTime: values.startTime,
      endTime: values.endTime,
      taskType: existingTask.task_type,
      meetingLink: existingTask.meeting_link ?? "",
      weekdays,
      participants:
        existingTask.task_type === "meeting"
          ? participantIds.flatMap((participantId) => {
              const profile = profilesById.get(participantId);

              return profile
                ? [
                    {
                      id: profile.id,
                      fullName: profile.fullName,
                    },
                  ]
                : [];
            })
          : [],
    },
    propagationMode,
    recurrenceScope,
  );
}

export async function deleteTask(
  userId: string,
  taskId: string,
  recurrenceScope: RecurringTaskScope = "occurrence_only",
): Promise<string> {
  const db = getRequiredDb();
  const task = await fetchOwnedTask(db, userId, taskId);

  if (!task) {
    throw new Error("Task not found.");
  }

  let summaryDates = [task.task_date];

  if (!task.recurring_rule_id || recurrenceScope === "occurrence_only") {
    if (task.recurring_rule_id) {
      await upsertRecurringSkipException(db, task.recurring_rule_id, getOccurrenceDateForTask(task));
    }

    await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.user_id, userId)));
  } else {
    const sourceRule = await fetchRecurringRule(db, userId, task.recurring_rule_id);

    if (sourceRule) {
      const now = new Date().toISOString();
      const seriesRules = await fetchRecurringSeriesRules(db, userId, sourceRule.series_id);
      const deletedTaskDates = await deleteRecurringTasksFromDate(
        db,
        userId,
        seriesRules.map((rule) => rule.id),
        task.task_date,
      );
      await endRecurringSeriesFromDate(db, seriesRules, task.task_date, now);
      summaryDates = [...new Set([task.task_date, ...deletedTaskDates])];
    }

    await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.user_id, userId)));
  }

  await expireTaskMentionNotifications(userId, taskId);

  if (!task.recurring_rule_id || recurrenceScope === "occurrence_only") {
    await syncDailySummaryForDate(userId, task.task_date);
  } else {
    await syncTaskSummaries(userId, summaryDates);
  }

  return task.task_date;
}

export async function updateRecurringSeries(
  userId: string,
  seriesId: string,
  values: TaskFormValues,
): Promise<void> {
  if (values.blockMode !== "recurring") {
    throw new Error("Recurring blocks must stay in recurring mode.");
  }

  const db = getRequiredDb();
  const existingSeriesRules = await fetchRecurringSeriesRules(db, userId, seriesId);

  if (existingSeriesRules.length === 0) {
    throw new Error("Recurring block not found.");
  }

  const participantIds =
    values.taskType === "meeting" ? values.participants.map((participant) => participant.id) : [];
  const now = new Date().toISOString();
  const deletedTaskDates = await deleteRecurringTasksFromDate(
    db,
    userId,
    existingSeriesRules.map((rule) => rule.id),
    values.taskDate,
  );

  await endRecurringSeriesFromDate(db, existingSeriesRules, values.taskDate, now);
  await createRecurringSeriesRules(db, userId, values, participantIds);
  await ensureRecurringTasksForDate(db, userId, values.taskDate);
  await syncTaskSummaries(userId, [values.taskDate, ...deletedTaskDates]);
}

export async function deleteRecurringSeries(
  userId: string,
  seriesId: string,
  fromDate: string,
): Promise<void> {
  const db = getRequiredDb();
  const existingSeriesRules = await fetchRecurringSeriesRules(db, userId, seriesId);

  if (existingSeriesRules.length === 0) {
    throw new Error("Recurring block not found.");
  }

  const now = new Date().toISOString();
  const deletedTaskDates = await deleteRecurringTasksFromDate(
    db,
    userId,
    existingSeriesRules.map((rule) => rule.id),
    fromDate,
  );

  await endRecurringSeriesFromDate(db, existingSeriesRules, fromDate, now);
  await syncTaskSummaries(userId, [fromDate, ...deletedTaskDates]);
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
