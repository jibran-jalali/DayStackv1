import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  daily_summaries,
  task_notifications,
  task_participants,
  tasks,
  users,
} from "@/db/schema";
import { syncTaskRemindersForTask } from "@/lib/data/reminders";
import { buildSummary, deriveDisplayName } from "@/lib/daystack";
import type {
  ParticipantProfile,
  PlannerNotification,
  ProfileRecord,
  TaskNotificationAcceptResult,
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

function mapParticipantProfile(
  profile: Pick<ProfileRecord, "email" | "full_name" | "id">,
): ParticipantProfile {
  return {
    email: profile.email,
    id: profile.id,
    fullName: deriveDisplayName(profile.full_name, profile.email ?? undefined),
  };
}

function createNotificationSnapshot(
  task: Pick<TaskRecord, "end_time" | "id" | "meeting_link" | "start_time" | "task_date" | "task_type" | "title">,
) {
  return {
    end_time: task.end_time,
    meeting_link: task.meeting_link,
    start_time: task.start_time,
    task_date: task.task_date,
    task_id: task.id,
    task_title: task.title,
    task_type: task.task_type,
  };
}

async function syncAcceptedTaskSummary(userId: string, taskDate: string) {
  const db = getRequiredDb();
  const rows = await db
    .select({
      status: tasks.status,
      task_type: tasks.task_type,
    })
    .from(tasks)
    .where(and(eq(tasks.user_id, userId), eq(tasks.task_date, taskDate)));

  const summary = buildSummary(rows);
  const now = new Date().toISOString();

  await db
    .insert(daily_summaries)
    .values({
      id: crypto.randomUUID(),
      user_id: userId,
      summary_date: taskDate,
      total_tasks: summary.totalTasks,
      completed_tasks: summary.completedTasks,
      execution_score: summary.executionScore,
      successful_day: summary.successfulDay,
      created_at: now,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: [daily_summaries.user_id, daily_summaries.summary_date],
      set: {
        total_tasks: summary.totalTasks,
        completed_tasks: summary.completedTasks,
        execution_score: summary.executionScore,
        successful_day: summary.successfulDay,
        updated_at: now,
      },
    });
}

export async function fetchTaskNotifications(
  userId: string,
  limit = 10,
): Promise<PlannerNotification[]> {
  const db = getRequiredDb();
  const notificationRows = await db
    .select()
    .from(task_notifications)
    .where(eq(task_notifications.user_id, userId))
    .orderBy(desc(task_notifications.created_at))
    .limit(limit);

  if (notificationRows.length === 0) {
    return [];
  }

  const actorIds = [...new Set(notificationRows.map((notification) => notification.actor_user_id))];
  const acceptedTaskIds = [
    ...new Set(
      notificationRows
        .map((notification) => notification.accepted_task_id)
        .filter((taskId): taskId is string => Boolean(taskId)),
    ),
  ];

  const [actorRows, acceptedTaskRows] = await Promise.all([
    db
      .select({
        email: users.email,
        full_name: users.full_name,
        id: users.id,
      })
      .from(users)
      .where(inArray(users.id, actorIds)),
    acceptedTaskIds.length > 0
      ? db
          .select({
            id: tasks.id,
            task_date: tasks.task_date,
          })
          .from(tasks)
          .where(inArray(tasks.id, acceptedTaskIds))
      : Promise.resolve([]),
  ]);

  const actorsById = new Map(actorRows.map((actor) => [actor.id, mapParticipantProfile(actor)]));
  const acceptedTaskDatesById = new Map(
    acceptedTaskRows.map((task) => [task.id, task.task_date]),
  );

  return notificationRows
    .map(
      (notification) =>
        ({
          acceptedTaskDate: notification.accepted_task_id
            ? acceptedTaskDatesById.get(notification.accepted_task_id) ?? notification.task_date
            : null,
          acceptedTaskId: notification.accepted_task_id,
          actor: actorsById.get(notification.actor_user_id) ?? null,
          actorId: notification.actor_user_id,
          createdAt: notification.created_at,
          endTime: notification.end_time,
          id: notification.id,
          meetingLink: notification.meeting_link,
          notificationType: notification.notification_type,
          readAt: notification.read_at,
          startTime: notification.start_time,
          status: notification.status,
          taskDate: notification.task_date,
          taskId: notification.task_id,
          taskTitle: notification.task_title,
          taskType: notification.task_type,
        }) satisfies PlannerNotification,
    )
    .sort((left, right) => {
      const leftUnread = left.readAt ? 0 : 1;
      const rightUnread = right.readAt ? 0 : 1;

      if (leftUnread !== rightUnread) {
        return rightUnread - leftUnread;
      }

      const leftPending = left.status === "pending" ? 1 : 0;
      const rightPending = right.status === "pending" ? 1 : 0;

      if (leftPending !== rightPending) {
        return rightPending - leftPending;
      }

      return right.createdAt.localeCompare(left.createdAt);
    });
}

export async function markTaskNotificationsRead(userId: string, notificationIds: string[]) {
  const db = getRequiredDb();
  const uniqueIds = [...new Set(notificationIds)];

  if (uniqueIds.length === 0) {
    return 0;
  }

  const updatedRows = await db
    .update(task_notifications)
    .set({
      read_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .where(
      and(
        eq(task_notifications.user_id, userId),
        inArray(task_notifications.id, uniqueIds),
      ),
    )
    .returning({ id: task_notifications.id });

  return updatedRows.length;
}

export async function syncTaskMentionNotificationsForTask(
  actorUserId: string,
  taskId: string,
) {
  const db = getRequiredDb();
  const [task] = await db
    .select({
      end_time: tasks.end_time,
      id: tasks.id,
      meeting_link: tasks.meeting_link,
      start_time: tasks.start_time,
      task_date: tasks.task_date,
      task_type: tasks.task_type,
      title: tasks.title,
      user_id: tasks.user_id,
    })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.user_id, actorUserId)))
    .limit(1);

  if (!task) {
    throw new Error("Task not found.");
  }

  const [participantRows, existingRows] = await Promise.all([
    db
      .select({ participant_id: task_participants.participant_id })
      .from(task_participants)
      .where(eq(task_participants.task_id, taskId)),
    db
      .select()
      .from(task_notifications)
      .where(
        and(
          eq(task_notifications.task_id, taskId),
          eq(task_notifications.notification_type, "task_mention"),
        ),
      ),
  ]);

  const nextRecipientIds =
    task.task_type === "meeting"
      ? [
          ...new Set(
              participantRows
                .map((row) => row.participant_id)
                .filter((participantId): participantId is string => participantId !== actorUserId),
            ),
        ]
      : [];
  const nextRecipientIdSet = new Set(nextRecipientIds);
  const acceptedRows = existingRows.filter(
    (notification) => notification.status === "accepted" && nextRecipientIdSet.has(notification.user_id),
  );
  const upsertRows = nextRecipientIds
    .filter((recipientId) => !acceptedRows.some((notification) => notification.user_id === recipientId))
    .map((recipientId) => ({
      id: crypto.randomUUID(),
      actor_user_id: actorUserId,
      notification_type: "task_mention" as const,
      read_at: null,
      status: "pending" as const,
      user_id: recipientId,
      ...createNotificationSnapshot(task),
    }));

  if (upsertRows.length > 0) {
    const now = new Date().toISOString();
    await db
      .insert(task_notifications)
      .values(upsertRows)
      .onConflictDoUpdate({
        target: [
          task_notifications.task_id,
          task_notifications.user_id,
          task_notifications.notification_type,
        ],
        set: {
          actor_user_id: actorUserId,
          ...createNotificationSnapshot(task),
          read_at: null,
          status: "pending",
          updated_at: now,
        },
      });
  }

  if (acceptedRows.length > 0) {
    await db
      .update(task_notifications)
      .set({
        actor_user_id: actorUserId,
        ...createNotificationSnapshot(task),
        updated_at: new Date().toISOString(),
      })
      .where(
        inArray(
          task_notifications.id,
          acceptedRows.map((notification) => notification.id),
        ),
      );
  }

  const dismissedIds = existingRows
    .filter((notification) => notification.status === "pending" && !nextRecipientIdSet.has(notification.user_id))
    .map((notification) => notification.id);

  if (dismissedIds.length > 0) {
    await db
      .update(task_notifications)
      .set({
        read_at: new Date().toISOString(),
        status: "dismissed",
        updated_at: new Date().toISOString(),
      })
      .where(inArray(task_notifications.id, dismissedIds));
  }
}

