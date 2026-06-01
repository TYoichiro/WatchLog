import { auth } from "@/auth";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export const proxy = auth((request) => {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-watchlog-pathname", pathname);

  if (pathname.startsWith("/api/") && pathname !== "/api/onlive/poll") {
    const userId = request.auth?.user?.id;
    const ip =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const ua = request.headers.get("user-agent") ?? undefined;
    logger.info("APIリクエスト", {
      method: request.method,
      path: pathname,
      userId,
      ip,
      ua,
    });
  } else if (!process.env.VERCEL && !pathname.startsWith("/api/")) {
    logger.info("アクセス", {
      method: request.method,
      path: pathname,
    });
  }

  if (request.auth || pathname === "/" || pathname === "/maintenance" || pathname === "/banned") {
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
