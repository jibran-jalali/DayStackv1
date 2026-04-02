import { NextResponse } from "next/server";

import { requireAutomationUser } from "@/lib/automation-auth";
import { fetchDashboardSnapshot } from "@/lib/data/daystack";
import { isValidDateKey } from "@/lib/daystack";

export async function GET(request: Request) {
  const { response, user } = await requireAutomationUser(request);

  if (response || !user) {
    return response;
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
