import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { fetchDashboardSnapshot } from "@/lib/data/daystack";
import { isValidDateKey } from "@/lib/daystack";

export async function GET(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before loading the dashboard.",
      },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const taskDate = url.searchParams.get("date")?.trim() ?? "";

  if (!isValidDateKey(taskDate)) {
    return NextResponse.json(
      {
        message: "A valid date is required.",
      },
      { status: 400 },
    );
  }

  try {
    const snapshot = await fetchDashboardSnapshot(user.id, taskDate);

    return NextResponse.json({
      snapshot,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Dashboard load failed.",
      },
      { status: 500 },
    );
  }
}
