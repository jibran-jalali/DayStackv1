import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { saveGoogleCalendarConnectionFromCode } from "@/lib/data/google-calendar";

const GOOGLE_OAUTH_STATE_COOKIE = "daystack_google_oauth_state";

function buildSettingsRedirect(request: Request, status: "connected" | "error", message?: string) {
  const url = new URL("/app", request.url);
  url.searchParams.set("tab", "settings");
  url.searchParams.set("calendar", status);

  if (message) {
    url.searchParams.set("message", message);
  }

  return url;
}

export async function GET(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.redirect(buildSettingsRedirect(request, "error", "Sign in before connecting Google Calendar."));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const savedState = request.headers
    .get("cookie")
    ?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${GOOGLE_OAUTH_STATE_COOKIE}=`))
    ?.split("=")[1];

  if (error) {
    return NextResponse.redirect(buildSettingsRedirect(request, "error", "Google Calendar connection was cancelled."));
  }

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(buildSettingsRedirect(request, "error", "Google Calendar connection expired. Try again."));
  }

  try {
    await saveGoogleCalendarConnectionFromCode(user.id, code);

    const response = NextResponse.redirect(buildSettingsRedirect(request, "connected"));
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    return response;
  } catch (connectionError) {
    const response = NextResponse.redirect(
      buildSettingsRedirect(
        request,
        "error",
        connectionError instanceof Error ? connectionError.message : "Google Calendar connection failed.",
      ),
    );
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    return response;
  }
}
