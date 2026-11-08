import { useEffect } from 'react';
import { useRouter, type Href } from 'expo-router';
import * as Notifications from 'expo-notifications';

import type { NotificationData } from '@/lib/notifications';

/**
 * Drives in-app navigation when the user taps a notification (local, or — once real
 * push credentials exist — a remote one from the backend). Deep links opened directly
 * from the OS (e.g. `projectflow://project/abc`) are handled automatically by Expo
 * Router's file-based routing (see src/app/project/[id].tsx, src/app/task/[id].tsx) and
 * don't need any code here; this hook only covers the notification-tap path, where the
 * target route travels as `content.data.deepLink` instead of a URL.
 */
export function useNotificationRouter() {
  const router = useRouter();

  useEffect(() => {
    // Cold start: app was launched by tapping a notification.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const data = response?.notification.request.content.data as NotificationData | undefined;
      if (data?.deepLink) {
        // A runtime string path can't be checked against the generated typed-routes
        // literal union at compile time, hence the cast.
        router.push(data.deepLink as Href);
      }
    });

    // Warm: app was already running/backgrounded when the notification was tapped.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as NotificationData | undefined;
      if (data?.deepLink) {
        router.push(data.deepLink as Href);
      }
    });

    return () => subscription.remove();
  }, [router]);
}
