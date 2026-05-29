import "server-only";

import crypto from "node:crypto";

import { and, eq } from "drizzle-orm";
import { after } from "next/server";

import { getDb } from "@/db/client";
import { google_calendar_connections, task_calendar_events } from "@/db/schema";
import { getAppBaseUrl, getAppTimeZone, getGoogleCalendarEnv, isGoogleCalendarConfigured } from "@/lib/env";
import type { GoogleCalendarConnectionRecord, TaskRecord } from "@/types/daystack";

type DayStackDb = NonNullable<ReturnType<typeof getDb>>;

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events openid email";
const TOKEN_REFRESH_WINDOW_MS = 60_000;

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

interface GoogleUserInfoResponse {
  email?: string;
}

function getRequiredDb(): DayStackDb {
  const db = getDb();

  if (!db) {
    throw new Error("Database is not configured.");
  }

  return db;
}

function getEncryptionKey() {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (!secret?.trim()) {
    throw new Error("AUTH_SECRET is required before connecting Google Calendar.");
  }

  return crypto.createHash("sha256").update(secret).digest();
}

function encryptToken(token: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

function decryptToken(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");

  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("Google token storage is invalid.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function getRedirectUri() {
  return new URL("/api/calendar/google/callback", getAppBaseUrl()).toString();
}

function getTaskDateTime(taskDate: string, time: string) {
  return `${taskDate}T${time.length === 5 ? `${time}:00` : time}`;
}

function getTodayDateKeyInAppTimeZone(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: getAppTimeZone(),
    year: "numeric",
  }).formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function shouldSyncTaskToCalendar(task: Pick<TaskRecord, "task_date">) {
  return task.task_date >= getTodayDateKeyInAppTimeZone();
}

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = (await response.json().catch(() => null)) as (T & { error?: string; error_description?: string }) | null;

  if (!response.ok) {
    throw new Error(payload?.error_description ?? payload?.error ?? fallbackMessage);
  }

  return payload as T;
}

async function refreshGoogleAccessToken(connection: GoogleCalendarConnectionRecord) {
  const env = getGoogleCalendarEnv();

  if (!env) {
    throw new Error("Google Calendar is not configured.");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    body: new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      grant_type: "refresh_token",
      refresh_token: decryptToken(connection.refresh_token_encrypted),
    }),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
  const tokenResponse = await readJson<GoogleTokenResponse>(response, "Google token refresh failed.");
  const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString();
  const db = getRequiredDb();

  const [updatedConnection] = await db
    .update(google_calendar_connections)
    .set({
      access_token_encrypted: encryptToken(tokenResponse.access_token),
      access_token_expires_at: expiresAt,
      scope: tokenResponse.scope || connection.scope,
      updated_at: new Date().toISOString(),
    })
    .where(eq(google_calendar_connections.user_id, connection.user_id))
    .returning();

  return updatedConnection ?? {
    ...connection,
    access_token_encrypted: encryptToken(tokenResponse.access_token),
    access_token_expires_at: expiresAt,
    scope: tokenResponse.scope || connection.scope,
  };
}

async function getFreshGoogleAccessToken(connection: GoogleCalendarConnectionRecord) {
  const expiresAt = new Date(connection.access_token_expires_at).getTime();

  if (Number.isFinite(expiresAt) && expiresAt - Date.now() > TOKEN_REFRESH_WINDOW_MS) {
    return decryptToken(connection.access_token_encrypted);
  }

  const refreshedConnection = await refreshGoogleAccessToken(connection);

  return decryptToken(refreshedConnection.access_token_encrypted);
}

export function isGoogleCalendarReady() {
  return isGoogleCalendarConfigured();
}

