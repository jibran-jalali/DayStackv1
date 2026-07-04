import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { fetchFriendsSnapshot, removeFriend } from "@/lib/data/friends";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ friendUserId: string }> },
) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before removing friends.",
      },
      { status: 401 },
    );
  }

  const { friendUserId } = await context.params;

  try {
    await removeFriend(user.id, friendUserId);
    const snapshot = await fetchFriendsSnapshot(user.id);

    return NextResponse.json({
      snapshot,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Friend could not be removed.",
      },
      { status: 400 },
    );
  }
}
