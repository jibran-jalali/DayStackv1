import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db/client";
import { user_notification_preferences, users } from "@/db/schema";
import { signupSchema } from "@/types/daystack";

export async function POST(request: Request) {
  const db = getDb();

  if (!db) {
    return NextResponse.json(
      {
        message: "Database is not configured.",
      },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: parsed.error.flatten().formErrors[0] ?? "Sign up details are invalid.",
      },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const fullName = parsed.data.fullName?.trim() || null;

  const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);

  if (existingUser) {
    return NextResponse.json(
      {
        message: "An account with this email already exists.",
      },
      { status: 409 },
    );
  }

  const userId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: userId,
      email,
      full_name: fullName,
      password_hash: passwordHash,
      status: "active",
      created_at: now,
      updated_at: now,
    });

    await tx.insert(user_notification_preferences).values({
      user_id: userId,
      push_enabled: false,
      remind_5_min_before: true,
      remind_at_start: true,
      remind_overdue: false,
      created_at: now,
      updated_at: now,
    });
  });

  return NextResponse.json(
    {
      ok: true,
    },
    { status: 201 },
  );
}
