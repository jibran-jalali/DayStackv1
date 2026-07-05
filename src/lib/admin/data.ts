import "server-only";

import { count, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb, withDbReconnectRetry } from "@/db/client";
import {
  daily_summaries,
  task_notifications,
  task_participants,
  task_reminders,
  tasks,
  user_notification_preferences,
  users,
} from "@/db/schema";
import { deriveDisplayName } from "@/lib/daystack";
import type { AdminAccount, AdminDashboardSnapshot } from "@/types/admin";

type DayStackDb = NonNullable<ReturnType<typeof getDb>>;

interface StorageRow {
  storage_bytes: bigint | number | string | null;
  user_id: string;
}

function buildSnapshot(accounts: AdminAccount[]): AdminDashboardSnapshot {
  const activeAccounts = accounts.filter((account) => account.status === "active").length;
  const disabledAccounts = accounts.length - activeAccounts;

  return {
    accounts,
    activeAccounts,
    disabledAccounts,
    totalAccounts: accounts.length,
  };
}

function sortAccounts(accounts: AdminAccount[]) {
  return [...accounts].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function fetchUsageByIds(db: DayStackDb, userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, number>();
  }

  const [taskCounts, participantCounts, summaryCounts, preferenceCounts, reminderCounts, notificationCounts] =
    await Promise.all([
      db
        .select({
          owned_records: count(),
          user_id: tasks.user_id,
        })
        .from(tasks)
        .where(inArray(tasks.user_id, userIds))
        .groupBy(tasks.user_id),
      db
        .select({
          owned_records: count(),
          user_id: tasks.user_id,
        })
        .from(task_participants)
        .innerJoin(tasks, eq(tasks.id, task_participants.task_id))
        .where(inArray(tasks.user_id, userIds))
        .groupBy(tasks.user_id),
      db
        .select({
          owned_records: count(),
          user_id: daily_summaries.user_id,
        })
        .from(daily_summaries)
        .where(inArray(daily_summaries.user_id, userIds))
        .groupBy(daily_summaries.user_id),
      db
        .select({
          owned_records: count(),
          user_id: user_notification_preferences.user_id,
        })
        .from(user_notification_preferences)
        .where(inArray(user_notification_preferences.user_id, userIds))
        .groupBy(user_notification_preferences.user_id),
      db
        .select({
          owned_records: count(),
          user_id: task_reminders.user_id,
        })
        .from(task_reminders)
        .where(inArray(task_reminders.user_id, userIds))
        .groupBy(task_reminders.user_id),
      db
        .select({
          owned_records: count(),
          user_id: task_notifications.user_id,
        })
        .from(task_notifications)
        .where(inArray(task_notifications.user_id, userIds))
        .groupBy(task_notifications.user_id),
    ]);

  const usageById = new Map(userIds.map((userId) => [userId, 1]));
  const usageRows = [
    ...taskCounts,
    ...participantCounts,
    ...summaryCounts,
    ...preferenceCounts,
    ...reminderCounts,
    ...notificationCounts,
  ];

  for (const row of usageRows) {
    usageById.set(row.user_id, (usageById.get(row.user_id) ?? 0) + Number(row.owned_records));
  }

  return usageById;
}

function normalizeStorageRows(result: unknown): StorageRow[] {
  if (Array.isArray(result)) {
    return result as StorageRow[];
  }

  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: unknown }).rows)) {
    return (result as { rows: StorageRow[] }).rows;
  }

  return [];
}

