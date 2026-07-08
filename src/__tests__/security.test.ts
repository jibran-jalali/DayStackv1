import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock server-only since vitest runs in Node
vi.mock("server-only", () => ({}));

import { rateLimitRequest, rateLimiters } from "@/lib/security";

function createRequest(ip?: string) {
  const headers = new Headers();
  if (ip) {
    headers.set("x-forwarded-for", ip);
  }
  return new Request("http://localhost/api/test", { headers });
}

describe("rateLimitRequest", () => {
  beforeEach(() => {
    // Reset the global store
    globalThis.__daystack_rate_limits = undefined;
  });

  it("allows first request", () => {
    const response = rateLimitRequest(createRequest("1.2.3.4"), {
      keyPrefix: "test",
      limit: 5,
      windowMs: 60_000,
    });
    expect(response).toBeNull();
  });

  it("blocks after limit exceeded", () => {
    const opts = { keyPrefix: "test-block", limit: 3, windowMs: 60_000 };
    const ip = "5.6.7.8";

    rateLimitRequest(createRequest(ip), opts);
    rateLimitRequest(createRequest(ip), opts);
    rateLimitRequest(createRequest(ip), opts);

    const blocked = rateLimitRequest(createRequest(ip), opts);
    expect(blocked).not.toBeNull();
    expect(blocked?.status).toBe(429);
  });

  it("returns Retry-After header", () => {
    const opts = { keyPrefix: "test-retry", limit: 1, windowMs: 60_000 };
    const ip = "9.10.11.12";

    rateLimitRequest(createRequest(ip), opts);
    const response = rateLimitRequest(createRequest(ip), opts);

    expect(response).not.toBeNull();
    expect(response?.headers.get("Retry-After")).toBeDefined();
  });

  it("tracks different IPs separately", () => {
    const opts = { keyPrefix: "test-separate", limit: 1, windowMs: 60_000 };

    rateLimitRequest(createRequest("1.1.1.1"), opts);
    const blocked = rateLimitRequest(createRequest("2.2.2.2"), opts);

    expect(blocked).toBeNull();
  });

  it("tracks different key prefixes separately", () => {
    const ip = "3.3.3.3";
    const optsA = { keyPrefix: "prefixA", limit: 1, windowMs: 60_000 };
    const optsB = { keyPrefix: "prefixB", limit: 1, windowMs: 60_000 };

    rateLimitRequest(createRequest(ip), optsA);
    const blocked = rateLimitRequest(createRequest(ip), optsB);

    expect(blocked).toBeNull();
  });

  it("rate limiters has all required keys", () => {
    expect(rateLimiters).toHaveProperty("tasks");
    expect(rateLimiters).toHaveProperty("friends");
    expect(rateLimiters).toHaveProperty("search");
    expect(rateLimiters).toHaveProperty("notifications");
    expect(rateLimiters).toHaveProperty("push");
    expect(rateLimiters).toHaveProperty("calendar");
    expect(rateLimiters).toHaveProperty("developer");
    expect(rateLimiters).toHaveProperty("assistant");
    expect(rateLimiters).toHaveProperty("recurring");
    expect(rateLimiters).toHaveProperty("reminders");
  });
});
