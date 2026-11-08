// Small client-side cookie helpers for the readable (non-httpOnly) access-token cookie.
// The real refresh token lives in a server-set httpOnly cookie (backend's job) — this
// cookie exists only so (a) Next.js middleware can decide server-side whether to
// redirect to /login, and (b) the client can rehydrate its in-memory token after a
// full page reload without a network round trip.

export const ACCESS_TOKEN_COOKIE = "pf_token";

export function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}
