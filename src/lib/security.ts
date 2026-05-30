import "server-only";

import { NextResponse } from "next/server";

import { getAppBaseUrl } from "@/lib/env";

interface RateLimitOptions {
  keyPrefix: string;
  limit: number;
  windowMs: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

declare global {
  var __daystack_rate_limits: Map<string, RateLimitBucket> | undefined;
}

function getRateLimitStore() {
  globalThis.__daystack_rate_limits ??= new Map<string, RateLimitBucket>();
  return globalThis.__daystack_rate_limits;
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    forwardedFor ||
    "unknown"
  );
}

function cleanupExpiredBuckets(store: Map<string, RateLimitBucket>, now: number) {
  if (store.size < 500) {
    return;
  }

  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function rateLimitRequest(request: Request, options: RateLimitOptions) {
  const now = Date.now();
  const store = getRateLimitStore();
  const key = `${options.keyPrefix}:${getClientIp(request)}`;
  const current = store.get(key);

  cleanupExpiredBuckets(store, now);

  if (!current || current.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return null;
  }

  current.count += 1;

  if (current.count <= options.limit) {
    return null;
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));

  return NextResponse.json(
    {
      message: "Too many requests. Try again shortly.",
    },
    {
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
      status: 429,
    },
  );
}

export function requireSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return null;
  }

  const requestOrigin = new URL(request.url).origin;
  const configuredOrigin = new URL(getAppBaseUrl()).origin;
  const allowedOrigins = new Set([requestOrigin, configuredOrigin]);

  if (allowedOrigins.has(origin)) {
    return null;
  }

  return NextResponse.json(
    {
      message: "Cross-origin requests are not allowed.",
    },
    { status: 403 },
  );
}
