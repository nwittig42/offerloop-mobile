import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts, type Palette } from '@/theme/tokens';

/**
 * The notification hub (header bell). Draft-ready, replies, and Loop
 * updates, each deep-linking to its target. Items mark read on view.
 */

const KIND_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  draft_ready: 'document-text-outline',
  reply: 'chatbubble-ellipses-outline',
  loop: 'sync-outline',
};

const kindColor = (c: Palette): Record<string, string> => ({
  draft_ready: c.accent,
  reply: c.positive,
  loop: c.navy,
});

export default function NotificationsScreen() {
  const router = useRouter();
  const colors = useColors();
  const KIND_COLOR = kindColor(colors);
  const { notifications, markNotificationsRead } = useApp();

  useEffect(() => {
    // Mark read after the list has been seen once.
    const t = setTimeout(markNotificationsRead, 800);
    return () => clearTimeout(t);
  }, [markNotificationsRead]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View
        style={{
          paddingTop: 18,
          paddingHorizontal: 20,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 28, color: colors.heading }}>
          Notifications
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 6 }}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {notifications.length === 0 ? (
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 14,
              color: colors.inkSecondary,
              textAlign: 'center',
              padding: 32,
            }}>
            Nothing yet. Swipe right on a job to get your first draft.
          </Text>
        ) : (
          notifications.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => {
                if (n.outreachId) {
                  router.back();
                  router.push(`/outreach/${n.outreachId}`);
                }
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 20,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: colors.hairlineLight,
                backgroundColor: n.read ? colors.paper : colors.paper2,
              }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: (KIND_COLOR[n.kind] ?? colors.ink) + '14',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons
                  name={KIND_ICON[n.kind] ?? 'notifications-outline'}
                  size={16}
                  color={KIND_COLOR[n.kind] ?? colors.ink}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    fontFamily: n.read ? fonts.sans : fonts.sansMedium,
                    fontSize: 13.5,
                    color: colors.ink,
                    lineHeight: 19,
                  }}>
                  {n.text}
                </Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary }}>
                  {n.timeLabel}
                </Text>
              </View>
              {n.outreachId ? (
                <Ionicons name="chevron-forward" size={15} color={colors.inkTertiary} />
              ) : null}
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
