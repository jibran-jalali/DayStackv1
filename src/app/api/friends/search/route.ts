import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { searchFriendCandidates } from "@/lib/data/friends";
import { rateLimitRequest, rateLimiters } from "@/lib/security";

const MAX_RESULTS = 8;

export async function GET(request: Request) {
  const rateLimitError = rateLimitRequest(request, rateLimiters.search);

  if (rateLimitError) {
    return rateLimitError;
  }

  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before searching friends.",
      },
      { status: 401 },
    );
  }

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() ?? "";
    const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") ?? "8", 10) || 8, 1), MAX_RESULTS);
    const results = await searchFriendCandidates(user.id, query, limit);

    return NextResponse.json({
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Friend search failed.",
      },
      { status: 500 },
    );
  }
}
