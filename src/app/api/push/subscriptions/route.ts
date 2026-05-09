import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import { deletePushSubscription, savePushSubscription } from "@/lib/data/push-subscriptions";

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    auth: z.string().min(1),
    p256dh: z.string().min(1),
  }),
});

const deleteSubscriptionSchema = z.object({
  endpoint: z.string().url(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before enabling push reminders.",
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = pushSubscriptionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Push subscription is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const subscription = await savePushSubscription(user.id, {
      auth: parsed.data.keys.auth,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({
      subscription: {
        id: subscription.id,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Push subscription could not be saved.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before disabling push reminders.",
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = deleteSubscriptionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Push subscription endpoint is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    await deletePushSubscription(user.id, parsed.data.endpoint);

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Push subscription could not be removed.",
      },
      { status: 500 },
    );
  }
}
