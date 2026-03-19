import "server-only";

import { count, desc, eq, inArray } from "drizzle-orm";

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

function mapAdminAccount(
  user: typeof users.$inferSelect,
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
  const usageById = await fetchUsageByIds(db, [user.id]);
  return mapAdminAccount(user, usageById.get(user.id));
}

export async function fetchAdminDashboardSnapshot() {
  return withDbReconnectRetry(async (db) => {
    const userRows = await db.select().from(users).orderBy(desc(users.created_at));
    const usageById = await fetchUsageByIds(db, userRows.map((user) => user.id));
    const accounts = sortAccounts(userRows.map((user) => mapAdminAccount(user, usageById.get(user.id))));

    return buildSnapshot(accounts);
  });
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
