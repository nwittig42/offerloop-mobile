import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Image, Linking, Modal, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { registerForPushNotificationsAsync } from '@/notifications/push';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Notification priming gate — shown inside the app (post sign-in), on EVERY app
 * open, until the user actually turns notifications on.
 *
 * Why so insistent: everything Offerloop does is time-sensitive. A reply lands
 * and you want to answer while you're top of mind; a draft finishes cooking; an
 * application needs a decision. Without push, the user has to remember to come
 * back — which is exactly the retention leak the app exists to close. So
 * "Not now" only dismisses for THIS launch; it returns next open.
 *
 * Three states, driven by the real OS permission (never a local flag, which
 * lies after a reinstall or a Settings change):
 *   granted            → never render
 *   denied, can ask    → "Turn on notifications" (fires the OS prompt)
 *   denied, can't ask  → "Open Settings" (iOS only prompts once; the button
 *                        would otherwise be a dead no-op)
 */

// The four pushes the backend actually sends. Keep this list honest — it is a
// promise about what lands on their lock screen.
//   reply     → gmail_webhook.py  (a contact wrote back)
//   draft     → draft_ready_notify.py
//   autoapply → auto_apply/notify.py (finished, or needs your input)
//   loop      → loop_jobs.py (a Loop found new people)
const ROWS = [
  {
    icon: 'chatbubble-ellipses-outline' as const,
    text: 'A contact replied — follow up while you’re top of mind',
  },
  {
    icon: 'document-text-outline' as const,
    text: 'Your draft is ready to review and send',
  },
  {
    icon: 'flash-outline' as const,
    text: 'An auto-apply finished — or needs a decision from you',
  },
  {
    icon: 'sync-outline' as const,
    text: 'A Loop found new people while you were away',
  },
];

export default function NotificationsGate() {
  const colors = useColors();
  const [visible, setVisible] = useState(false);
  const [canAsk, setCanAsk] = useState(true);
  const [busy, setBusy] = useState(false);
  // Per-launch only — deliberately NOT persisted, so the gate returns next open.
  const [dismissedThisLaunch, setDismissedThisLaunch] = useState(false);

  const check = useCallback(async () => {
    if (dismissedThisLaunch) return;
    try {
      const s = await Notifications.getPermissionsAsync();
      const granted =
        s.granted || s.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
      setCanAsk(s.canAskAgain !== false);
      setVisible(!granted);
    } catch {
      setVisible(false);
    }
  }, [dismissedThisLaunch]);

  useEffect(() => {
    void check();
  }, [check]);

  // Re-check on foreground so enabling in iOS Settings dismisses this immediately.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  const onEnable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!canAsk) {
        // iOS already burned its one prompt — Settings is the only path.
        await Linking.openSettings();
        return; // the AppState listener re-checks when they come back
      }
      const res = await registerForPushNotificationsAsync();
      if (res.granted) {
        setVisible(false);
      } else {
        // They said no at the OS prompt. Don't nag again this launch.
        setDismissedThisLaunch(true);
        setVisible(false);
      }
    } catch {
      setVisible(false);
    } finally {
      setBusy(false);
    }
  };

  const onNotNow = () => {
    setDismissedThisLaunch(true);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onNotNow}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(8,12,22,0.55)',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}>
        <View
          style={{
            backgroundColor: colors.paper,
            borderRadius: 22,
            padding: 24,
            gap: 18,
          }}>
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Image
              source={require('../../assets/images/scout-wave.png')}
              style={{ width: 96, height: 96 }}
              resizeMode="contain"
            />
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: 24,
                color: colors.heading,
                textAlign: 'center',
              }}>
              Know the moment they reply
            </Text>
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 13.5,
                color: colors.inkSecondary,
                textAlign: 'center',
                lineHeight: 20,
              }}>
              Networking is won on fast follow-ups. Turn on notifications and we’ll tell you the
              second something needs you.
            </Text>
          </View>

          <View style={{ gap: 12 }}>
            {ROWS.map((row) => (
              <View key={row.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.marketing + '12',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Ionicons name={row.icon} size={17} color={colors.marketing} />
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontFamily: fonts.sans,
                    fontSize: 13.5,
                    color: colors.ink,
                    lineHeight: 19,
                  }}>
                  {row.text}
                </Text>
              </View>
            ))}
          </View>

          <View style={{ gap: 6 }}>
            <Button
              label={canAsk ? 'Turn on notifications' : 'Open Settings'}
              variant="brand"
              size="lg"
              fullWidth
              disabled={busy}
              onPress={onEnable}
            />
            <Pressable onPress={onNotNow} accessibilityRole="button" style={{ paddingVertical: 10 }}>
              <Text
                style={{
                  fontFamily: fonts.sansMedium,
                  fontSize: 13.5,
                  color: colors.inkTertiary,
                  textAlign: 'center',
                }}>
                Not now
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
