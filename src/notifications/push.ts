import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerDevice } from '@/api/endpoints/device';

/**
 * Push notifications (Expo). The backend pushes when a recruiter replies (and,
 * later, when a Loop draft is ready); this module owns the device side: show
 * notifications in the foreground, ask permission, get the Expo push token, and
 * hand it to the backend. Degrades gracefully with no EAS projectId configured
 * (pre-WS6): permission still works, we just can't mint a token yet — so this
 * never throws into the UI.
 */

let handlerConfigured = false;

/** Show banners + play sound even when the app is foregrounded. Idempotent. */
export function configureNotificationHandler(): void {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function projectId(): string | undefined {
  const id =
    Constants.expoConfig?.extra?.eas?.projectId ||
    (Constants as any).easConfig?.projectId;
  return id && String(id).length > 0 ? String(id) : undefined;
}

export type RegisterResult = { granted: boolean; token?: string };

/**
 * Ask for permission (if needed) and register the Expo push token with the
 * backend. Returns whether permission was granted; `token` is set only when we
 * actually obtained and sent one. Safe to call repeatedly.
 */
export async function registerForPushNotificationsAsync(): Promise<RegisterResult> {
  // Simulators/emulators can't receive a real push token.
  if (!Device.isDevice) return { granted: false };

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#2563EB',
    }).catch(() => {});
  }

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted || existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!granted) {
    const req = await Notifications.requestPermissionsAsync();
    granted = req.granted || req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  }
  if (!granted) return { granted: false };

  const pid = projectId();
  if (!pid) {
    // Permission is on; no EAS project yet, so we can't mint a token. Tokens
    // start flowing once WS6 configures eas.projectId — no code change needed.
    console.warn('[push] permission granted but no EAS projectId; skipping token registration');
    return { granted: true };
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: pid });
    await registerDevice({ token, platform: Platform.OS });
    return { granted: true, token };
  } catch (err) {
    console.warn('[push] token registration failed', err);
    return { granted: true };
  }
}

/** Has the user already granted notification permission? */
export async function hasNotificationPermission(): Promise<boolean> {
  const perms = await Notifications.getPermissionsAsync();
  return perms.granted || perms.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}
