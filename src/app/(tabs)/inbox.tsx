import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import Avatar from '@/components/Avatar';
import Header from '@/components/Header';
import { useApp } from '@/store/app';
import { colors, fonts } from '@/theme/tokens';
import type { OutreachItem } from '@/types';

/**
 * Inbox: the reply pipeline, styled like Messages. A flat, conversation list
 * with gradient avatars, preview lines, short times, and a blue unread dot
 * on anything waiting on you. "Needs attention" (replies + ready drafts) is
 * the first filter and carries a red count like the bell. The cold-open
 * draft and the reply thread live in the conversation detail.
 */

// Whose turn is it (Needs you / Waiting), plus a Replied view that isolates
// the exciting "they wrote back" conversations (where push notifications
// land), and All.
const FILTERS = ['Needs you', 'Replied', 'Waiting', 'All'] as const;
type Filter = (typeof FILTERS)[number];

/** Your turn: a ready draft to send, or a reply you have not opened yet. */
export function needsAttention(item: OutreachItem) {
  if (item.status === 'replied') return !item.attended;
  return item.status === 'ready';
}

/** Their turn: sent and awaiting a reply, or a reply you have answered. */
function isWaiting(item: OutreachItem) {
  return item.status === 'sent' || (item.status === 'replied' && !!item.attended);
}

function matchesFilter(item: OutreachItem, filter: Filter) {
  if (filter === 'All') return true;
  if (filter === 'Needs you') return needsAttention(item);
  if (filter === 'Replied') return item.status === 'replied';
  return isWaiting(item);
}

/** The message-preview line, colored when it's actionable. */
function previewFor(item: OutreachItem): { text: string; color: string } {
  switch (item.status) {
    case 'ready':
      return { text: 'Draft ready to review', color: colors.accent };
    case 'failed':
      return { text: 'No contact found', color: colors.negative };
    case 'sent':
      return { text: `You: ${item.subject ?? 'Outreach sent'}`, color: colors.inkSecondary };
    case 'replied': {
      const last = item.thread?.[item.thread.length - 1];
      const text = last && last.from === 'them' ? last.text : item.snippet ?? 'Replied';
      return { text, color: item.attended ? colors.inkSecondary : colors.ink };
    }
    default:
      return { text: item.snippet ?? '', color: colors.inkSecondary };
  }
}

function ShimmerBar({ width }: { width: number }) {
  const pulse = useSharedValue(0.45);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View
      style={[{ width, height: 12, borderRadius: 4, backgroundColor: colors.hairline }, style]}
    />
  );
}

function InboxRow({ item, onPress }: { item: OutreachItem; onPress: () => void }) {
  const isDrafting = item.status === 'drafting';
  const unread = needsAttention(item);
  const preview = previewFor(item);

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 9,
        backgroundColor: colors.paper,
      }}>
      <View style={{ width: 8, alignItems: 'center' }}>
        {unread ? (
          <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.marketing }} />
        ) : null}
      </View>

      <Avatar name={item.contact?.name ?? item.company} size={48} />

      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {isDrafting ? (
            <ShimmerBar width={140} />
          ) : (
            <Text numberOfLines={1} style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15.5, color: colors.ink }}>
                {item.contact?.name ?? item.company}
              </Text>
              {item.contact ? (
                <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary }}>
                  {'  '}
                  {item.company}
                </Text>
              ) : null}
            </Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary }}>
              {item.timeLabel}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.inkTertiary} />
          </View>
        </View>

        {isDrafting ? (
          <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkTertiary }}>
            Finding a contact at {item.company}...
          </Text>
        ) : (
          <Text
            numberOfLines={2}
            style={{
              fontFamily: unread ? fonts.sansMedium : fonts.sans,
              fontSize: 13,
              color: preview.color,
              lineHeight: 18,
            }}>
            {preview.text}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export default function InboxScreen() {
  const router = useRouter();
  const { outreach, unreadCount } = useApp();
  const [filter, setFilter] = useState<Filter>('All');

  const items = outreach.filter((item) => matchesFilter(item, filter));
  const attentionCount = outreach.filter(needsAttention).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Header
        title="Inbox"
        mark
        unreadCount={unreadCount}
        onBellPress={() => router.push('/notifications')}
      />

      <View style={{ paddingBottom: 10 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          {FILTERS.map((f) => {
            const selected = f === filter;
            const badge = f === 'Needs you' ? attentionCount : 0;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 7,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: selected ? colors.navy : colors.hairline,
                  backgroundColor: selected ? colors.navy : colors.paper,
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                }}>
                <Text
                  style={{
                    fontFamily: fonts.sansSemibold,
                    fontSize: 14,
                    color: selected ? colors.paper : colors.inkSecondary,
                  }}>
                  {f}
                </Text>
                {badge > 0 ? (
                  <View
                    style={{
                      minWidth: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: colors.negative,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 4,
                    }}>
                    <Text style={{ color: colors.paper, fontSize: 9.5, fontFamily: fonts.sansSemibold }}>
                      {badge}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {items.length === 0 ? (
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 14,
              color: colors.inkSecondary,
              textAlign: 'center',
              padding: 32,
              lineHeight: 21,
            }}>
            Nothing here yet. Swipe right on a job in the Feed and the draft lands in this
            inbox.
          </Text>
        ) : (
          items.map((item, i) => (
            <View key={item.id}>
              <InboxRow item={item} onPress={() => router.push(`/outreach/${item.id}`)} />
              {i < items.length - 1 ? (
                <View
                  style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginLeft: 84 }}
                />
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
