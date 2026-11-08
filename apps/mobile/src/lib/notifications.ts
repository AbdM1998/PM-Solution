/**
 * Local-notification + device-registration helpers (expo-notifications).
 *
 * IMPORTANT — read this before assuming notifications "just work":
 *
 * Per docs/REMINDER_ENGINE.md, the thing that actually survives the app being killed,
 * the phone rebooting, or days of being offline is the BACKEND worker + its
 * NotificationOutbox (In-App via Socket.io, Email via SMTP today; WhatsApp/Mobile Push
 * are scaffolded adapters waiting on real FCM/APNs/WhatsApp credentials per
 * docs/TECHNOLOGY_DECISIONS.md). That backend-delivered notification is the SOURCE OF
 * TRUTH for "did the user get reminded."
 *
 * Everything in this file is client-side sugar on top of that, not a replacement for
 * it:
 *  - `registerForPushNotificationsAsync` calls `POST /devices/register` so the backend
 *    *could* target this device once a real EAS project + FCM/APNs credentials exist.
 *    In this environment there is no linked EAS project (no `eas init`/login was run —
 *    no Expo account credentials exist here), so `getExpoPushTokenAsync` cannot
 *    produce a real push token; we detect that and skip registration rather than
 *    fabricate a fake token. This is the one piece that genuinely needs the
 *    "wired to real credentials" step called out in the task brief.
 *  - `confirmSnoozeLocally` fires an immediate local notification ("Snoozed to 6:00 PM")
 *    purely so the user gets instant on-device feedback that their tap registered. It
 *    is NOT scheduled for the future snooze time — the backend will (eventually) be
 *    the one to notify at that time over a real channel. Scheduling a second local
 *    notification for the same future instant would risk double-notifying once a real
 *    push channel is wired, so this intentionally only ever fires "now".
 */
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { DevicePlatform } from '@projectflow/shared';

import { apiClient } from '@/lib/api';

/** Route (e.g. "/project/abc123") a tapped notification should open. Stored in each
 * scheduled/received notification's `content.data.deepLink`. */
export type NotificationData = { deepLink?: string };

export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'ProjectFlow reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Requests notification permission, sets up the Android channel, and — only if this
 * build is linked to a real EAS project — registers an Expo push token with the
 * backend. Safe to call multiple times; never throws (notification access is a nice
 * to have, not something that should block the rest of the app).
 */
export async function registerForPushNotificationsAsync(): Promise<void> {
  try {
    await ensureAndroidChannel();

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      // Expected in this sandbox: no `eas init` has been run against a real Expo
      // account here. Document instead of faking a token — see README.
      console.warn(
        '[notifications] No EAS projectId configured — skipping push token registration. ' +
          'Run `eas init` (requires an Expo account) to enable real push tokens.',
      );
      return;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const platform: DevicePlatform = Platform.OS === 'ios' ? 'IOS' : Platform.OS === 'android' ? 'ANDROID' : 'WEB';
    await apiClient.registerDevice(platform, token);
  } catch (err) {
    console.warn('[notifications] registerForPushNotificationsAsync failed (non-fatal):', err);
  }
}

/** Immediate local notification confirming an action the user just took (e.g. a
 * snooze). See the file header for why this never schedules into the future. */
export async function confirmActionLocally(title: string, body: string, data?: NotificationData) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data },
      trigger: null,
    });
  } catch (err) {
    console.warn('[notifications] confirmActionLocally failed (non-fatal):', err);
  }
}
