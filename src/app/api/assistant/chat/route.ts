import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { generateAssistantResponse } from "@/lib/assistant/server";
import { assistantChatRequestSchema } from "@/types/assistant";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before using DayStack Assistant.",
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = assistantChatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: parsed.error.flatten().formErrors[0] ?? "Assistant request is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await generateAssistantResponse(parsed.data, user);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assistant request failed.";
    return NextResponse.json(
      {
        message,
      },
      { status: message.includes("not configured") ? 503 : 500 },
    );
  }
}
