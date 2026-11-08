"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClient, type User } from "@projectflow/shared";
import { getApiBaseUrl } from "./utils";
import { ACCESS_TOKEN_COOKIE, deleteCookie, getCookie, setCookie } from "./cookies";

// Access token TTL matches JWT_ACCESS_TTL in .env.example (15 minutes). The readable
// cookie is intentionally short-lived — it's a convenience for SSR redirects and page
// reloads, never the thing that actually authorizes a request (the Authorization
// header, read from memory, is what the API checks).
const ACCESS_TOKEN_COOKIE_MAX_AGE = 15 * 60;

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  api: ApiClient;
  user: User | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const tokenRef = useRef<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const clearAuth = useCallback(() => {
    tokenRef.current = null;
    deleteCookie(ACCESS_TOKEN_COOKIE);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const api = useMemo(
    () =>
      // `getAccessToken` is a lazy getter stored on the ApiClient instance and only
      // invoked later, from inside its `request()` method on an actual network call
      // (never read during this render) — this is exactly the "always read the latest
      // token" pattern `ApiClientOptions.getAccessToken` in packages/shared was
      // designed for.
      // eslint-disable-next-line react-hooks/refs
      new ApiClient({
        baseUrl: getApiBaseUrl(),
        getAccessToken: () => tokenRef.current,
        onUnauthorized: () => clearAuth(),
      }),
    [clearAuth]
  );

  useEffect(() => {
    const cookieToken = getCookie(ACCESS_TOKEN_COOKIE);
    if (!cookieToken) {
      // One-time session rehydration on mount (read the readable cookie, decide auth
      // state); there is no external subscription to attach this to instead.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("unauthenticated");
      return;
    }
    tokenRef.current = cookieToken;
    api
      .me()
      .then((u) => {
        setUser(u);
        setStatus("authenticated");
      })
      .catch(() => {
        clearAuth();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applySession = useCallback((accessToken: string, u: User) => {
    tokenRef.current = accessToken;
    setCookie(ACCESS_TOKEN_COOKIE, accessToken, ACCESS_TOKEN_COOKIE_MAX_AGE);
    setUser(u);
    setStatus("authenticated");
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { accessToken, user: u } = await api.login(email, password);
      applySession(accessToken, u);
    },
    [api, applySession]
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const { accessToken, user: u } = await api.register(email, password, name);
      applySession(accessToken, u);
    },
    [api, applySession]
  );

  const logout = useCallback(() => {
    api.logout().catch(() => {
      /* best-effort; still clear local session either way */
    });
    clearAuth();
    router.replace("/login");
  }, [api, clearAuth, router]);

  const value = useMemo(
    () => ({ api, user, status, login, register, logout }),
    [api, user, status, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Convenience hook for the shared ApiClient instance, used by all data hooks. */
export function useApi() {
  return useAuth().api;
}
