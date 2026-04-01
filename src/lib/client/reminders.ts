import type { UserNotificationPreferencesRecord } from "@/types/daystack";

import { requestJson } from "@/lib/client/request";

export async function updateNotificationPreferences(
  updates: Partial<
    Pick<
      UserNotificationPreferencesRecord,
      | "email_enabled"
      | "meeting_mention_email_enabled"
      | "email_reminder_lead_minutes"
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