function storageBytesToNumber(value: StorageRow["storage_bytes"]) {
  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

async function fetchStorageBytesByIds(db: DayStackDb, userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, number>();
  }

  const rows = normalizeStorageRows(
    await db.execute(sql`
      with storage_rows as (
        select id as user_id, pg_column_size(users.*)::bigint as bytes from users where id = any(${userIds}::uuid[])
        union all select user_id, pg_column_size(tasks.*)::bigint from tasks where user_id = any(${userIds}::uuid[])
        union all select user_id, pg_column_size(api_keys.*)::bigint from api_keys where user_id = any(${userIds}::uuid[])
        union all select requester_id as user_id, pg_column_size(friend_connections.*)::bigint from friend_connections where requester_id = any(${userIds}::uuid[])
        union all select addressee_id as user_id, pg_column_size(friend_connections.*)::bigint from friend_connections where addressee_id = any(${userIds}::uuid[])
        union all select user_id, pg_column_size(recurring_templates.*)::bigint from recurring_templates where user_id = any(${userIds}::uuid[])
        union all select user_id, pg_column_size(recurring_rules.*)::bigint from recurring_rules where user_id = any(${userIds}::uuid[])
        union all select recurring_rules.user_id, pg_column_size(recurring_rule_participants.*)::bigint from recurring_rule_participants inner join recurring_rules on recurring_rules.id = recurring_rule_participants.recurring_rule_id where recurring_rules.user_id = any(${userIds}::uuid[])
        union all select recurring_rules.user_id, pg_column_size(recurring_rule_exceptions.*)::bigint from recurring_rule_exceptions inner join recurring_rules on recurring_rules.id = recurring_rule_exceptions.recurring_rule_id where recurring_rules.user_id = any(${userIds}::uuid[])
        union all select tasks.user_id, pg_column_size(task_participants.*)::bigint from task_participants inner join tasks on tasks.id = task_participants.task_id where tasks.user_id = any(${userIds}::uuid[])
        union all select user_id, pg_column_size(daily_summaries.*)::bigint from daily_summaries where user_id = any(${userIds}::uuid[])
        union all select user_id, pg_column_size(user_notification_preferences.*)::bigint from user_notification_preferences where user_id = any(${userIds}::uuid[])
        union all select user_id, pg_column_size(push_subscriptions.*)::bigint from push_subscriptions where user_id = any(${userIds}::uuid[])
        union all select user_id, pg_column_size(google_calendar_connections.*)::bigint from google_calendar_connections where user_id = any(${userIds}::uuid[])
        union all select user_id, pg_column_size(task_calendar_events.*)::bigint from task_calendar_events where user_id = any(${userIds}::uuid[])
        union all select user_id, pg_column_size(task_reminders.*)::bigint from task_reminders where user_id = any(${userIds}::uuid[])
        union all select user_id, pg_column_size(task_notifications.*)::bigint from task_notifications where user_id = any(${userIds}::uuid[])
        union all select actor_user_id as user_id, pg_column_size(task_notifications.*)::bigint from task_notifications where actor_user_id = any(${userIds}::uuid[])
      )
      select user_id, coalesce(sum(bytes), 0)::bigint as storage_bytes
      from storage_rows
      group by user_id
    `),
  );

  const storageById = new Map(userIds.map((userId) => [userId, 0]));

  for (const row of rows) {
    storageById.set(row.user_id, storageBytesToNumber(row.storage_bytes));
  }

  return storageById;
}

function mapAdminAccount(
  user: typeof users.$inferSelect,
  storageBytes: number | undefined,
  usage: number | undefined,
): AdminAccount {
  return {
    createdAt: user.created_at,
    email: user.email,
    estimatedOwnedRecords: usage ?? 0,
    id: user.id,
    lastSignInAt: user.last_sign_in_at ?? null,
    name: deriveDisplayName(user.full_name, user.email),
    status: user.status,
    storageBytes: storageBytes ?? null,
  };
}

async function fetchAccountById(db: DayStackDb, accountId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, accountId)).limit(1);

  if (!user) {
    throw new Error("Account not found.");
  }

  return user;
}

async function mapSingleAccount(db: DayStackDb, user: typeof users.$inferSelect) {
  const [storageById, usageById] = await Promise.all([
    fetchStorageBytesByIds(db, [user.id]),
    fetchUsageByIds(db, [user.id]),
  ]);

  return mapAdminAccount(user, storageById.get(user.id), usageById.get(user.id));
}

export async function fetchAdminDashboardSnapshot() {
  return withDbReconnectRetry(async (db) => {
    const userRows = await db.select().from(users).orderBy(desc(users.created_at));
    const userIds = userRows.map((user) => user.id);
    const [storageById, usageById] = await Promise.all([
      fetchStorageBytesByIds(db, userIds),
      fetchUsageByIds(db, userIds),
    ]);
    const accounts = sortAccounts(userRows.map((user) => mapAdminAccount(user, storageById.get(user.id), usageById.get(user.id))));

    return buildSnapshot(accounts);
  });
}

export async function fetchAdminAccountById(accountId: string) {
  return withDbReconnectRetry(async (db) => mapSingleAccount(db, await fetchAccountById(db, accountId)));
}

export async function disableAdminAccount(accountId: string) {
  return withDbReconnectRetry(async (db) => {
    const [user] = await db
      .update(users)
      .set({
        status: "disabled",
        updated_at: new Date().toISOString(),
      })
      .where(eq(users.id, accountId))
      .returning();

    if (!user) {
      return mapSingleAccount(db, await fetchAccountById(db, accountId));
    }

    return mapSingleAccount(db, user);
  });
}

export async function activateAdminAccount(accountId: string) {
  return withDbReconnectRetry(async (db) => {
    const [user] = await db
      .update(users)
      .set({
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .where(eq(users.id, accountId))
      .returning();

    if (!user) {
      return mapSingleAccount(db, await fetchAccountById(db, accountId));
    }

    return mapSingleAccount(db, user);
  });
}

export async function deleteAdminAccount(accountId: string) {
  return withDbReconnectRetry(async (db) => {
    await db.delete(users).where(eq(users.id, accountId));
  });
}
