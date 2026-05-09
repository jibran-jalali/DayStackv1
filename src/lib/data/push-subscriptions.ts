import "server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { push_subscriptions } from "@/db/schema";
import type { PushSubscriptionRecord } from "@/types/daystack";

type DayStackDb = NonNullable<ReturnType<typeof getDb>>;

export interface PushSubscriptionInput {
  auth: string;
  endpoint: string;
  p256dh: string;
  userAgent?: string | null;
}

function getRequiredDb(): DayStackDb {
  const db = getDb();

  if (!db) {
    throw new Error("Database is not configured.");
  }

  return db;
}

export async function savePushSubscription(userId: string, input: PushSubscriptionInput) {
  const db = getRequiredDb();
  const now = new Date().toISOString();

  const [subscription] = await db
    .insert(push_subscriptions)
    .values({
      id: crypto.randomUUID(),
      user_id: userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent ?? null,
      last_seen_at: now,
      created_at: now,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: push_subscriptions.endpoint,
      set: {
        auth: input.auth,
        p256dh: input.p256dh,
        user_agent: input.userAgent ?? null,
        user_id: userId,
        last_seen_at: now,
        updated_at: now,
      },
    })
    .returning();

  return subscription;
}

export async function deletePushSubscription(userId: string, endpoint: string) {
  const db = getRequiredDb();

  await db
    .delete(push_subscriptions)
    .where(and(eq(push_subscriptions.user_id, userId), eq(push_subscriptions.endpoint, endpoint)));
}

export async function deletePushSubscriptionByEndpoint(endpoint: string) {
  const db = getRequiredDb();

  await db.delete(push_subscriptions).where(eq(push_subscriptions.endpoint, endpoint));
}

export async function fetchPushSubscriptionsForUser(userId: string): Promise<PushSubscriptionRecord[]> {
  const db = getRequiredDb();

  return db.select().from(push_subscriptions).where(eq(push_subscriptions.user_id, userId));
}
