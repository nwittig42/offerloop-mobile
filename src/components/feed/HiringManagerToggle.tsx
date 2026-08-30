import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

const TRACK_W = 44;
const TRACK_H = 26;
const THUMB = 22;

export type HiringManagerAction = 'draft' | 'send';

/**
 * The one control that changes what a right swipe MEANS: a sentence with a
 * live word in it (Rylan's design, 2026-08-30).
 *
 *     [Draft] email to hiring manager        (switch)
 *
 * The bracketed word is the verb of the sentence and the only part that
 * changes: tap it to flip between Draft and Send (Send confirms first, via
 * the caller). The switch on the right is on/off, same as it always was.
 * One row, so it cannot overflow the glass bar and collide with the action
 * circles, which is how every two-row version of this control died.
 *
 * Off dims the sentence but leaves it legible, so the feature stays
 * discoverable; tapping the dimmed sentence turns it on (confirmed, it
 * spends credits).
 */
export default function HiringManagerToggle({
  on,
  action,
  onToggle,
  onActionTap,
}: {
  on: boolean;
  action: HiringManagerAction;
  onToggle: () => void;
  /** Tap on the [Draft]/[Send] word. Caller flips the action (confirming
   *  Send) when on, or treats it as turn-on when off. */
  onActionTap: () => void;
}) {
  const colors = useColors();

  const slide = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    slide.value = withTiming(on ? 1 : 0, {
      duration: 200,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  }, [on, slide]);
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slide.value * (TRACK_W - THUMB - 4) }],
  }));

  const verb = action === 'send' ? 'Send' : 'Draft';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Ionicons
        name="mail-outline"
        size={15}
        color={on ? colors.inkSecondary : colors.inkTertiary}
      />
      <Pressable
        onPress={onActionTap}
        accessibilityRole="button"
        accessibilityLabel={
          on
            ? `${verb} email to hiring manager. Tap to switch to ${verb === 'Draft' ? 'sending automatically' : 'drafting'}.`
            : 'Email the hiring manager is off. Tap to turn it on.'
        }
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View
          style={{
            paddingHorizontal: 9,
            paddingVertical: 3,
            borderRadius: 6,
            backgroundColor: on ? colors.accent + '1F' : colors.surface,
            borderWidth: 1,
            borderColor: on ? colors.accent + '55' : colors.hairline,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}>
          <Text
            style={{
              fontFamily: fonts.sansSemibold,
              fontSize: 12.5,
              color: on ? colors.accent : colors.inkTertiary,
            }}>
            {verb}
          </Text>
          <Ionicons
            name="chevron-expand-outline"
            size={11}
            color={on ? colors.accent : colors.inkTertiary}
          />
        </View>
        <Text
          numberOfLines={1}
          style={{
            flexShrink: 1,
            fontFamily: fonts.sansMedium,
            fontSize: 13,
            color: on ? colors.ink : colors.inkTertiary,
          }}>
          email to hiring manager
        </Text>
      </Pressable>
      <Pressable
        onPress={onToggle}
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        accessibilityLabel="Email the hiring manager on every apply"
        hitSlop={8}
        style={{
          width: TRACK_W,
          height: TRACK_H,
          borderRadius: TRACK_H / 2,
          backgroundColor: on ? colors.accent : colors.hairline,
          justifyContent: 'center',
          paddingHorizontal: 2,
        }}>
        <Animated.View
          style={[
            {
              width: THUMB,
              height: THUMB,
              borderRadius: THUMB / 2,
              backgroundColor: colors.paper,
            },
            thumbStyle,
          ]}
        />
      </Pressable>
    </View>
  );
}
