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
import { Chip } from '@/components/ui/Chip';
import SearchBar from '@/components/ui/SearchBar';
import SnakeBorder from '@/components/ui/SnakeBorder';
import { InboxSkeleton } from '@/components/ui/Skeleton';
import StateView from '@/components/ui/StateView';
import { badgeRelationFor } from '@/lib/relation';
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

// Named by what state a conversation is IN (the way a user would say it),
// not by whose turn it is: "Waiting" never made clear whether it was waiting
// on you or on them. All leads (Rylan 2026-08-18): it is the default chip, and
// the selected state belongs at the reading edge instead of docked far right.
const FILTERS = ['All', 'Your turn', 'Drafts', 'Sent', 'Replied'] as const;
type Filter = (typeof FILTERS)[number];

// Filter-specific empty copy, so a filter with no matches doesn't read as
// "you've never swiped" when the user clearly has conversations elsewhere.
const FILTER_EMPTY: Record<Filter, string> = {
  'Your turn': "You’re all caught up. Nothing needs you right now.",
  Drafts: 'No drafts waiting. Swipe right on a job in the Feed to write one.',
  Sent: 'Nothing sent yet.',
  Replied: 'No replies yet. They’ll show here when someone writes back.',
  All: '',
};

/** Swiped, still being written. Not yet a draft you can act on. */
function isPending(item: OutreachItem) {
  return item.status === 'drafting' || item.status === 'queued';
}

/**
 * Your turn: a draft to send, a draft that failed and wants a retry, or a
 * reply you have not opened yet. Failed belongs here because the row promises
 * "Tap to retry", which is squarely something the user has to do.
 */
export function needsAttention(item: OutreachItem) {
  if (item.status === 'replied') return !item.attended;
  return item.status === 'ready' || item.status === 'failed';
}

/** Their turn: sent and awaiting a reply. */
function isWaiting(item: OutreachItem) {
  return item.status === 'sent';
}

/** Done with: they replied and you have read it. */
function isHandled(item: OutreachItem) {
  return item.status === 'replied' && !!item.attended;
}

function matchesFilter(item: OutreachItem, filter: Filter) {
  if (filter === 'All') return true;
  if (filter === 'Your turn') return needsAttention(item);
  if (filter === 'Drafts') return item.status === 'ready' || item.status === 'failed' || isPending(item);
  if (filter === 'Sent') return isWaiting(item);
  return item.status === 'replied';
}

/**
 * The All view, grouped. Every conversation lands in exactly one of these, so
 * the section counts add up to the account and nothing hides between groups.
 * Order is by how much it wants from you, most first.
 */
const SECTIONS: { id: string; title: string; test: (i: OutreachItem) => boolean }[] = [
  { id: 'needs', title: 'Needs you', test: needsAttention },
  { id: 'drafting', title: 'Being written', test: isPending },
  { id: 'waiting', title: 'Waiting on them', test: isWaiting },
  { id: 'handled', title: 'Handled', test: isHandled },
];

/** Rows shown per group before "Show all". Keeps one big group from pushing
 *  every other group off the screen at a few hundred conversations. */
const PREVIEW_CAP = 5;

/**
 * Headers, rows and "Show all" live in ONE flat array rather than nested
 * lists, so the whole screen stays a single virtualized FlatList. At a few
 * hundred conversations that is the difference between a list that scrolls
 * and one that stutters.
 */
type Entry =
  | { kind: 'header'; key: string; id: string; title: string; count: number; collapsed: boolean }
  | { kind: 'row'; key: string; item: OutreachItem }
  | { kind: 'more'; key: string; id: string; hidden: number };

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

/** The state tag on the right of a row: Draft / Sent / Replied / Failed.
 *  Carrying state as a tag rather than as a text prefix frees the whole
 *  preview line for the person's job title, and lets you see the mix of
 *  states in one glance instead of one filter at a time. */
