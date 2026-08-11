import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import Avatar from '@/components/Avatar';
import Header from '@/components/Header';
import NightSky from '@/components/NightSky';
import SearchBar from '@/components/ui/SearchBar';
import SnakeBorder from '@/components/ui/SnakeBorder';
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

// Whose turn is it (Your turn / Waiting), plus a Replied view that isolates
// the exciting "they wrote back" conversations (where push notifications
// land), and All.
const FILTERS = ['All', 'Your turn', 'Waiting', 'Replied'] as const;
type Filter = (typeof FILTERS)[number];

// Filter-specific empty copy, so a filter with no matches doesn't read as
// "you've never swiped" when the user clearly has conversations elsewhere.
const FILTER_EMPTY: Record<Filter, string> = {
  All: '',
  'Your turn': "You’re all caught up. Nothing needs you right now.",
  Replied: 'No replies yet. They’ll show here when someone writes back.',
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
  if (filter === 'Your turn') return needsAttention(item);
  if (filter === 'Replied') return item.status === 'replied';
  return isWaiting(item);
}

/** First real line of a draft (skips the greeting) for a content sneak-peek,
 *  so every "ready" row reads differently instead of a wall of identical
 *  "Draft ready to review." Falls back to the subject, then a generic label. */
function draftOpener(item: OutreachItem): string {
  const body = (item.body ?? '').trim();
  if (body) {
    const opener = body
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !/^(hi|hey|hello|dear)\b/i.test(l));
    if (opener) return opener;
  }
  return item.subject ?? 'Intro ready to send';
}

/** The message-preview line. State is carried as a short prefix ("Draft ·",
 *  "Sent ·") so the row reads its status AND a content sneak-peek at a glance;
 *  color signals whether it's actionable. */
function previewFor(item: OutreachItem, c: Palette): { text: string; color: string } {
  switch (item.status) {
    case 'ready':
      return { text: `Draft · ${draftOpener(item)}`, color: c.accent };
    case 'failed':
      return { text: 'Couldn’t draft. Tap to retry.', color: c.negative };
    case 'sent':
      return { text: `Sent · ${item.subject ?? 'Intro sent'}`, color: c.inkSecondary };
    case 'replied': {
      const last = item.thread?.[item.thread.length - 1];
      const text = last && last.from === 'them' ? last.text : item.snippet ?? 'Replied';
      return { text, color: item.attended ? c.inkSecondary : c.ink };
    }
    default:
      return { text: item.snippet ?? '', color: c.inkSecondary };
  }
}

const DRAFTING_GREEN = '#22C55E';

/** The drafting placeholder: an inset card with the blue snake border chasing
 *  the edge and a bright green status next to the company, in place of words.
 *  Resolves when the real draft replaces this row. Also renders the 'queued'
 *  state (waiting for an earlier swipe to finish drafting) — static and muted,
 *  because nothing is actually running for it yet. */
