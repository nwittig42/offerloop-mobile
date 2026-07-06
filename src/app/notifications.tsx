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
  auto_apply_attention: 'alert-circle-outline',
};

const kindColor = (c: Palette): Record<string, string> => ({
  draft_ready: c.accent,
  reply: c.positive,
  loop: c.navy,
  auto_apply_attention: c.waiting,
});

// Short kind label above each message, colored by kind, so the bell reads with
// hierarchy instead of a flat wall of rows.
const KIND_LABEL: Record<string, string> = {
  draft_ready: 'DRAFT READY',
  reply: 'REPLY',
  loop: 'LOOP',
  auto_apply_attention: 'NEEDS YOU',
};

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
                router.back();
                if (n.kind === 'auto_apply_attention' && n.autoApplyId) {
                  router.push(`/apply-questions/${n.autoApplyId}`);
                  return;
                }
                if (n.kind === 'reply' && n.outreachId) {
                  router.push(`/outreach/${n.outreachId}`);
                  return;
                }
                // loop -> Loops, draft_ready / anything else -> Inbox. The tab
                // switch has to wait for the modal dismiss to settle, or it's
                // dropped (the "View does nothing" bug).
                const tab = n.kind === 'loop' ? '/(tabs)/loops' : '/(tabs)/inbox';
                setTimeout(() => router.navigate(tab as never), 80);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 13,
                paddingHorizontal: 20,
                paddingVertical: 15,
                borderBottomWidth: 1,
                borderBottomColor: colors.hairlineLight,
                backgroundColor: n.read ? colors.paper : colors.paper2,
              }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: (KIND_COLOR[n.kind] ?? colors.ink) + '1A',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons
                  name={KIND_ICON[n.kind] ?? 'notifications-outline'}
                  size={19}
                  color={KIND_COLOR[n.kind] ?? colors.ink}
                />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text
                  style={{
                    fontFamily: fonts.sansSemibold,
                    fontSize: 10.5,
                    letterSpacing: 0.6,
                    color: KIND_COLOR[n.kind] ?? colors.inkTertiary,
                  }}>
                  {KIND_LABEL[n.kind] ?? 'UPDATE'}
                </Text>
                <Text
                  numberOfLines={2}
                  style={{
                    fontFamily: n.read ? fonts.sans : fonts.sansMedium,
                    fontSize: 14,
                    color: colors.ink,
                    lineHeight: 19,
                  }}>
                  {n.text}
                </Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary }}>
                  {n.timeLabel}
                </Text>
              </View>
              {!n.read ? (
                <View
                  style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: KIND_COLOR[n.kind] ?? colors.marketing }}
                />
              ) : (
                <Ionicons name="chevron-forward" size={15} color={colors.inkTertiary} />
              )}
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
