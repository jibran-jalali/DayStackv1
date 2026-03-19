import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { searchProfiles } from "@/lib/data/daystack";

const MAX_RESULTS = 8;

export async function GET(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "You must be signed in to search participants.",
      },
      { status: 401 },
    );
  }

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") ?? "6", 10) || 6, 1), MAX_RESULTS);
    const results = await searchProfiles(query, {
      excludeUserId: user.id,
      limit,
    });

    return NextResponse.json({
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Participant search failed.",
      },
      { status: 500 },
    );
  }
}
