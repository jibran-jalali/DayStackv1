import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";

const ADMIN_SESSION_COOKIE = "__daystack_admin_session";
const ADMIN_SESSION_DURATION_MS = 1000 * 60 * 60 * 12;

interface AdminConfig {
  password: string;
  sessionSecret: string;
  username: string;
}

interface AdminSessionPayload {
  exp: number;
  sub: string;
  v: 1;
}

function getAdminConfig(): AdminConfig | null {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim();

  if (!username || !password) {
    return null;
  }

  const sessionSecret =
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    createHash("sha256").update(`${username}:${password}`).digest("hex");

  return {
    password,
    sessionSecret,
    username,
  };
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function hashForCompare(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

function safeCompare(left: string, right: string) {
  return timingSafeEqual(hashForCompare(left), hashForCompare(right));
}

function signPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function getCookieExpiry(expiresAt: number) {
  return new Date(expiresAt);
}

function createSessionToken(config: AdminConfig) {
  const payload: AdminSessionPayload = {
    exp: Date.now() + ADMIN_SESSION_DURATION_MS,
    sub: config.username,
    v: 1,
  };

  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, config.sessionSecret);

  return {
    expiresAt: payload.exp,
    value: `${encodedPayload}.${signature}`,
  };
}

function readSessionPayload(value: string | undefined | null, config: AdminConfig): AdminSessionPayload | null {
  if (!value) {
    return null;
  }

  const [encodedPayload, providedSignature] = value.split(".");

  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload, config.sessionSecret);

  if (!safeCompare(providedSignature, expectedSignature)) {
    return null;
  }

  try {
    const decoded = JSON.parse(decodeBase64Url(encodedPayload)) as Partial<AdminSessionPayload>;

    if (decoded.v !== 1 || decoded.sub !== config.username || typeof decoded.exp !== "number") {
      return null;
    }

    if (decoded.exp <= Date.now()) {
      return null;
    }

    return decoded as AdminSessionPayload;
  } catch {
    return null;
  }
}

export function isAdminConfigured() {
  return Boolean(getAdminConfig());
}

export async function isAdminAuthenticated() {
  const config = getAdminConfig();

  if (!config) {
    return false;
  }

  const cookieStore = await cookies();
  return Boolean(readSessionPayload(cookieStore.get(ADMIN_SESSION_COOKIE)?.value, config));
}

export async function redirectIfAdminAuthenticated() {
  if (await isAdminAuthenticated()) {
    redirect("/admin");
  }
}

export async function requireAdminAuthentication() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
}

export function validateAdminCredentials(username: string, password: string) {
  const config = getAdminConfig();

  if (!config) {
    return false;
  }

  return safeCompare(username.trim(), config.username) && safeCompare(password, config.password);
}

export function setAdminSessionCookie(response: NextResponse) {
  const config = getAdminConfig();

  if (!config) {
    throw new Error("Admin credentials are not configured.");
  }

  const session = createSessionToken(config);

  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: session.value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    expires: getCookieExpiry(session.expiresAt),
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    expires: new Date(0),
  });
}
