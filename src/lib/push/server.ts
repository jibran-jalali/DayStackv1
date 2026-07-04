import "server-only";

import webPush from "web-push";

import { deletePushSubscriptionByEndpoint, fetchPushSubscriptionsForUser } from "@/lib/data/push-subscriptions";
import { buildReminderCopy } from "@/lib/data/reminders";
import { getAppBaseUrl } from "@/lib/env";
import { getWebPushEnv } from "@/lib/env";
import type { DueTaskReminder, PushSubscriptionRecord } from "@/types/daystack";

interface PushPayload {
  body: string;
  tag?: string;
  title: string;
  url: string;
}

let configuredVapidKey: string | null = null;

function configureWebPush() {
  const env = getWebPushEnv();

  if (!env) {
    return null;
  }

  if (configuredVapidKey !== env.publicKey) {
    webPush.setVapidDetails(env.subject, env.publicKey, env.privateKey);
    configuredVapidKey = env.publicKey;
  }

  return env;
}

function toWebPushSubscription(subscription: PushSubscriptionRecord) {
  return {
    endpoint: subscription.endpoint,
    keys: {
      auth: subscription.auth,
      p256dh: subscription.p256dh,
    },
  };
}

function isInvalidSubscriptionError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    body?: string;
    message?: string;
    statusCode?: number;
  };

  const statusCode = candidate.statusCode ?? null;
  const details = `${candidate.message ?? ""} ${candidate.body ?? ""}`.toLowerCase();

  return (
    statusCode === 404 ||
    statusCode === 410 ||
    (statusCode === 403 && details.includes("vapid credentials"))
  );
}

async function sendPushToSubscription(subscription: PushSubscriptionRecord, payload: PushPayload) {
  try {
    await webPush.sendNotification(
      toWebPushSubscription(subscription),
      JSON.stringify({
        ...payload,
        icon: "/icon.png",
        badge: "/apple-icon.png",
      }),
    );

    return "sent" as const;
  } catch (error) {
    if (isInvalidSubscriptionError(error)) {
      await deletePushSubscriptionByEndpoint(subscription.endpoint);
    }

    console.error(`DayStack push delivery failed for subscription ${subscription.id}:`, error);
    return "failed" as const;
  }
}

export async function sendUserPushNotification(userId: string, payload: PushPayload) {
  if (!configureWebPush()) {
    return {
      failed: 0,
      sent: 0,
      skipped: true,
    };
  }

  const subscriptions = await fetchPushSubscriptionsForUser(userId);

  if (subscriptions.length === 0) {
    return {
      failed: 0,
      sent: 0,
      skipped: true,
    };
  }

  const results = await Promise.all(subscriptions.map((subscription) => sendPushToSubscription(subscription, payload)));
  const sent = results.filter((result) => result === "sent").length;

  return {
    failed: results.length - sent,
    sent,
    skipped: false,
  };
}

export async function sendTaskReminderPush(dueReminder: DueTaskReminder) {
  const copy = buildReminderCopy(dueReminder.task, dueReminder.reminder.reminder_type, {
    emailLeadMinutes: dueReminder.preferences.email_reminder_lead_minutes,
  });
  const url = new URL("/app", getAppBaseUrl());
  url.searchParams.set("date", dueReminder.task.task_date);

  return sendUserPushNotification(dueReminder.reminder.user_id, {
    body: copy.body,
    tag: `task-reminder-${dueReminder.reminder.id}`,
    title: copy.title,
    url: url.toString(),
  });
}
