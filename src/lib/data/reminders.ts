import "server-only";

import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";

import { getDb } from "@/db/client";
import { task_reminders, tasks, user_notification_preferences, users } from "@/db/schema";
import { formatClockTime, formatDateKey } from "@/lib/daystack";
import type {
  DueTaskReminder,
  ReminderStatus,
  ReminderType,
  TaskRecord,
  TaskReminderRecord,
  UserNotificationPreferencesRecord,
} from "@/types/daystack";

type DayStackDb = NonNullable<ReturnType<typeof getDb>>;

const DEFAULT_EMAIL_REMINDER_LEAD_MINUTES = 15;

const DEFAULT_REMINDER_PREFERENCES = {
  push_enabled: false,
  email_enabled: false,
  meeting_mention_email_enabled: false,
  email_reminder_lead_minutes: DEFAULT_EMAIL_REMINDER_LEAD_MINUTES,
  remind_5_min_before: true,
  remind_at_start: true,
  remind_overdue: false,
} as const;

const MUTABLE_REMINDER_STATUSES: ReminderStatus[] = ["failed", "pending", "processing", "skipped"];

function getRequiredDb(): DayStackDb {
  const db = getDb();

  if (!db) {
    throw new Error("Database is not configured.");
  }

  return db;
}

function clampEmailReminderLeadMinutes(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_EMAIL_REMINDER_LEAD_MINUTES;
  }

  return Math.min(1440, Math.max(0, Math.round(value)));
}

function createDefaultPreferences(userId: string): UserNotificationPreferencesRecord {
  const nowIso = new Date().toISOString();

  return {
    user_id: userId,
    ...DEFAULT_REMINDER_PREFERENCES,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

function buildReminderTimestamp(taskDate: string, time: string, offsetMinutes = 0) {
  const localDate = new Date(`${taskDate}T${time}`);

  if (Number.isNaN(localDate.getTime())) {
    throw new Error("Unable to schedule the reminder for this task.");
  }

  localDate.setMinutes(localDate.getMinutes() + offsetMinutes);

  return localDate.toISOString();
}

function getReminderRowsForTask(
  userId: string,
  task: Pick<TaskRecord, "end_time" | "id" | "start_time" | "status" | "task_date">,
  preferences: UserNotificationPreferencesRecord,
) {
  if (task.status !== "pending") {
    return [];
  }

  const rows: Array<Pick<TaskReminderRecord, "remind_at" | "reminder_type" | "status" | "task_id" | "user_id">> = [];

  if (preferences.email_enabled) {
    rows.push({
      user_id: userId,
      task_id: task.id,
      reminder_type: "email_before_start",
      remind_at: buildReminderTimestamp(
        task.task_date,
        task.start_time,
        clampEmailReminderLeadMinutes(preferences.email_reminder_lead_minutes) * -1,
      ),
      status: "pending",
    });
  }

  return rows;
}

export async function fetchNotificationPreferences(
  userId: string,
): Promise<UserNotificationPreferencesRecord> {
  const db = getRequiredDb();
  const [preferences] = await db
    .select()
    .from(user_notification_preferences)
    .where(eq(user_notification_preferences.user_id, userId))
    .limit(1);

  return preferences ?? createDefaultPreferences(userId);
}

async function fetchPendingTasksForReminderSync(
  db: DayStackDb,
  userId: string,
  fromDate: string,
): Promise<TaskRecord[]> {
  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.user_id, userId),
        eq(tasks.status, "pending"),
        gte(tasks.task_date, fromDate),
      ),
    )
    .orderBy(asc(tasks.task_date), asc(tasks.start_time));
}

export async function syncTaskRemindersForTask(
  userId: string,
  task: Pick<TaskRecord, "end_time" | "id" | "start_time" | "status" | "task_date">,
  preferences?: UserNotificationPreferencesRecord,
) {
  const db = getRequiredDb();
  const activePreferences = preferences ?? (await fetchNotificationPreferences(userId));

  await db
    .delete(task_reminders)
    .where(
      and(
        eq(task_reminders.task_id, task.id),
        inArray(task_reminders.status, MUTABLE_REMINDER_STATUSES),
      ),
    );

  const reminderRows = getReminderRowsForTask(userId, task, activePreferences);

  if (reminderRows.length === 0) {
    return;
  }

  await db.insert(task_reminders).values(
    reminderRows.map((row) => ({
      id: crypto.randomUUID(),
      ...row,
    })),
  );
}

export async function syncTaskRemindersForUser(
  userId: string,
  preferences?: UserNotificationPreferencesRecord,
  now = new Date(),
) {
  const db = getRequiredDb();
  const activePreferences = preferences ?? (await fetchNotificationPreferences(userId));
  const pendingTasks = await fetchPendingTasksForReminderSync(db, userId, formatDateKey(now));

  if (pendingTasks.length === 0) {
    return activePreferences;
  }

  await Promise.all(pendingTasks.map((task) => syncTaskRemindersForTask(userId, task, activePreferences)));

  return activePreferences;
}

