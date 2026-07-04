import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import { fetchFriendsSnapshot, sendFriendRequest } from "@/lib/data/friends";

const friendRequestSchema = z.object({
  addresseeId: z.string().uuid(),
});

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before loading friends.",
      },
      { status: 401 },
    );
  }

  try {
    const snapshot = await fetchFriendsSnapshot(user.id);

    return NextResponse.json({
      snapshot,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Friends could not be loaded.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before sending friend requests.",
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = friendRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Choose a valid user to add.",
      },
      { status: 400 },
    );
  }

  try {
    await sendFriendRequest(user.id, parsed.data.addresseeId);
    const snapshot = await fetchFriendsSnapshot(user.id);

    return NextResponse.json(
      {
        snapshot,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Friend request could not be sent.",
      },
      { status: 400 },
    );
  }
}
