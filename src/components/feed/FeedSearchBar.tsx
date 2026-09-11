import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { JOB_SEARCH_EXAMPLES, PEOPLE_SEARCH_EXAMPLES } from '@/lib/feedSearchExamples';
import { useTypewriterHint } from '@/lib/useTypewriterHint';
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
 * Empty state (Rylan 2026-09-10: "ranked for you doesn't make the most
 * sense"): real example searches type themselves in and cycle, the same
 * animated placeholder the filter pop-up already uses, so the bar itself
 * teaches what it is for instead of describing its own state.
 *
 * Finding people is free to the user; swiping right is what costs.
 */
export default function FeedSearchBar({ mode }: { mode: FeedMode }) {
  const colors = useColors();
  const router = useRouter();
  const { swipeSettings, updateSwipeSettings, showToast } = useApp();
  const active = (mode === 'jobs' ? swipeSettings.jobFilter : swipeSettings.peopleFilter)?.trim() || '';
  const hint = useTypewriterHint(mode === 'jobs' ? JOB_SEARCH_EXAMPLES : PEOPLE_SEARCH_EXAMPLES);

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
        height: 38,
        borderRadius: 19,
        borderWidth: active ? 1.5 : 1,
        borderColor: active ? colors.marketing : colors.ink + '24',
        backgroundColor: colors.paper,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 12,
        paddingRight: 8,
        gap: 8,
        shadowColor: colors.ink,
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      }}>
      <Ionicons name="search-outline" size={15} color={active ? colors.marketing : colors.inkSecondary} />
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          fontFamily: fonts.sans,
          fontSize: 13,
          color: active ? colors.ink : colors.inkTertiary,
        }}>
        {active || hint}
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
