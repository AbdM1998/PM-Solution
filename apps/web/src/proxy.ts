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
  // "api" excluded: those requests are proxied straight through to the backend (see
  // next.config.js rewrites()) and must never be redirected to the login PAGE — the
  // backend itself enforces auth on every request, per the comment above. This only
  // started mattering once NEXT_PUBLIC_API_BASE_URL became a same-origin "/api" path
  // (previously the browser called the backend's own absolute origin directly, so
  // these requests never reached this middleware at all).
  // manifest.json / sw.js also excluded: PWA installability requires the browser
  // (and, on Android, Chrome's own installability checker) to fetch these
  // unauthenticated — found by actually loading the manifest and getting redirected
  // to /login instead, exactly the same class of bug as the "api" exclusion above.
  matcher: ["/((?!_next|api|manifest\\.json|sw\\.js|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)"],
};
