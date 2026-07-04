import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { buildGoogleCalendarAuthUrl } from "@/lib/data/google-calendar";

const GOOGLE_OAUTH_STATE_COOKIE = "daystack_google_oauth_state";

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in before connecting Google Calendar." }, { status: 401 });
  }

  try {
    const state = crypto.randomBytes(24).toString("base64url");
    const response = NextResponse.redirect(buildGoogleCalendarAuthUrl(state));

    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      maxAge: 10 * 60,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Google Calendar connection could not start.",
      },
      { status: 500 },
    );
  }
}
