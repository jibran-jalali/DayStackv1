import { NextResponse } from "next/server";

import { requireAutomationUser } from "@/lib/automation-auth";

export async function GET(request: Request) {
  const { response, user } = await requireAutomationUser(request);

  if (response || !user) {
    return response;
  }

  return NextResponse.json({
    user: {
      email: user.email,
      fullName: user.full_name,
      id: user.id,
      status: user.status,
    },
  });
}
