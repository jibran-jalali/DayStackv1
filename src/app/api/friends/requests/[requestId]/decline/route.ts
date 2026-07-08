import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { declineFriendRequest, fetchFriendsSnapshot } from "@/lib/data/friends";
import { rateLimitRequest, rateLimiters } from "@/lib/security";

export async function POST(
  _request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  const rateLimitError = rateLimitRequest(_request, rateLimiters.friends);

  if (rateLimitError) {
    return rateLimitError;
  }

  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before declining friend requests.",
      },
      { status: 401 },
    );
  }

  const { requestId } = await context.params;

  try {
    await declineFriendRequest(user.id, requestId);
    const snapshot = await fetchFriendsSnapshot(user.id);

    return NextResponse.json({
      snapshot,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Friend request could not be declined.",
      },
      { status: 400 },
    );
  }
}
