import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { revokeAutomationApiKey } from "@/lib/data/automation";
import { rateLimitRequest, rateLimiters } from "@/lib/security";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ keyId: string }> },
) {
  const rateLimitError = rateLimitRequest(_request, rateLimiters.developer);

  if (rateLimitError) {
    return rateLimitError;
  }

  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before revoking an API key.",
      },
      { status: 401 },
    );
  }

  const { keyId } = await context.params;

  try {
    const apiKey = await revokeAutomationApiKey(user.id, keyId);

    return NextResponse.json({
      apiKey,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "The API key could not be revoked.",
      },
      { status: 500 },
    );
  }
}
