/**
 * Single shared ApiClient instance (from @projectflow/shared) wired to this app's
 * runtime config. Every screen/hook imports `apiClient` from here instead of
 * constructing its own client or calling `fetch` directly, per the contract rule:
 * "Import ApiClient and the types from @projectflow/shared... don't ... write your
 * own fetch client."
 *
 * The access token lives in AuthContext (backed by SecureStore), not here — this
 * module just exposes a mutable ref the AuthProvider updates, so `ApiClient`'s
 * synchronous `getAccessToken()` always sees the latest value without the two modules
 * needing to depend on each other in a cycle.
 */
import { ApiClient } from '@projectflow/shared';

// Expo exposes EXPO_PUBLIC_* env vars to client code automatically (no extra config).
// Falls back to the documented local default from .env.example if unset, so the app
// still boots (pointed at an unreachable local API) rather than crashing on import.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api';

const tokenRef: { current: string | null } = { current: null };

export function setApiAccessToken(token: string | null) {
  tokenRef.current = token;
}

export function getApiAccessToken() {
  return tokenRef.current;
}

// Set by AuthProvider; called whenever the server responds 401 so the app can clear
// the session and route back to the login screen. Kept as a mutable hook (rather than
// an event emitter dependency) to keep this file dependency-free.
let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export const apiClient = new ApiClient({
  baseUrl: API_BASE_URL,
  getAccessToken: () => tokenRef.current,
  onUnauthorized: () => unauthorizedHandler?.(),
});
