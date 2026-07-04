import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { acceptFriendRequest, fetchFriendsSnapshot } from "@/lib/data/friends";

export async function POST(
  _request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before accepting friend requests.",
      },
      { status: 401 },
    );
  }

  const { requestId } = await context.params;

  try {
    await acceptFriendRequest(user.id, requestId);
    const snapshot = await fetchFriendsSnapshot(user.id);

    return NextResponse.json({
      snapshot,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Friend request could not be accepted.",
      },
      { status: 400 },
    );
  }
}
