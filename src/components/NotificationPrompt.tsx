import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts, type Palette } from '@/theme/tokens';

/**
 * The "turn on notifications" prompt, shown at launch when push is off
 * (like Sorce's). A bottom sheet that slides up over a dimmed app, so the
 * edge of the app stays visible behind it. Offerloop-skinned and vibrant:
 * the mail-carrying Scout, a sample reply notification (the most exciting
 * one), three benefits, and a blue-gradient call to action. Mock until
 * Phase 3 wires real push.
 */

const benefits = (c: Palette): { icon: keyof typeof Ionicons.glyphMap; tone: string; text: string }[] => [
  { icon: 'chatbubble-ellipses-outline', tone: c.positive, text: 'Know the second a recruiter replies' },
  { icon: 'document-text-outline', tone: c.accent, text: 'Get pinged when a draft is ready to send' },
  { icon: 'infinite', tone: c.navy, text: 'See what your Loops did each morning' },
];

export function NotificationPrompt() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const BENEFITS = benefits(colors);
  const { notificationsEnabled, notifPromptDismissed, setNotificationsEnabled, dismissNotifPrompt } =
    useApp();

  const visible = !notificationsEnabled && !notifPromptDismissed;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={dismissNotifPrompt}>
      <Pressable
        onPress={dismissNotifPrompt}
        style={{ flex: 1, backgroundColor: 'rgba(17,19,24,0.45)', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.paper,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 10,
            paddingHorizontal: 24,
            paddingBottom: insets.bottom + 18,
            gap: 16,
          }}>
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 5,
              borderRadius: 3,
              backgroundColor: colors.hairline,
              marginBottom: 2,
            }}
          />

          <View style={{ alignItems: 'center', gap: 4 }}>
            <Image
              source={require('../../assets/images/scout-share.png')}
              style={{ width: 122, height: 78 }}
              resizeMode="contain"
            />
            <Text style={{ fontFamily: fonts.display, fontSize: 30, color: colors.heading, textAlign: 'center' }}>
              Never miss a reply
            </Text>
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 13.5,
                color: colors.inkSecondary,
                textAlign: 'center',
                lineHeight: 20,
              }}>
              Recruiters reply when they reply. Turn on notifications so you can respond
              first, right from your phone.
            </Text>
          </View>

          {/* Sample notification, the exciting one. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 12,
            }}>
            <Image
              source={require('../../assets/images/offerloop-mark.png')}
              style={{ width: 32, height: 32 }}
              resizeMode="contain"
            />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12.5, color: colors.ink }}>
                  Offerloop
                </Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.inkTertiary }}>now</Text>
              </View>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkSecondary, lineHeight: 16 }}>
                A contact replied to your outreach. Tap to write back.
              </Text>
            </View>
          </View>

          <View style={{ gap: 12 }}>
            {BENEFITS.map((b) => (
              <View key={b.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: b.tone + '14',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Ionicons name={b.icon} size={17} color={b.tone} />
                </View>
                <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink }}>
                  {b.text}
                </Text>
              </View>
            ))}
          </View>

          <View style={{ gap: 10, paddingTop: 2 }}>
            <Pressable
              onPress={() => setNotificationsEnabled(true)}
              accessibilityRole="button">
              <LinearGradient
                colors={['#3B82F6', '#2563EB', '#4A60A8'] as const}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.paper }}>
                  Enable notifications
                </Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={dismissNotifPrompt} accessibilityRole="button" style={{ alignSelf: 'center', padding: 6 }}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.inkTertiary }}>
                Skip for now
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default NotificationPrompt;
