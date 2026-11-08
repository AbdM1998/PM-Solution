/**
 * Cross-platform key/value storage for small secrets (the access token).
 *
 * `expo-secure-store` only supports Android/iOS (it is backed by Keychain/Keystore) —
 * it explicitly does not support web. Since this machine has no Android/iOS
 * device/emulator, `expo start --web` is the only way to smoke-test this app here, so
 * we need a web fallback. `localStorage` is NOT secure (no encryption, readable by any
 * script on the page) — it is used on web only as a dev-preview fallback, matching the
 * pattern Expo's own authentication guide recommends. The real target platforms
 * (Android/iOS) always use SecureStore.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // ignore (e.g. private browsing quota) — not the primary target platform
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // ignore
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