function StatusTag({ item }: { item: OutreachItem }) {
  switch (item.status) {
    case 'ready':
      return <Chip label="Draft" tone="accent" />;
    case 'failed':
      return <Chip label="Failed" tone="negative" />;
    case 'sent':
      return <Chip label="Sent" tone="neutral" />;
    case 'replied':
      return <Chip label="Replied" tone="positive" />;
    default:
      return null;
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
      <Avatar name={item.contact?.name || item.personName || item.company} size={44} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.sansSemibold, fontSize: 15.5, color: colors.ink }}>
          {/* The magic moment: the row becomes the PERSON as soon as the
              server finds them, while the draft is still being written. */}
          {/* People-deck hunts know the person from the swipe itself. */}
          {(item.contact?.name || item.personName)
            ? `${item.contact?.name || item.personName} · ${item.company}`
            : item.company}
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

  // The person's real job title, which the server already sends on every row.
  // When we have it, it earns the preview line: it tells you who this is, and
  // it makes every row read differently, which the repeated "Sent · subject"
  // never did. With no title we keep the old preview rather than show a gap.
  const role = item.contact?.title?.trim() ?? '';
  const badge = badgeRelationFor(role);
  const subtitle = role ? (item.company ? `${role} · ${item.company}` : role) : preview.text;
  const subtitleColor = role ? colors.inkSecondary : preview.color;

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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text
            numberOfLines={1}
            style={{ flexShrink: 1, fontFamily: fonts.sansSemibold, fontSize: 15.5, color: colors.ink }}>
            {item.contact?.name ?? item.company}
          </Text>
          {/* Only the two relations worth calling out get a badge. An unknown
              or plainly junior title gets nothing, so the badge keeps meaning. */}
          {/* Green for the hiring manager (Rylan 2026-08-18): the highest-
              value relation in the inbox wears the win color, matching the
              deck's Hiring manager chip. */}
          {badge ? (
            <Chip label={badge === 'Hiring manager' ? 'Hiring mgr' : badge} tone={badge === 'Recruiter' ? 'waiting' : 'positive'} />
          ) : null}
          {/* No title means the company never made it onto line two, so it
              keeps its old spot here rather than disappearing entirely. */}
          {!role && item.contact ? (
            <Text
              numberOfLines={1}
              style={{ flexShrink: 1, fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary }}>
              {item.company}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
            {item.pinned ? (
              <Ionicons name="pin" size={12} color={colors.accent} style={{ marginRight: 1 }} />
            ) : null}
            <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary }}>
              {item.timeLabel}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.inkTertiary} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            numberOfLines={role ? 1 : 2}
            style={{
              flexShrink: 1,
              fontFamily: unread ? fonts.sansMedium : fonts.sans,
              fontSize: 13,
              color: subtitleColor,
              lineHeight: 18,
            }}>
            {subtitle}
          </Text>
          <View style={{ marginLeft: 'auto' }}>
            <StatusTag item={item} />
          </View>
        </View>
      </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

/**
 * Group header: tap anywhere on it to collapse or open the group. The count
 * stays visible while collapsed, so a shut group still tells you how much is
 * in it. Padded to a comfortable tap target rather than sized to the text.
 */
