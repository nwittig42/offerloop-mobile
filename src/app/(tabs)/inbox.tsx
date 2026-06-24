import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import Avatar from '@/components/Avatar';
import Header from '@/components/Header';
import SearchBar from '@/components/ui/SearchBar';
import { InboxSkeleton } from '@/components/ui/Skeleton';
import StateView from '@/components/ui/StateView';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts, type Palette } from '@/theme/tokens';
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
const FILTERS = ['All', 'Needs you', 'Replied', 'Waiting'] as const;
type Filter = (typeof FILTERS)[number];

// Filter-specific empty copy, so a filter with no matches doesn't read as
// "you've never swiped" when the user clearly has conversations elsewhere.
const FILTER_EMPTY: Record<Filter, string> = {
  All: '',
  'Needs you': "You're all caught up — nothing needs you right now.",
  Replied: 'No replies yet — they’ll show here when someone writes back.',
  Waiting: 'Nothing waiting on a reply right now.',
};

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
function previewFor(item: OutreachItem, c: Palette): { text: string; color: string } {
  switch (item.status) {
    case 'ready':
      return { text: 'Draft ready to review', color: c.accent };
    case 'failed':
      return { text: 'No contact found', color: c.negative };
    case 'sent':
      return { text: `You: ${item.subject ?? 'Outreach sent'}`, color: c.inkSecondary };
    case 'replied': {
      const last = item.thread?.[item.thread.length - 1];
      const text = last && last.from === 'them' ? last.text : item.snippet ?? 'Replied';
      return { text, color: item.attended ? c.inkSecondary : c.ink };
    }
    default:
      return { text: item.snippet ?? '', color: c.inkSecondary };
  }
}

function ShimmerBar({ width }: { width: number }) {
  const colors = useColors();
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

function InboxRow({
  item,
  onPress,
  onTogglePin,
}: {
  item: OutreachItem;
  onPress: () => void;
  onTogglePin: () => void;
}) {
  const colors = useColors();
  const isDrafting = item.status === 'drafting';
  const unread = needsAttention(item);
  const preview = previewFor(item, colors);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={isDrafting ? undefined : onTogglePin}
      delayLongPress={280}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 9,
        backgroundColor: item.pinned ? colors.paper2 : colors.paper,
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
            {item.pinned ? (
              <Ionicons name="pin" size={12} color={colors.accent} style={{ marginRight: 1 }} />
            ) : null}
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

/** Small uppercase divider label for the Pinned / Recent sections. */
function SectionLabel({ text }: { text: string }) {
  const colors = useColors();
  return (
    <Text
      style={{
        fontFamily: fonts.sansSemibold,
        fontSize: 11,
        letterSpacing: 0.8,
        color: colors.inkTertiary,
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 6,
      }}>
      {text.toUpperCase()}
    </Text>
  );
}

export default function InboxScreen() {
  const router = useRouter();
  const colors = useColors();
  const { outreach, unreadCount, toggleOutreachPin, showToast, inboxState } = useApp();
  // Default to the actionable subset: with a large real inbox, "All" is a wall.
  const [filter, setFilter] = useState<Filter>('Needs you');
  const [query, setQuery] = useState('');

  const attentionCount = outreach.filter(needsAttention).length;

  const q = query.trim().toLowerCase();
  const items = useMemo(() => {
    const matchesSearch = (item: OutreachItem) =>
      q === '' ||
      [item.contact?.name, item.company, item.jobTitle, item.subject, item.snippet]
        .some((s) => s?.toLowerCase().includes(q));
    return outreach.filter((item) => matchesFilter(item, filter) && matchesSearch(item));
  }, [outreach, filter, q]);

  const pinned = items.filter((i) => i.pinned);
  const rest = items.filter((i) => !i.pinned);

  const onTogglePin = (item: OutreachItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleOutreachPin(item.id);
    showToast(item.pinned ? 'Unpinned' : 'Pinned to top');
  };

  const renderRows = (list: OutreachItem[]) =>
    list.map((item, i) => (
      <View key={item.id}>
        <InboxRow
          item={item}
          onPress={() => router.push(`/outreach/${item.id}`)}
          onTogglePin={() => onTogglePin(item)}
        />
        {i < list.length - 1 ? (
          <View
            style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginLeft: 84 }}
          />
        ) : null}
      </View>
    ));

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Header
        title="Inbox"
        mark
        unreadCount={unreadCount}
        onBellPress={() => router.push('/notifications')}
      />

      {inboxState.loading ? (
        <InboxSkeleton />
      ) : inboxState.error ? (
        <StateView
          icon="cloud-offline-outline"
          tone="error"
          title="Couldn’t load your inbox"
          body="We couldn’t reach Offerloop to pull your conversations. Check your connection and try again."
          actionLabel="Try again"
          onAction={inboxState.retry}
        />
      ) : (
        <>
      <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search name, company, subject" />
      </View>

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

      <FlatList
        data={rest}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
        initialNumToRender={12}
        windowSize={11}
        removeClippedSubviews
        ListHeaderComponent={
          pinned.length > 0 ? (
            <View>
              <SectionLabel text="Pinned" />
              {renderRows(pinned)}
              {rest.length > 0 ? <SectionLabel text="Recent" /> : null}
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <InboxRow
            item={item}
            onPress={() => router.push(`/outreach/${item.id}`)}
            onTogglePin={() => onTogglePin(item)}
          />
        )}
        ItemSeparatorComponent={() => (
          <View
            style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginLeft: 84 }}
          />
        )}
        ListEmptyComponent={
          items.length === 0 ? (
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 14,
                color: colors.inkSecondary,
                textAlign: 'center',
                padding: 32,
                lineHeight: 21,
              }}>
              {q
                ? `No conversations match "${query.trim()}".`
                : filter !== 'All' && outreach.length > 0
                  ? FILTER_EMPTY[filter]
                  : 'Nothing here yet. Swipe right on a job in the Feed and the draft lands in this inbox.'}
            </Text>
          ) : null
        }
        ListFooterComponent={
          items.length > 0 ? (
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 11.5,
                color: colors.inkTertiary,
                textAlign: 'center',
                paddingHorizontal: 20,
                paddingTop: 16,
              }}>
              Long-press a conversation to pin it to the top.
            </Text>
          ) : null
        }
      />
        </>
      )}
    </View>
  );
}
