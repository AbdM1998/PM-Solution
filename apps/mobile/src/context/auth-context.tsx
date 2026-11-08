import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, type User } from '@projectflow/shared';

import { apiClient, setApiAccessToken, setUnauthorizedHandler } from '@/lib/api';
import { deleteSecureItem, getSecureItem, setSecureItem } from '@/lib/secure-storage';

const ACCESS_TOKEN_KEY = 'projectflow.accessToken';
const USER_CACHE_KEY = 'projectflow.user';

type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  /** Set when bootstrapping from a cached token failed because the API was
   * unreachable (not because the token was rejected) — surfaced so the UI can tell
   * "you're offline" apart from "please log in". */
  bootstrapError: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null, bootstrapError: null });
  // Avoids a stale-closure race if the unauthorized handler fires during bootstrap.
  const statusRef = useRef<AuthStatus>('loading');
  statusRef.current = state.status;

  useEffect(() => {
    setUnauthorizedHandler(() => {
      // The access token (15 min TTL per docs/API_DESIGN.md) was rejected. This app
      // does not implement silent refresh on mobile yet — see README "Known
      // limitations" for why — so the honest behavior is to sign the user out rather
      // than pretend the session is still valid.
      setApiAccessToken(null);
      void deleteSecureItem(ACCESS_TOKEN_KEY);
      void deleteSecureItem(USER_CACHE_KEY);
      setState({ status: 'signedOut', user: null, bootstrapError: null });
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    bootstrap();
    async function bootstrap() {
      const token = await getSecureItem(ACCESS_TOKEN_KEY);
      if (!token) {
        setState({ status: 'signedOut', user: null, bootstrapError: null });
        return;
      }
      setApiAccessToken(token);
      try {
        const user = await apiClient.me();
        await setSecureItem(USER_CACHE_KEY, JSON.stringify(user));
        setState({ status: 'signedIn', user, bootstrapError: null });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setApiAccessToken(null);
          await deleteSecureItem(ACCESS_TOKEN_KEY);
          await deleteSecureItem(USER_CACHE_KEY);
          setState({ status: 'signedOut', user: null, bootstrapError: null });
          return;
        }
        // Network error / API unreachable (very likely during development, since
        // apps/api is built independently). Fall back to the cached user so the app
        // stays usable offline-first instead of forcing a re-login just because the
        // backend happens to be down right now.
        const cached = await getSecureItem(USER_CACHE_KEY);
        if (cached) {
          setState({ status: 'signedIn', user: JSON.parse(cached) as User, bootstrapError: 'offline' });
        } else {
          setState({ status: 'signedOut', user: null, bootstrapError: 'offline' });
        }
      }
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      async login(email, password) {
        const { accessToken, user } = await apiClient.login(email, password);
        setApiAccessToken(accessToken);
        await setSecureItem(ACCESS_TOKEN_KEY, accessToken);
        await setSecureItem(USER_CACHE_KEY, JSON.stringify(user));
        setState({ status: 'signedIn', user, bootstrapError: null });
      },
      async register(email, password, name) {
        const { accessToken, user } = await apiClient.register(email, password, name);
        setApiAccessToken(accessToken);
        await setSecureItem(ACCESS_TOKEN_KEY, accessToken);
        await setSecureItem(USER_CACHE_KEY, JSON.stringify(user));
        setState({ status: 'signedIn', user, bootstrapError: null });
      },
      async logout() {
        try {
          await apiClient.logout();
        } catch {
          // best-effort: still clear the local session even if the API is unreachable
        }
        setApiAccessToken(null);
        await deleteSecureItem(ACCESS_TOKEN_KEY);
        await deleteSecureItem(USER_CACHE_KEY);
        setState({ status: 'signedOut', user: null, bootstrapError: null });
      },
    }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