export async function expireTaskMentionNotifications(actorUserId: string, taskId: string) {
  const db = getRequiredDb();

  await db
    .update(task_notifications)
    .set({
      read_at: new Date().toISOString(),
      status: "expired",
      updated_at: new Date().toISOString(),
    })
    .where(
      and(
        eq(task_notifications.task_id, taskId),
        eq(task_notifications.actor_user_id, actorUserId),
        eq(task_notifications.status, "pending"),
      ),
    );
}

export async function acceptTaskNotification(
  userId: string,
  notificationId: string,
): Promise<TaskNotificationAcceptResult> {
  const db = getRequiredDb();

  const result = await db.transaction(async (tx) => {
    const [notification] = await tx
      .select()
      .from(task_notifications)
      .where(and(eq(task_notifications.id, notificationId), eq(task_notifications.user_id, userId)))
      .limit(1);

    if (!notification) {
      throw new Error("This notification is no longer available.");
    }

    if (notification.status === "accepted" && notification.accepted_task_id) {
      const [existingAcceptedTask] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, notification.accepted_task_id), eq(tasks.user_id, userId)))
        .limit(1);

      if (existingAcceptedTask) {
        await tx
          .update(task_notifications)
          .set({
            read_at: notification.read_at ?? new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .where(eq(task_notifications.id, notification.id));

        return {
          acceptedTask: existingAcceptedTask,
          result: {
            acceptedTaskId: existingAcceptedTask.id,
            outcome: "already_accepted" as const,
            taskDate: existingAcceptedTask.task_date,
          },
        };
      }
    }

    const [existingClone] = await tx
      .select()
      .from(tasks)
      .where(and(eq(tasks.user_id, userId), eq(tasks.source_task_id, notification.task_id)))
      .limit(1);

    if (existingClone) {
      await tx
        .update(task_notifications)
        .set({
          status: "accepted",
          accepted_task_id: existingClone.id,
          read_at: notification.read_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .where(eq(task_notifications.id, notification.id));

      return {
        acceptedTask: existingClone,
        result: {
          acceptedTaskId: existingClone.id,
          outcome: "already_accepted" as const,
          taskDate: existingClone.task_date,
        },
      };
    }

    const [sourceTask] = await tx
      .select()
      .from(tasks)
      .where(eq(tasks.id, notification.task_id))
      .limit(1);

    if (!sourceTask) {
      await tx
        .update(task_notifications)
        .set({
          status: "expired",
          read_at: notification.read_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .where(eq(task_notifications.id, notification.id));

      return {
        acceptedTask: null,
        result: {
          acceptedTaskId: null,
          outcome: "task_missing" as const,
          taskDate: notification.task_date,
        },
      };
    }

    const clonedTaskId = crypto.randomUUID();
    const [clonedTask] = await tx
      .insert(tasks)
      .values({
        id: clonedTaskId,
        user_id: userId,
        title: sourceTask.title,
        task_date: sourceTask.task_date,
        start_time: sourceTask.start_time,
        end_time: sourceTask.end_time,
        task_type: sourceTask.task_type,
        meeting_link: sourceTask.meeting_link,
        status: "pending",
        source_task_id: sourceTask.id,
      })
      .onConflictDoNothing()
      .returning();

    const acceptedTask =
      clonedTask ??
      (
        await tx
          .select()
          .from(tasks)
          .where(and(eq(tasks.user_id, userId), eq(tasks.source_task_id, sourceTask.id)))
          .limit(1)
      )[0];

    if (!acceptedTask) {
      throw new Error("The task mention could not be accepted.");
    }

    const sourceParticipantRows = await tx
      .select({ participant_id: task_participants.participant_id })
      .from(task_participants)
      .where(eq(task_participants.task_id, sourceTask.id));

    const participantIds = [
      sourceTask.user_id,
      ...sourceParticipantRows.map((participant) => participant.participant_id),
    ].filter((participantId, index, collection) => participantId !== userId && collection.indexOf(participantId) === index);

    if (participantIds.length > 0) {
      await tx
        .insert(task_participants)
        .values(
          participantIds.map((participantId) => ({
            id: crypto.randomUUID(),
            participant_id: participantId,
            task_id: acceptedTask.id,
          })),
        )
        .onConflictDoNothing();
    }

    await tx
      .update(task_notifications)
      .set({
        status: "accepted",
        accepted_task_id: acceptedTask.id,
        read_at: notification.read_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .where(eq(task_notifications.id, notification.id));

    return {
      acceptedTask,
      result: {
        acceptedTaskId: acceptedTask.id,
        outcome: clonedTask ? ("accepted" as const) : ("already_accepted" as const),
        taskDate: acceptedTask.task_date,
      },
    };
  });

  if (result.acceptedTask) {
    await Promise.all([
      syncTaskRemindersForTask(userId, result.acceptedTask),
      syncAcceptedTaskSummary(userId, result.acceptedTask.task_date),
    ]);
  }

  return result.result;
}
