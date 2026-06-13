import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import Header from '@/components/Header';
import Chip, { type ChipTone } from '@/components/ui/Chip';
import { useApp } from '@/store/app';
import { colors, fonts } from '@/theme/tokens';
import type { OutreachItem, OutreachStatus } from '@/types';

/**
 * Inbox: the retention surface. Every right swipe lands here instantly as a
 * "Drafting" placeholder with shimmer bars, then fills in when the (mock)
 * async job finishes. Filters: All, Drafts, Sent, Replied.
 */

const FILTERS = ['All', 'Drafts', 'Sent', 'Replied'] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_CHIP: Record<OutreachStatus, { label: string; tone: ChipTone }> = {
  drafting: { label: 'Drafting', tone: 'waiting' },
  ready: { label: 'Ready to review', tone: 'accent' },
  sent: { label: 'Sent', tone: 'neutral' },
  replied: { label: 'Replied', tone: 'positive' },
  failed: { label: 'No contact found', tone: 'negative' },
};

function matchesFilter(item: OutreachItem, filter: Filter) {
  if (filter === 'All') return true;
  if (filter === 'Drafts') return item.status === 'drafting' || item.status === 'ready';
  if (filter === 'Sent') return item.status === 'sent';
  return item.status === 'replied';
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('');
}

function ShimmerBar({ width }: { width: number }) {
  const pulse = useSharedValue(0.45);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View
      style={[
        { width, height: 11, borderRadius: 4, backgroundColor: colors.hairline },
        style,
      ]}
    />
  );
}

function InboxRow({ item, onPress }: { item: OutreachItem; onPress: () => void }) {
  const chip = STATUS_CHIP[item.status];
  const isDrafting = item.status === 'drafting';

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.hairlineLight,
        backgroundColor: colors.paper,
      }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          backgroundColor: colors.paper2,
          borderWidth: 1,
          borderColor: colors.hairline,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.navy }}>
          {item.contact ? initials(item.contact.name) : item.company.charAt(0)}
        </Text>
      </View>

      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {isDrafting ? (
            <ShimmerBar width={130} />
          ) : (
            <Text
              numberOfLines={1}
              style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.ink, flex: 1 }}>
              {item.contact?.name ?? item.company}
            </Text>
          )}
          <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary }}>
            {item.timeLabel}
          </Text>
        </View>

        {isDrafting ? (
          <ShimmerBar width={190} />
        ) : (
          <Text
            numberOfLines={1}
            style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary }}>
            {item.contact ? `${item.contact.title} at ${item.contact.company}` : item.jobTitle}
          </Text>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {isDrafting ? (
            <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary, flex: 1 }}>
              Finding a contact at {item.company}...
            </Text>
          ) : (
            <Text
              numberOfLines={1}
              style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary, flex: 1 }}>
              {item.subject ?? item.snippet ?? ''}
            </Text>
          )}
          <Chip label={chip.label} tone={chip.tone} dot={isDrafting || item.status === 'ready'} />
        </View>
      </View>
    </Pressable>
  );
}

export default function InboxScreen() {
  const router = useRouter();
  const { outreach, unreadCount } = useApp();
  const [filter, setFilter] = useState<Filter>('All');

  const items = outreach.filter((item) => matchesFilter(item, filter));

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Header
        title="Inbox"
        unreadCount={unreadCount}
        onBellPress={() => router.push('/notifications')}
      />

      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12 }}>
        {FILTERS.map((f) => {
          const selected = f === filter;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={{
                borderRadius: 8,
                borderWidth: 1,
                borderColor: selected ? colors.ink : colors.hairline,
                backgroundColor: selected ? colors.ink : colors.paper,
                paddingHorizontal: 12,
                paddingVertical: 5,
              }}>
              <Text
                style={{
                  fontFamily: fonts.sansMedium,
                  fontSize: 12.5,
                  color: selected ? colors.paper : colors.inkSecondary,
                }}>
                {f}
              </Text>
            </Pressable>
          );
        })}
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
          items.map((item) => (
            <InboxRow key={item.id} item={item} onPress={() => router.push(`/outreach/${item.id}`)} />
          ))
        )}
      </ScrollView>
    </View>
  );
}
