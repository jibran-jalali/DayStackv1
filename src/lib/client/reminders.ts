import type { UserNotificationPreferencesRecord } from "@/types/daystack";

import { requestJson } from "@/lib/client/request";

export async function updateNotificationPreferences(
  updates: Partial<
    Pick<
      UserNotificationPreferencesRecord,
      "push_enabled" | "remind_5_min_before" | "remind_at_start" | "remind_overdue"
    >
  >,
) {
  const payload = await requestJson<{ preferences: UserNotificationPreferencesRecord }>(
    "/api/notifications/preferences",
    {
      method: "PATCH",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(updates),
    },
    "Notification preference update failed.",
  );

  return payload.preferences;
}
