import { Ionicons } from '@expo/vector-icons';
import { Image, Text, View } from 'react-native';

import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * The first card of a user's first deck: the concept, taught in the deck's
 * own grammar (Rylan 2026-08-11). Not a modal, not onboarding, you dismiss
 * it the way you do everything here, by swiping. Carries the one sentence
 * that reframes the whole app (cards are people, not postings) plus the
 * user's real swipe contract, said ONCE here instead of crowding every card.
 *
 * Renders as deck-card content (same slot as JobCard's body). Session A
 * wires when it appears (first session until first swipe) and passes the
 * live tally from targetingTally so the numbers are the user's real
 * settings, never invented.
 */
export function DeckIntroCard({ tally }: { tally?: string }) {
  const colors = useColors();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Image
        source={require('../../../assets/images/scout-yeti-head.png')}
        style={{ width: 64, height: 64 }}
        resizeMode="contain"
        accessibilityLabel="Scout"
      />

      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: 30,
          color: colors.heading,
          textAlign: 'center',
          lineHeight: 35,
        }}>
        Every card here{'\n'}is a person
      </Text>

      <Text
        style={{
          fontFamily: fonts.sans,
          fontSize: 14.5,
          color: colors.inkSecondary,
          textAlign: 'center',
          lineHeight: 22,
          maxWidth: 270,
        }}>
        Swipe right and we find someone real at that company and draft your intro. You
        review everything before it sends.
      </Text>

      {tally ? (
        <Text
          style={{
            fontFamily: fonts.sansMedium,
            fontSize: 13,
            color: colors.accent,
            textAlign: 'center',
          }}>
          Right now, each swipe reaches {tally}.
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <Ionicons name="arrow-back" size={14} color={colors.inkTertiary} />
        <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary }}>
          Swipe either way to start
        </Text>
        <Ionicons name="arrow-forward" size={14} color={colors.inkTertiary} />
      </View>
    </View>
  );
}

export default DeckIntroCard;
