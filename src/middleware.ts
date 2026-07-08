import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

import { isAuthConfigured, isDatabaseConfigured } from "@/lib/env";

function clearAuthCookies(response: NextResponse) {
  response.cookies.delete("next-auth.session-token");
  response.cookies.delete("__Secure-next-auth.session-token");
  response.cookies.delete("next-auth.csrf-token");
  response.cookies.delete("__Host-next-auth.csrf-token");
  response.cookies.delete("next-auth.callback-url");
  response.cookies.delete("__Secure-next-auth.callback-url");
}

function isJwtDecodeError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    code?: string;
    message?: string;
    name?: string;
  };

  const message = candidate.message?.toLowerCase() ?? "";

  return (
    candidate.code === "JWT_SESSION_ERROR" ||
    candidate.name === "JWTSessionError" ||
    message.includes("decryption operation failed") ||
    message.includes("jwt_session_error")
  );
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const pathname = request.nextUrl.pathname;

  if (!isDatabaseConfigured() || !isAuthConfigured()) {
    return response;
  }

  let token = null;

  try {
    token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
    });
  } catch (error) {
    if (!isJwtDecodeError(error)) {
      throw error;
    }

    if (pathname.startsWith("/app")) {
      const redirectResponse = NextResponse.redirect(new URL("/login", request.url));
      clearAuthCookies(redirectResponse);
      return redirectResponse;
    }

    clearAuthCookies(response);
    return response;
  }

  if (pathname.startsWith("/app") && !token?.sub) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if ((pathname === "/login" || pathname === "/signup") && token?.sub) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
