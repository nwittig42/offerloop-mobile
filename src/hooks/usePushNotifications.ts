import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { qk } from '@/api/queryKeys';
import { configureNotificationHandler } from '@/notifications/push';

/**
 * App-root push wiring. Configures the foreground handler and routes taps:
 * each push carries `data.url` (e.g. /outreach/{id} or /inbox), so tapping a
 * "they replied" notification opens the conversation. Also handles the
 * cold-start case where a tap launched the app. Token registration lives in the
 * store (it gates on permission + sign-in); this only handles display + taps.
 *
 * A push is also a data signal: the server just told us something changed
 * (draft ready, reply landed, loop ran). Refetch the affected queries right
 * away so the app reflects it in seconds instead of at the next 60s poll.
 */
export function usePushNotifications() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Push is native only. The browser preview (npx expo start --web, used for
    // fast layout iteration) has no ExpoNotifications module, and calling into
    // it throws at app root, which blanks the whole preview.
    if (Platform.OS === 'web') return;

    configureNotificationHandler();

    const refreshFromPush = () => {
      queryClient.invalidateQueries({ queryKey: qk.inbox });
      queryClient.invalidateQueries({ queryKey: qk.notifications });
      // Loop-cycle pushes carry new counters; auto-apply pushes change the
      // applications list. Cheap to refresh both on any push.
      queryClient.invalidateQueries({ queryKey: qk.loops });
      queryClient.invalidateQueries({ queryKey: ['appliedJobs'] });
    };

    const open = (data: any) => {
      const url = data?.url;
      if (typeof url === 'string' && url.startsWith('/')) {
        router.push(url as any);
      }
    };

    // Push received while the app is foregrounded — refresh, don't navigate.
    const received = Notifications.addNotificationReceivedListener(() => {
      refreshFromPush();
    });

    // Taps while the app is running / backgrounded.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      refreshFromPush();
      open(response.notification.request.content.data);
    });

    // Tap that cold-started the app.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) open(response.notification.request.content.data);
    });

    return () => {
      received.remove();
      sub.remove();
    };
  }, [router, queryClient]);
}
