import "server-only";

import { NextResponse } from "next/server";

import { authenticateAutomationApiKey } from "@/lib/data/automation";

function getAutomationToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();

  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return request.headers.get("x-api-key")?.trim() ?? null;
}

function unauthorizedResponse(message: string) {
  return NextResponse.json(
    {
      message,
    },
    {
      headers: {
        "WWW-Authenticate": 'Bearer realm="DayStack API"',
      },
      status: 401,
    },
  );
}

export async function requireAutomationUser(request: Request) {
  const token = getAutomationToken(request);

  if (!token) {
    return {
      response: unauthorizedResponse("Provide a DayStack API key in the Authorization header."),
      user: null,
    };
  }

  const user = await authenticateAutomationApiKey(token);

  if (!user) {
    return {
      response: unauthorizedResponse("That DayStack API key is invalid or inactive."),
      user: null,
    };
  }

  return {
    response: null,
    user,
  };
}
