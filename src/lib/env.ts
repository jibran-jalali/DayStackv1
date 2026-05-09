export interface EmailServerEnv {
  appPassword: string;
  fromName: string;
  user: string;
}

export interface WebPushEnv {
  privateKey: string;
  publicKey: string;
  subject: string;
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

export function getEmailServerEnv(): EmailServerEnv | null {
  const user =
    normalizeEnvValue(process.env.GMAIL_SMTP_USER) ??
    normalizeEnvValue(process.env.EMAIL_SMTP_USER) ??
    normalizeEnvValue(process.env.EMAIL_FROM_ADDRESS);
  const rawPassword =
    normalizeEnvValue(process.env.GMAIL_SMTP_APP_PASSWORD) ??
    normalizeEnvValue(process.env.EMAIL_SMTP_PASSWORD);
  const appPassword = rawPassword?.replace(/\s+/g, "") ?? null;

  if (!user || !appPassword) {
    return null;
  }

  return {
    appPassword,
    fromName: normalizeEnvValue(process.env.EMAIL_FROM_NAME) ?? "DayStack",
    user,
  };
}

export function isEmailConfigured() {
  return Boolean(getEmailServerEnv());
}

export function getAppBaseUrl() {
  return normalizeEnvValue(process.env.NEXTAUTH_URL) ?? "http://localhost:3000";
}

export function getAppTimeZone() {
  return normalizeEnvValue(process.env.DAYSTACK_TIME_ZONE) ?? "Asia/Karachi";
}

export function getWebPushEnv(): WebPushEnv | null {
  const publicKey = normalizeEnvValue(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  const privateKey = normalizeEnvValue(process.env.VAPID_PRIVATE_KEY);
  const subject = normalizeEnvValue(process.env.VAPID_SUBJECT) ?? "mailto:admin@daystack.local";

  if (!publicKey || !privateKey) {
    return null;
  }

  return {
    privateKey,
    publicKey,
    subject,
  };
}

export function isWebPushConfigured() {
  return Boolean(getWebPushEnv());
}
