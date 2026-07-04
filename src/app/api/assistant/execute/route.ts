import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { executeAssistantAction } from "@/lib/assistant/server";
import { assistantExecuteRequestSchema } from "@/types/assistant";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before confirming an assistant action.",
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = assistantExecuteRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: parsed.error.flatten().formErrors[0] ?? "Assistant confirmation is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await executeAssistantAction(user.id, parsed.data.action, parsed.data.context);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Assistant action failed.",
      },
      { status: 500 },
    );
  }
}
