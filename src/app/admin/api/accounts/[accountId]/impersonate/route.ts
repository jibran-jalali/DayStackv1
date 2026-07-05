import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";

import { fetchAdminAccountById } from "@/lib/admin/data";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { getErrorMessage } from "@/lib/utils";

const IMPERSONATION_SESSION_MAX_AGE_SECONDS = 60 * 60 * 4;

function unauthorizedResponse() {
  return NextResponse.json(
    {
      message: "Admin authentication required.",
    },
    { status: 401 },
  );
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getAuthSecret() {
  return process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
}

function shouldUseSecureCookie(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProto || new URL(request.url).protocol.replace(":", "");

  return process.env.NODE_ENV === "production" || protocol === "https";
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      accountId: string;
    }>;
  },
) {
  if (!(await isAdminAuthenticated())) {
    return unauthorizedResponse();
  }

  const { accountId } = await context.params;

  if (!isValidUuid(accountId)) {
    return NextResponse.json(
      {
        message: "Invalid account id.",
      },
      { status: 400 },
    );
  }

  const secret = getAuthSecret();

  if (!secret) {
    return NextResponse.json(
      {
        message: "AUTH_SECRET or NEXTAUTH_SECRET is required for impersonation.",
      },
      { status: 500 },
    );
  }

  try {
    const account = await fetchAdminAccountById(accountId);

    if (account.status === "disabled") {
      return NextResponse.json(
        {
          message: "Reactivate this account before opening it.",
        },
        { status: 409 },
      );
    }

    const secureCookie = shouldUseSecureCookie(request);
    const cookieName = secureCookie ? "__Secure-next-auth.session-token" : "next-auth.session-token";
    const oppositeCookieName = secureCookie ? "next-auth.session-token" : "__Secure-next-auth.session-token";
    const sessionToken = await encode({
      maxAge: IMPERSONATION_SESSION_MAX_AGE_SECONDS,
      secret,
      token: {
        email: account.email,
        name: account.name,
        status: account.status,
        sub: account.id,
      },
    });
    const response = NextResponse.redirect(new URL("/app", request.url));

    response.cookies.set({
      httpOnly: true,
      maxAge: IMPERSONATION_SESSION_MAX_AGE_SECONDS,
      name: cookieName,
      path: "/",
      sameSite: "lax",
      secure: secureCookie,
      value: sessionToken,
    });
    response.cookies.set({
      expires: new Date(0),
      httpOnly: true,
      name: oppositeCookieName,
      path: "/",
      sameSite: "lax",
      secure: !secureCookie,
      value: "",
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        message: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
