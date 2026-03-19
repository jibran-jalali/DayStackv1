export interface OneSignalEnv {
  appId: string;
}

function normalizeEnvValue(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).trim() || null;
  }

  return trimmed;
}

export function getDatabaseUrl() {
  const pooled =
    normalizeEnvValue(process.env.POSTGRES_URL) ?? normalizeEnvValue(process.env.DATABASE_URL);
  const direct =
    normalizeEnvValue(process.env.POSTGRES_URL_NON_POOLING) ??
    normalizeEnvValue(process.env.DATABASE_URL_UNPOOLED);

  if (process.env.NODE_ENV === "development") {
    return direct ?? pooled;
  }

  return pooled ?? direct;
}

export function getDatabaseMigrationUrl() {
  return (
    normalizeEnvValue(process.env.POSTGRES_URL_NON_POOLING) ??
    normalizeEnvValue(process.env.DATABASE_URL_UNPOOLED) ??
    getDatabaseUrl()
  );
}

export function isDatabaseConfigured() {
  return Boolean(getDatabaseUrl());
}

export function isAuthConfigured() {
  return Boolean(process.env.AUTH_SECRET?.trim());
}

export function getOneSignalEnv(): OneSignalEnv | null {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID?.trim();

  if (!appId) {
    return null;
  }

  return {
    appId,
  };
}

export function isOneSignalConfigured() {
  return Boolean(getOneSignalEnv());
}
