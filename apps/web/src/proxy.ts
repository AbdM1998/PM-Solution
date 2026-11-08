import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// SSR-convenience redirect only — presence of the short-lived readable cookie, not a
// verified JWT. Real authorization is enforced by apps/api on every request; this just
// avoids flashing a protected page before the client-side AuthProvider can check, and
// keeps a logged-in user off the auth pages.
const ACCESS_TOKEN_COOKIE = "pf_token";
const PUBLIC_PATHS = ["/login", "/register"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasToken = !!req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!hasToken && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (hasToken && isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)"],
};