export function buildGoogleCalendarAuthUrl(state: string) {
  const env = getGoogleCalendarEnv();

  if (!env) {
    throw new Error("Google Calendar is not configured.");
  }

  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", env.clientId);
  url.searchParams.set("redirect_uri", getRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  return url.toString();
}

export async function saveGoogleCalendarConnectionFromCode(userId: string, code: string) {
  const env = getGoogleCalendarEnv();

  if (!env) {
    throw new Error("Google Calendar is not configured.");
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    body: new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: getRedirectUri(),
    }),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
  const tokens = await readJson<GoogleTokenResponse>(tokenResponse, "Google Calendar connection failed.");

  if (!tokens.refresh_token) {
    throw new Error("Google did not return a refresh token. Remove DayStack from your Google account access and connect again.");
  }

  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      authorization: `Bearer ${tokens.access_token}`,
    },
  });
  const userInfo = await readJson<GoogleUserInfoResponse>(userInfoResponse, "Google profile lookup failed.");
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const db = getRequiredDb();

  await db
    .insert(google_calendar_connections)
    .values({
      user_id: userId,
      google_email: userInfo.email ?? null,
      calendar_id: "primary",
      access_token_encrypted: encryptToken(tokens.access_token),
      refresh_token_encrypted: encryptToken(tokens.refresh_token),
      access_token_expires_at: expiresAt,
      scope: tokens.scope,
      connected_at: now,
      created_at: now,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: google_calendar_connections.user_id,
      set: {
        google_email: userInfo.email ?? null,
        calendar_id: "primary",
        access_token_encrypted: encryptToken(tokens.access_token),
        refresh_token_encrypted: encryptToken(tokens.refresh_token),
        access_token_expires_at: expiresAt,
        scope: tokens.scope,
        connected_at: now,
        updated_at: now,
      },
    });
}

export async function getGoogleCalendarConnectionStatus(userId: string) {
  const db = getRequiredDb();
  const [connection] = await db
    .select({
      connectedAt: google_calendar_connections.connected_at,
      googleEmail: google_calendar_connections.google_email,
    })
    .from(google_calendar_connections)
    .where(eq(google_calendar_connections.user_id, userId))
    .limit(1);

  return {
    configured: isGoogleCalendarConfigured(),
    connected: Boolean(connection),
    connectedAt: connection?.connectedAt ?? null,
    googleEmail: connection?.googleEmail ?? null,
  };
}

export async function disconnectGoogleCalendar(userId: string) {
  const db = getRequiredDb();

  await Promise.all([
    db.delete(task_calendar_events).where(eq(task_calendar_events.user_id, userId)),
    db.delete(google_calendar_connections).where(eq(google_calendar_connections.user_id, userId)),
  ]);
}

async function fetchGoogleCalendarConnection(userId: string) {
  const db = getRequiredDb();
  const [connection] = await db
    .select()
    .from(google_calendar_connections)
    .where(eq(google_calendar_connections.user_id, userId))
    .limit(1);

  return connection ?? null;
}

async function fetchTaskCalendarEvent(userId: string, taskId: string) {
  const db = getRequiredDb();
  const [eventRow] = await db
    .select()
    .from(task_calendar_events)
    .where(and(eq(task_calendar_events.user_id, userId), eq(task_calendar_events.task_id, taskId)))
    .limit(1);

  return eventRow ?? null;
}

function buildGoogleCalendarEvent(task: TaskRecord) {
  const timeZone = getAppTimeZone();
  const meetingLink =
    task.task_type === "meeting" && task.meeting_link?.trim()
      ? task.meeting_link.trim()
      : null;
  const description = meetingLink
    ? `Synced from DayStack.\n\nMeeting link: ${meetingLink}`
    : "Synced from DayStack.";

  return {
    description,
    end: {
      dateTime: getTaskDateTime(task.task_date, task.end_time),
      timeZone,
    },
    extendedProperties: {
      private: {
        daystackTaskId: task.id,
      },
    },
    location: meetingLink ?? undefined,
    source: {
      title: "DayStack",
      url: new URL(`/app?date=${task.task_date}`, getAppBaseUrl()).toString(),
    },
    start: {
      dateTime: getTaskDateTime(task.task_date, task.start_time),
      timeZone,
    },
    summary: task.title,
  };
}

function runDeferredCalendarTask(task: () => Promise<void>) {
  const runner = () => {
    void task().catch((error) => {
      console.warn("[DayStack] Google Calendar background sync failed:", error);
    });
  };

  try {
    after(runner);
  } catch {
    setTimeout(runner, 0);
  }
}