function DraftingRow({ item, onPress }: { item: OutreachItem; onPress: () => void }) {
  const colors = useColors();
  const queued = item.status === 'queued';
  const [size, setSize] = useState({ w: 0, h: 0 });
  const dot = useSharedValue(0.35);
  // Rotating "what we're doing" phrases so the wait reads as real research, not
  // a spinner. The contact's name isn't known until the draft lands, so these
  // reference the company.
  const phrases = useMemo(() => {
    const base = [
      'Looking at work history on LinkedIn',
      `Finding articles about ${item.company}`,
      'Finding your experience intersection',
      `Viewing ${item.company} YouTube videos`,
      'Reading their recent posts',
      `Scanning the ${item.company} team`,
      'Writing your intro',
    ];
    // Shuffle so each drafting session reads a little differently.
    for (let i = base.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [base[i], base[j]] = [base[j], base[i]];
    }
    return base;
  }, [item.company]);
  const [phrase, setPhrase] = useState(0);
  useEffect(() => {
    dot.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
    const t = setInterval(() => setPhrase((p) => (p + 1) % phrases.length), 1700);
    return () => clearInterval(t);
  }, [dot, phrases.length]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: dot.value }));
  return (
    <Pressable
      onPress={onPress}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{
        marginHorizontal: 12,
        marginVertical: 5,
        borderRadius: 14,
        backgroundColor: colors.paper,
        paddingHorizontal: 14,
        paddingVertical: 11,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}>
      {!queued && size.w > 0 ? <SnakeBorder w={size.w} h={size.h} color={colors.marketing} /> : null}
      <Avatar name={item.contact?.name || item.company} size={44} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.sansSemibold, fontSize: 15.5, color: colors.ink }}>
          {/* The magic moment: the row becomes the PERSON as soon as the
              server finds them, while the draft is still being written. */}
          {item.contact?.name ? `${item.contact.name} · ${item.company}` : item.company}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {queued ? (
            <View
              style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.inkTertiary }}
            />
          ) : (
            <Animated.View
              style={[{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: DRAFTING_GREEN }, dotStyle]}
            />
          )}
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontFamily: fonts.sansSemibold,
              fontSize: 13,
              color: queued ? colors.inkSecondary : DRAFTING_GREEN,
            }}>
            {queued
              ? 'In line, drafting starts in a moment…'
              : item.stageLabel
                ? `${item.stageLabel}…`
                : `${phrases[phrase]}…`}
          </Text>
        </View>
      </View>
    </Pressable>
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
  const router = useRouter();
  const swipeRef = useRef<SwipeableMethods>(null);
  const unread = needsAttention(item);
  const preview = previewFor(item, colors);
  const linkedinUrl = item.contact?.linkedinUrl;

  // Swipe-left actions (bringing back the Network quick actions): open their
  // LinkedIn and/or craft a meeting prep for them, straight from the inbox.
  const onPrep = () =>
    router.push({
      pathname: '/meeting-prep/new',
      params: linkedinUrl ? { scanned: linkedinUrl } : {},
    });
  // Swipe the other way (right) to pin/unpin to the top, alongside long-press.
  const pin = () => {
    swipeRef.current?.close();
    onTogglePin();
  };

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={1.6}
      leftThreshold={40}
      rightThreshold={40}
      renderLeftActions={() => (
        <Pressable
          onPress={pin}
          style={{
            width: 84,
            backgroundColor: colors.navy,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
          }}>
          <Ionicons name={item.pinned ? 'pin' : 'pin-outline'} size={20} color={colors.paper} />
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: colors.paper }}>
            {item.pinned ? 'Unpin' : 'Pin'}
          </Text>
        </Pressable>
      )}
      renderRightActions={() => (
        <View style={{ flexDirection: 'row' }}>
          {linkedinUrl ? (
            <Pressable
              onPress={() => Linking.openURL(linkedinUrl)}
              style={{ width: 76, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
              <Ionicons name="logo-linkedin" size={20} color={colors.paper} />
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: colors.paper }}>LinkedIn</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onPrep}
            style={{ width: 76, backgroundColor: colors.coffee, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            <Ionicons name="cafe" size={20} color={colors.paper} />
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: colors.paper }}>Prep</Text>
          </Pressable>
        </View>
      )}>
      <Pressable
        onPress={onPress}
        onLongPress={onTogglePin}
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
      </View>
      </Pressable>
    </ReanimatedSwipeable>
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
  const { outreach, unreadCount, toggleOutreachPin, showToast, inboxState, refetchInbox, retryDraft } =
    useApp();
  // Pull-to-refresh: force a fresh inbox fetch, which also runs the optimistic->
  // real id reconcile so a just-swiped draft picks up its real id right away
  // (no 60s wait) and becomes openable + sendable in-app.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchInbox();
    } finally {
      setRefreshing(false);
    }
  };
  const [filter, setFilter] = useState<Filter>('All');
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

  // A failed row's tap RETRIES the draft (the row promises "Tap to retry");
  // everything else opens the conversation.
  const onRowPress = (item: OutreachItem) => {
    if (item.status === 'failed') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      retryDraft(item.id);
      return;
    }
    router.push(`/outreach/${item.id}`);
  };

  const renderRows = (list: OutreachItem[]) =>
    list.map((item, i) => (
      <View key={item.id}>
        {item.status === 'drafting' || item.status === 'queued' ? (
          <DraftingRow item={item} onPress={() => router.push(`/outreach/${item.id}`)} />
        ) : (
          <InboxRow
            item={item}
            onPress={() => onRowPress(item)}
            onTogglePin={() => onTogglePin(item)}
          />
        )}
        {i < list.length - 1 && item.status !== 'drafting' && item.status !== 'queued' ? (
          <View
            style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginLeft: 84 }}
          />
        ) : null}
      </View>
    ));

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      {/* Dense list screen: keep the ridge faint so rows stay the focus. */}
      <NightSky ridgeOpacity={0.4} />
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
            const badge = f === 'Your turn' ? attentionCount : 0;
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.inkSecondary} />
        }
        ListHeaderComponent={
          pinned.length > 0 ? (
            <View>
              <SectionLabel text="Pinned" />
              {renderRows(pinned)}
              {rest.length > 0 ? <SectionLabel text="Recent" /> : null}
            </View>
          ) : null
        }
        renderItem={({ item }) =>
          item.status === 'drafting' || item.status === 'queued' ? (
            <DraftingRow item={item} onPress={() => router.push(`/outreach/${item.id}`)} />
          ) : (
            <InboxRow
              item={item}
              onPress={() => onRowPress(item)}
              onTogglePin={() => onTogglePin(item)}
            />
          )
        }
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
              Swipe right or long-press a conversation to pin it to the top.
            </Text>
          ) : null
        }
      />
        </>
      )}
    </View>
  );
}
