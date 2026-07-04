import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import { createAutomationApiKey, listAutomationApiKeys } from "@/lib/data/automation";

const createApiKeySchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Add a label for this API key.")
    .max(80, "Keep the label under 80 characters."),
});

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before managing API keys.",
      },
      { status: 401 },
    );
  }

  try {
    const apiKeys = await listAutomationApiKeys(user.id);

    return NextResponse.json({
      apiKeys,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "API keys could not be loaded.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Sign in before creating an API key.",
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createApiKeySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: parsed.error.flatten().formErrors[0] ?? "A valid API key label is required.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await createAutomationApiKey(user.id, parsed.data.label);

    return NextResponse.json(
      {
        apiKey: result.apiKey,
        token: result.token,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "The API key could not be created.",
      },
      { status: 500 },
    );
  }
}
