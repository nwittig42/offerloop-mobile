import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Jobs / People, the two decks. A segmented control rather than a second tab
 * bar row: these are two views of one hero surface, not two destinations, and
 * the app already spends its bottom bar on the five real destinations.
 *
 * The pill slides instead of cutting so the two feeds read as one surface the
 * user is panning across.
 */

export type FeedMode = 'jobs' | 'people';

// People leads (Rylan 2026-08-18): it is the default deck now, and the
// leftmost segment should be the one the screen opens on.
const SEGMENTS: { mode: FeedMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: 'people', label: 'People', icon: 'people-outline' },
  { mode: 'jobs', label: 'Jobs', icon: 'briefcase-outline' },
];

/** Fixed track geometry, so the pill can land exactly on a segment. */
const TRACK_W = 232;
const TRACK_PAD = 3;
const SEGMENT_W = (TRACK_W - TRACK_PAD * 2) / SEGMENTS.length;

export default function FeedSwitcher({
  mode,
  onChange,
}: {
  mode: FeedMode;
  onChange: (mode: FeedMode) => void;
}) {
  const colors = useColors();
  // Derived from SEGMENTS so reordering the segments can never strand the
  // pill on the wrong side again (it did, 2026-08-18: People moved to the
  // front but this stayed hardcoded, which highlighted the UNSELECTED tab).
  const index = Math.max(0, SEGMENTS.findIndex((s) => s.mode === mode));

  // Fixed geometry beats percentages here: the pill has to land exactly on a
  // segment, and a percentage of the track ignores the 3pt padding, which left
  // the pill sitting a few points past the segment it was meant to mark.
  const progress = useDerivedValue(
    () => withTiming(index, { duration: 220, easing: Easing.bezier(0.16, 1, 0.3, 1) }),
    [index],
  );
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * SEGMENT_W }],
  }));

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        alignSelf: 'center',
        width: TRACK_W,
        height: 38,
        borderRadius: 19,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.hairline,
        padding: TRACK_PAD,
        marginTop: 6,
      }}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: TRACK_PAD,
            bottom: TRACK_PAD,
            left: TRACK_PAD,
            width: SEGMENT_W,
            borderRadius: 16,
            // Marketing blue, unmissable (Rylan 2026-08-18: "hard to tell
            // what is actually selected"). The active segment is the one
            // sitting on the blue.
            backgroundColor: colors.marketing,
            shadowColor: colors.marketing,
            shadowOpacity: 0.35,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
          },
          pillStyle,
        ]}
      />
      {SEGMENTS.map((segment) => {
        const active = segment.mode === mode;
        return (
          <Pressable
            key={segment.mode}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${segment.label} feed`}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync();
              onChange(segment.mode);
            }}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}>
            <Ionicons
              name={segment.icon}
              size={15}
              color={active ? '#FFFFFF' : colors.inkTertiary}
            />
            <Text
              maxFontSizeMultiplier={1.2}
              style={{
                fontFamily: active ? fonts.sansSemibold : fonts.sansMedium,
                fontSize: 14,
                color: active ? '#FFFFFF' : colors.inkTertiary,
              }}>
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
