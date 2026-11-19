import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// 楽観的チェックのみ（cookie の有無）。本当の認可は各ページ・Server Action で requireUser() する。
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/board/:path*", "/projects/:path*", "/members/:path*", "/dashboard/:path*"],
};
