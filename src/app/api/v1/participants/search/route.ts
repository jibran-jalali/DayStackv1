import { NextResponse } from "next/server";

import { requireAutomationUser } from "@/lib/automation-auth";
import { searchProfiles } from "@/lib/data/daystack";

export async function GET(request: Request) {
  const { response, user } = await requireAutomationUser(request);

  if (response || !user) {
    return response;
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "10", 10);

  try {
    const participants = await searchProfiles(query, {
      excludeUserId: user.id,
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 20) : 10,
    });

    return NextResponse.json({
      participants,
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
