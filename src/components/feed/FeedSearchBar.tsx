import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

import type { FeedMode } from './FeedSwitcher';

/**
 * The deck's search, as the top row of the bar that rides the card (Rylan
 * 2026-09-08, second pass: "inside the pill, above Draft it / Send it, and
 * drop the gear"). Tapping it opens the same pop-up the gear used to
 * ("Personalize your people feed": the sentence, recents, and the email
 * template link), so nothing the gear reached is lost. The row shows the
 * sentence the deck is built from, and the X clears back to the ranked deck.
 *
 * Finding people is free to the user; swiping right is what costs.
 */
export default function FeedSearchBar({ mode }: { mode: FeedMode }) {
  const colors = useColors();
  const router = useRouter();
  const { swipeSettings, updateSwipeSettings, showToast } = useApp();
  const active = (mode === 'jobs' ? swipeSettings.jobFilter : swipeSettings.peopleFilter)?.trim() || '';

  const clear = () => {
    updateSwipeSettings(mode === 'jobs' ? { jobFilter: null } : { peopleFilter: null });
    showToast(mode === 'jobs' ? 'Back to the jobs we ranked for you.' : 'Back to the people we ranked for you.');
  };

  return (
    <Pressable
      onPress={() => router.push(`/feed-filter?deck=${mode}` as never)}
      accessibilityRole="search"
      accessibilityLabel={
        active
          ? `${mode === 'jobs' ? 'Apply' : 'People'} deck search: ${active}. Tap to change it`
          : mode === 'jobs'
            ? 'Search the Apply deck'
            : 'Search the People deck'
      }
      style={{
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: active ? colors.marketing : colors.hairline,
        backgroundColor: colors.paper,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 12,
        paddingRight: 8,
        gap: 8,
      }}>
      <Ionicons name="search-outline" size={15} color={active ? colors.marketing : colors.inkTertiary} />
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          fontFamily: fonts.sans,
          fontSize: 13,
          color: active ? colors.ink : colors.inkTertiary,
        }}>
        {active || (mode === 'jobs' ? 'Ranked for you. Tap to search jobs' : 'Ranked for you. Tap to search people')}
      </Text>
      {active ? (
        <Pressable
          onPress={clear}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear the search"
          style={{ padding: 2 }}>
          <Ionicons name="close-circle" size={17} color={colors.inkTertiary} />
        </Pressable>
      ) : (
        <View style={{ width: 4 }} />
      )}
    </Pressable>
  );
}