export async function updateNotificationPreferences(
  userId: string,
  updates: Partial<
    Pick<
      UserNotificationPreferencesRecord,
      | "push_enabled"
      | "email_enabled"
      | "meeting_mention_email_enabled"
      | "email_reminder_lead_minutes"
      | "remind_5_min_before"
      | "remind_at_start"
      | "remind_overdue"
    >
  >,
  now = new Date(),
): Promise<UserNotificationPreferencesRecord> {
  const db = getRequiredDb();
  const current = await fetchNotificationPreferences(userId);
  const timestamp = now.toISOString();
  const nextPreferences = {
    user_id: userId,
    push_enabled: updates.push_enabled ?? current.push_enabled,
    email_enabled: updates.email_enabled ?? current.email_enabled,
    meeting_mention_email_enabled:
      updates.meeting_mention_email_enabled ?? current.meeting_mention_email_enabled,
    email_reminder_lead_minutes: clampEmailReminderLeadMinutes(
      updates.email_reminder_lead_minutes ?? current.email_reminder_lead_minutes,
    ),
    remind_5_min_before: updates.remind_5_min_before ?? current.remind_5_min_before,
    remind_at_start: updates.remind_at_start ?? current.remind_at_start,
    remind_overdue: updates.remind_overdue ?? current.remind_overdue,
  };

  const [savedPreferences] = await db
    .insert(user_notification_preferences)
    .values({
      ...nextPreferences,
      created_at: current.created_at ?? timestamp,
      updated_at: timestamp,
    })
    .onConflictDoUpdate({
      target: user_notification_preferences.user_id,
      set: {
        ...nextPreferences,
        updated_at: timestamp,
      },
    })
    .returning();

  await syncTaskRemindersForUser(userId, savedPreferences, now);

  return savedPreferences;
}

export async function fetchDueTaskReminders(options?: {
  limit?: number;
  nowIso?: string;
  userId?: string;
}): Promise<DueTaskReminder[]> {
  const db = getRequiredDb();
  const nowIso = options?.nowIso ?? new Date().toISOString();
  const conditions = [eq(task_reminders.status, "pending"), lte(task_reminders.remind_at, nowIso)];

  if (options?.userId) {
    conditions.push(eq(task_reminders.user_id, options.userId));
  }

  const reminderRows = await db
    .select()
    .from(task_reminders)
    .where(and(...conditions))
    .orderBy(asc(task_reminders.remind_at))
    .limit(options?.limit ?? 25);

  if (reminderRows.length === 0) {
    return [];
  }

  const taskIds = [...new Set(reminderRows.map((reminder) => reminder.task_id))];
  const userIds = [...new Set(reminderRows.map((reminder) => reminder.user_id))];
  const [taskRows, preferenceRows, recipientRows] = await Promise.all([
    db
      .select({
        end_time: tasks.end_time,
        id: tasks.id,
        meeting_link: tasks.meeting_link,
        start_time: tasks.start_time,
        status: tasks.status,
        task_date: tasks.task_date,
        task_type: tasks.task_type,
        title: tasks.title,
        user_id: tasks.user_id,
      })
      .from(tasks)
      .where(inArray(tasks.id, taskIds)),
    db
      .select()
      .from(user_notification_preferences)
      .where(inArray(user_notification_preferences.user_id, userIds)),
    db
      .select({
        email: users.email,
        full_name: users.full_name,
        id: users.id,
      })
      .from(users)
      .where(inArray(users.id, userIds)),
  ]);

  const tasksById = new Map(taskRows.map((task) => [task.id, task]));
  const preferencesByUserId = new Map(
    preferenceRows.map((preference) => [preference.user_id, preference]),
  );
  const recipientsById = new Map(recipientRows.map((recipient) => [recipient.id, recipient]));

  return reminderRows.flatMap((reminder) => {
    const task = tasksById.get(reminder.task_id);
    const preference = preferencesByUserId.get(reminder.user_id) ?? createDefaultPreferences(reminder.user_id);
    const recipient = recipientsById.get(reminder.user_id);

    if (!task || !recipient) {
      return [];
    }

    return [
      {
        reminder,
        preferences: preference,
        recipient,
        task,
      },
    ];
  });
}

export async function updateTaskReminderStatus(
  reminderId: string,
  status: ReminderStatus,
  options?: {
    sentAt?: string | null;
    userId?: string;
  },
) {
  const db = getRequiredDb();
  const conditions = [eq(task_reminders.id, reminderId)];

  if (options?.userId) {
    conditions.push(eq(task_reminders.user_id, options.userId));
  }

  await db
    .update(task_reminders)
    .set({
      status,
      sent_at: options?.sentAt ?? null,
      updated_at: new Date().toISOString(),
    })
    .where(and(...conditions));
}

export function isEmailReminderType(reminderType: ReminderType) {
  return reminderType === "email_before_start";
}

export function buildReminderCopy(
  task: Pick<TaskRecord, "end_time" | "start_time" | "title">,
  reminderType: ReminderType,
  options?: {
    emailLeadMinutes?: number;
  },
) {
  if (reminderType === "email_before_start") {
    const leadMinutes = clampEmailReminderLeadMinutes(options?.emailLeadMinutes);

    if (leadMinutes === 0) {
      return {
        title: "Block starting now",
        body: `${task.title} starts at ${formatClockTime(task.start_time)}.`,
      };
    }

    return {
      title: `Block starting in ${leadMinutes} minute${leadMinutes === 1 ? "" : "s"}`,
      body: `${task.title} begins at ${formatClockTime(task.start_time)}.`,
    };
  }

  return {
    title: "Reminder unavailable",
    body: `${task.title} was scheduled for ${formatClockTime(task.start_time)}.`,
  };
}