async function googleCalendarFetch(
  connection: GoogleCalendarConnectionRecord,
  path: string,
  init?: RequestInit,
) {
  const accessToken = await getFreshGoogleAccessToken(connection);

  return fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...init?.headers,
    },
  });
}

export async function syncTaskToGoogleCalendar(userId: string, task: TaskRecord) {
  const connection = await fetchGoogleCalendarConnection(userId);

  if (!connection) {
    return;
  }

  if (!shouldSyncTaskToCalendar(task)) {
    await deleteGoogleCalendarEventForTask(userId, task.id);
    return;
  }

  const db = getRequiredDb();
  const existingEvent = await fetchTaskCalendarEvent(userId, task.id);
  const eventPayload = buildGoogleCalendarEvent(task);

  if (existingEvent) {
    const response = await googleCalendarFetch(
      connection,
      `/calendars/${encodeURIComponent(existingEvent.google_calendar_id)}/events/${encodeURIComponent(existingEvent.google_event_id)}`,
      {
        body: JSON.stringify(eventPayload),
        method: "PATCH",
      },
    );

    if (response.status === 404 || response.status === 410) {
      await db.delete(task_calendar_events).where(eq(task_calendar_events.id, existingEvent.id));
      await syncTaskToGoogleCalendar(userId, task);
      return;
    }

    await readJson<unknown>(response, "Google Calendar event update failed.");
    await db
      .update(task_calendar_events)
      .set({ updated_at: new Date().toISOString() })
      .where(eq(task_calendar_events.id, existingEvent.id));
    return;
  }

  const response = await googleCalendarFetch(
    connection,
    `/calendars/${encodeURIComponent(connection.calendar_id)}/events`,
    {
      body: JSON.stringify(eventPayload),
      method: "POST",
    },
  );
  const createdEvent = await readJson<{ id: string }>(response, "Google Calendar event creation failed.");
  const now = new Date().toISOString();

  await db
    .insert(task_calendar_events)
    .values({
      id: crypto.randomUUID(),
      user_id: userId,
      task_id: task.id,
      google_calendar_id: connection.calendar_id,
      google_event_id: createdEvent.id,
      created_at: now,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: task_calendar_events.task_id,
      set: {
        google_calendar_id: connection.calendar_id,
        google_event_id: createdEvent.id,
        updated_at: now,
      },
    });
}

export async function deleteGoogleCalendarEventForTask(userId: string, taskId: string) {
  const [connection, existingEvent] = await Promise.all([
    fetchGoogleCalendarConnection(userId),
    fetchTaskCalendarEvent(userId, taskId),
  ]);

  if (!existingEvent) {
    return;
  }

  const db = getRequiredDb();

  if (connection) {
    const response = await googleCalendarFetch(
      connection,
      `/calendars/${encodeURIComponent(existingEvent.google_calendar_id)}/events/${encodeURIComponent(existingEvent.google_event_id)}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok && response.status !== 404 && response.status !== 410) {
      await readJson<unknown>(response, "Google Calendar event deletion failed.");
    }
  }

  await db.delete(task_calendar_events).where(eq(task_calendar_events.id, existingEvent.id));
}

export async function safeSyncTaskToGoogleCalendar(userId: string, task: TaskRecord) {
  try {
    await syncTaskToGoogleCalendar(userId, task);
  } catch (error) {
    console.warn("[DayStack] Google Calendar task sync failed:", error);
  }
}

export async function safeDeleteGoogleCalendarEventForTask(userId: string, taskId: string) {
  try {
    await deleteGoogleCalendarEventForTask(userId, taskId);
  } catch (error) {
    console.warn("[DayStack] Google Calendar event deletion failed:", error);
  }
}

export function queueSyncTaskToGoogleCalendar(userId: string, task: TaskRecord) {
  if (!isGoogleCalendarConfigured()) {
    return;
  }

  runDeferredCalendarTask(() => syncTaskToGoogleCalendar(userId, task));
}
