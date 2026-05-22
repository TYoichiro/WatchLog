// proxy.ts
import { auth } from "@/auth";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export const proxy = auth((request) => {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-watchlog-pathname", pathname);

  if (pathname.startsWith("/api/")) {
    const userId = request.auth?.user?.id;
    const ip =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const ua = request.headers.get("user-agent") ?? undefined;
    logger.info("API request", {
      method: request.method,
      path: pathname,
      userId,
      ip,
      ua,
    });
  }

  if (request.auth || pathname === "/" || pathname === "/maintenance") {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.redirect(new URL("/", request.nextUrl));
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
