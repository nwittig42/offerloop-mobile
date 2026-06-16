import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { configureNotificationHandler } from '@/notifications/push';

/**
 * App-root push wiring. Configures the foreground handler and routes taps:
 * each push carries `data.url` (e.g. /outreach/{id} or /inbox), so tapping a
 * "they replied" notification opens the conversation. Also handles the
 * cold-start case where a tap launched the app. Token registration lives in the
 * store (it gates on permission + sign-in); this only handles display + taps.
 */
export function usePushNotifications() {
  const router = useRouter();

  useEffect(() => {
    configureNotificationHandler();

    const open = (data: any) => {
      const url = data?.url;
      if (typeof url === 'string' && url.startsWith('/')) {
        router.push(url as any);
      }
    };

    // Taps while the app is running / backgrounded.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      open(response.notification.request.content.data);
    });

    // Tap that cold-started the app.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) open(response.notification.request.content.data);
    });

    return () => sub.remove();
  }, [router]);
}
