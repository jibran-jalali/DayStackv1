import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getDatabaseUrl } from "@/lib/env";
import * as schema from "@/db/schema";

function createDatabase(url: string) {
  const sql = postgres(url, {
    connect_timeout: 10,
    idle_timeout: 20,
    max: 1,
    prepare: false,
  });

  return {
    db: drizzle(sql, { schema }),
    sql,
    url,
  };
}

type DatabaseState = ReturnType<typeof createDatabase>;
type DatabaseClient = DatabaseState["db"];

function isDatabaseState(value: unknown): value is DatabaseState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<DatabaseState>;
  return Boolean(candidate.db && candidate.sql && candidate.url);
}

function isConnectTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    cause?: unknown;
    code?: string;
  };

  return candidate.code === "CONNECT_TIMEOUT" || isConnectTimeoutError(candidate.cause);
}

declare global {
  var __daystack_db: DatabaseClient | DatabaseState | null | undefined;
}

export function getDb() {
  const url = getDatabaseUrl();

  if (!url) {
    globalThis.__daystack_db = null;
    return null;
  }

  if (isDatabaseState(globalThis.__daystack_db) && globalThis.__daystack_db.url === url) {
    return globalThis.__daystack_db.db;
  }

  if (isDatabaseState(globalThis.__daystack_db)) {
    void globalThis.__daystack_db.sql.end({ timeout: 1 });
  }

  const database = createDatabase(url);
  globalThis.__daystack_db = database;

  return database.db;
}

export async function resetDb() {
  const existing = globalThis.__daystack_db;
  globalThis.__daystack_db = undefined;

  if (isDatabaseState(existing)) {
    await existing.sql.end({ timeout: 1 });
  }
}

export async function withDbReconnectRetry<T>(operation: (db: DatabaseClient) => Promise<T>) {
  const db = getDb();

  if (!db) {
    throw new Error("Database is not configured.");
  }

  try {
    return await operation(db);
  } catch (error) {
    if (!isConnectTimeoutError(error)) {
      throw error;
    }

    await resetDb();

    const freshDb = getDb();

    if (!freshDb) {
      throw error;
    }

    return operation(freshDb);
  }
}
