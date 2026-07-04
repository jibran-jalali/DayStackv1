import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, asc, desc, eq, gt, isNull, or } from "drizzle-orm";

import { getDb } from "@/db/client";
import { api_keys, users } from "@/db/schema";
import { isUserDisabled } from "@/lib/auth-status";
import type { ApiKeyRecord, AutomationApiKeySummary, UserRecord } from "@/types/daystack";

type DayStackDb = NonNullable<ReturnType<typeof getDb>>;

function getRequiredDb(): DayStackDb {
  const db = getDb();

  if (!db) {
    throw new Error("Database is not configured.");
  }

  return db;
}

function hashApiKeyToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createApiKeyToken() {
  const publicId = randomBytes(4).toString("hex");
  const secret = randomBytes(24).toString("hex");
  const token = `dsk_live_${publicId}_${secret}`;

  return {
    keyPrefix: `dsk_live_${publicId}`,
    token,
  };
}

function mapAutomationApiKeySummary(record: ApiKeyRecord): AutomationApiKeySummary {
  return {
    createdAt: record.created_at,
    expiresAt: record.expires_at,
    id: record.id,
    keyPrefix: record.key_prefix,
    label: record.label,
    lastUsedAt: record.last_used_at,
    revokedAt: record.revoked_at,
  };
}

export async function listAutomationApiKeys(userId: string): Promise<AutomationApiKeySummary[]> {
  const db = getRequiredDb();
  const rows = await db
    .select()
    .from(api_keys)
    .where(eq(api_keys.user_id, userId))
    .orderBy(desc(api_keys.created_at), asc(api_keys.label));

  return rows.map(mapAutomationApiKeySummary);
}

export async function createAutomationApiKey(userId: string, label: string) {
  const db = getRequiredDb();
  const now = new Date().toISOString();
  const normalizedLabel = label.trim();

  if (!normalizedLabel) {
    throw new Error("A label is required.");
  }

  const { keyPrefix, token } = createApiKeyToken();

  const [record] = await db
    .insert(api_keys)
    .values({
      id: crypto.randomUUID(),
      user_id: userId,
      label: normalizedLabel,
      key_prefix: keyPrefix,
      key_hash: hashApiKeyToken(token),
      created_at: now,
      updated_at: now,
    })
    .returning();

  return {
    apiKey: mapAutomationApiKeySummary(record),
    token,
  };
}

export async function revokeAutomationApiKey(userId: string, keyId: string) {
  const db = getRequiredDb();
  const now = new Date().toISOString();

  const [record] = await db
    .update(api_keys)
    .set({
      revoked_at: now,
      updated_at: now,
    })
    .where(and(eq(api_keys.id, keyId), eq(api_keys.user_id, userId), isNull(api_keys.revoked_at)))
    .returning();

  if (!record) {
    throw new Error("API key not found.");
  }

  return mapAutomationApiKeySummary(record);
}

export async function authenticateAutomationApiKey(token: string): Promise<UserRecord | null> {
  const db = getRequiredDb();
  const normalizedToken = token.trim();

  if (!normalizedToken) {
    return null;
  }

  const now = new Date().toISOString();
  const [match] = await db
    .select({
      apiKey: api_keys,
      user: users,
    })
    .from(api_keys)
    .innerJoin(users, eq(users.id, api_keys.user_id))
    .where(
      and(
        eq(api_keys.key_hash, hashApiKeyToken(normalizedToken)),
        isNull(api_keys.revoked_at),
        or(isNull(api_keys.expires_at), gt(api_keys.expires_at, now)),
      ),
    )
    .limit(1);

  if (!match || isUserDisabled(match.user)) {
    return null;
  }

  await db
    .update(api_keys)
    .set({
      last_used_at: now,
      updated_at: now,
    })
    .where(eq(api_keys.id, match.apiKey.id));

  return match.user;
}
