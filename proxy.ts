// proxy.ts
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const proxy = auth((request) => {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-watchlog-pathname", pathname);

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