function SectionHeader({
  title,
  count,
  collapsed,
  onToggle,
}: {
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: !collapsed }}
      accessibilityLabel={`${title}, ${count} ${count === 1 ? 'conversation' : 'conversations'}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 8,
        backgroundColor: colors.paper2,
      }}>
      <Ionicons
        name={collapsed ? 'chevron-forward' : 'chevron-down'}
        size={13}
        color={colors.inkTertiary}
      />
      <Text
        style={{
          fontFamily: fonts.sansSemibold,
          fontSize: 11,
          letterSpacing: 0.8,
          color: colors.inkTertiary,
        }}>
        {title.toUpperCase()}
      </Text>
      <Text
        style={{
          marginLeft: 'auto',
          fontFamily: fonts.sansMedium,
          fontSize: 11.5,
          color: colors.inkTertiary,
        }}>
        {count}
      </Text>
    </Pressable>
  );
}

/** "Show all 47" under a capped group. */
function ShowAllRow({ hidden, onPress }: { hidden: number; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 }}>
      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.accent }}>
        Show all {hidden + PREVIEW_CAP}
      </Text>
    </Pressable>
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
  // Opens on the grouped All view, not on "Your turn": landing on an empty
  // "you're all caught up" is a poor first impression, and All already floats
  // Needs you to the top, so it answers the same question without the risk.
  const [filter, setFilter] = useState<Filter>('All');
  const [query, setQuery] = useState('');
  // Rotating placeholder: teach what search can actually reach (names,
  // companies, roles, words inside the emails) instead of one static hint.
  const [hintIdx, setHintIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setHintIdx((i) => i + 1), 3500);
    return () => clearInterval(t);
  }, []);
  // Which groups the user has shut, and which have been opened past the cap.
  // Session state on purpose: reopening the tab gives you the full picture
  // again rather than whatever you happened to collapse an hour ago.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const q = query.trim().toLowerCase();

  // Counts come off the whole inbox, never off the filtered view, so a chip
  // reads the same number whichever chip you are standing on.
  const counts = useMemo(
    () => ({
      'Your turn': outreach.filter(needsAttention).length,
      Drafts: outreach.filter((i) => matchesFilter(i, 'Drafts')).length,
      Sent: outreach.filter((i) => matchesFilter(i, 'Sent')).length,
      Replied: outreach.filter((i) => matchesFilter(i, 'Replied')).length,
      All: outreach.length,
    }),
    [outreach],
  );

  const items = useMemo(() => {
    const matchesSearch = (item: OutreachItem) =>
      [item.contact?.name, item.company, item.contact?.title, item.jobTitle, item.subject, item.snippet]
        .some((s) => s?.toLowerCase().includes(q));
    // A search looks across the WHOLE inbox, not just the chip you are on.
    // Searching a name while standing on "Your turn" used to return nothing
    // when that person sat in Sent, which is the opposite of looking someone up.
    if (q) return outreach.filter(matchesSearch);
    return outreach.filter((item) => matchesFilter(item, filter));
  }, [outreach, filter, q]);

  const pinned = items.filter((i) => i.pinned);
  const rest = items.filter((i) => !i.pinned);

  // Group only when browsing All with no search. Every other view is already
  // one state, so headers there would label a list with what it obviously is.
  const grouped = filter === 'All' && q === '';

  const entries = useMemo(() => {
    const out: Entry[] = [];
    const push = (id: string, title: string, list: OutreachItem[]) => {
      if (!list.length) return;
      const shut = !!collapsed[id];
      out.push({ kind: 'header', key: `h:${id}`, id, title, count: list.length, collapsed: shut });
      if (shut) return;
      const showAll = !!expanded[id];
      const visible = showAll ? list : list.slice(0, PREVIEW_CAP);
      for (const item of visible) out.push({ kind: 'row', key: item.id, item });
      if (!showAll && list.length > PREVIEW_CAP) {
        out.push({ kind: 'more', key: `m:${id}`, id, hidden: list.length - PREVIEW_CAP });
      }
    };

    if (!grouped) {
      // Flat view. Pinned still float, they just do not get a header of their own.
      for (const item of [...pinned, ...rest]) out.push({ kind: 'row', key: item.id, item });
      return out;
    }

    push('pinned', 'Pinned', pinned);
    for (const s of SECTIONS) push(s.id, s.title, rest.filter(s.test));
    return out;
  }, [grouped, pinned, rest, collapsed, expanded]);

  const onTogglePin = (item: OutreachItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleOutreachPin(item.id);
    showToast(item.pinned ? 'Unpinned' : 'Pinned to top');
  };

  const onToggleSection = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));
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
        {/* The count is the promise that search reaches past the current chip. */}
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={
            [
              outreach.length > 12
                ? `Search all ${outreach.length} conversations`
                : 'Search a name or company',
              'Search a role, like recruiter',
              'Search any words inside an email',
            ][hintIdx % 3]
          }
        />
      </View>

      <View style={{ paddingBottom: 10 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          {FILTERS.map((f) => {
            const selected = f === filter;
            const count = counts[f];
            // "Your turn" keeps the red count, because that one is a nudge.
            // The rest carry a quiet count so you can read the shape of the
            // account without tapping through every chip.
            const urgent = f === 'Your turn' && count > 0;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${f}, ${count}`}
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
                {urgent ? (
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
                      {count}
                    </Text>
                  </View>
                ) : count > 0 ? (
                  <Text
                    style={{
                      fontFamily: fonts.sansSemibold,
                      fontSize: 11.5,
                      color: selected ? colors.paper : colors.inkTertiary,
                      opacity: selected ? 0.75 : 1,
                    }}>
                    {count}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(e) => e.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
        initialNumToRender={12}
        windowSize={11}
        removeClippedSubviews
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.inkSecondary} />
        }
        renderItem={({ item: entry, index }) => {
          if (entry.kind === 'header') {
            return (
              <SectionHeader
                title={entry.title}
                count={entry.count}
                collapsed={entry.collapsed}
                onToggle={() => onToggleSection(entry.id)}
              />
            );
          }
          if (entry.kind === 'more') {
            return (
              <ShowAllRow
                hidden={entry.hidden}
                onPress={() => setExpanded((e) => ({ ...e, [entry.id]: true }))}
              />
            );
          }
          const { item } = entry;
          // Hairline between consecutive rows only, so a group header never
          // gets a stray rule hanging off the row above it.
          const prev = entries[index - 1];
          const rule = prev?.kind === 'row' && !isPending(prev.item) && !isPending(item);
          return (
            <View>
              {rule ? (
                <View
                  style={{
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: colors.hairline,
                    marginLeft: 84,
                  }}
                />
              ) : null}
              {isPending(item) ? (
                <DraftingRow item={item} onPress={() => router.push(`/outreach/${item.id}`)} />
              ) : (
                <InboxRow
                  item={item}
                  onPress={() => onRowPress(item)}
                  onTogglePin={() => onTogglePin(item)}
                />
              )}
            </View>
          );
        }}
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
