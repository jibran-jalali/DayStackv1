import type { PlannerNotification, TaskNotificationAcceptResult } from "@/types/daystack";

import { requestJson } from "@/lib/client/request";

export async function fetchTaskNotifications(limit = 10): Promise<PlannerNotification[]> {
  const searchParams = new URLSearchParams({
    limit: `${limit}`,
  });
  const payload = await requestJson<{ notifications: PlannerNotification[] }>(
    `/api/notifications?${searchParams.toString()}`,
    {
      method: "GET",
      credentials: "same-origin",
    },
    "Notification load failed.",
  );

  return payload.notifications;
}

export async function markTaskNotificationsRead(notificationIds: string[]) {
  const payload = await requestJson<{ count: number }>(
    "/api/notifications/read",
    {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        notificationIds,
      }),
    },
    "Notification update failed.",
  );

  return payload.count;
}

export async function acceptTaskNotification(
  notificationId: string,
): Promise<TaskNotificationAcceptResult> {
  const payload = await requestJson<{ result: TaskNotificationAcceptResult }>(
    `/api/notifications/${notificationId}/accept`,
    {
      method: "POST",
      credentials: "same-origin",
    },
    "Notification accept failed.",
  );

  return payload.result;
}
