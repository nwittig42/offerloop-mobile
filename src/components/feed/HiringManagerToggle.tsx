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

/**
 * The one control that changes what a right swipe MEANS.
 *
 * History, because this has been rebuilt three times:
 *  - A narrow two-line "Email / HM" pill: cramped and abbreviated.
 *  - A label + ON/OFF badge + an (i) button: too much furniture for ~260pt, so
 *    the LABEL clamped, to "Email hiring mana...".
 *  - A three-state Off/Draft/Send pill: read as a mystery box.
 *
 * Now it is the shape this always should have been: a settings row. A label and
 * a switch, drawn on the glass bar itself with no pill, no outline, no fill
 * (Nick 2026-08-16: "that skinny black or dark gray circle that goes around
 * everything, I want to get rid of that"). The bar IS the container; wrapping a
 * bordered pill inside a bordered bar drew the same box twice.
 *
 * Draft-versus-send is no longer squeezed into this control. It appears as its
 * own row underneath (DraftSendChoice) when, and only when, this is on, which
 * is the only time the question means anything.
 *
 * The switch is drawn rather than react-native's, so it renders identically on
 * both platforms and takes the app's accent instead of iOS system green.
 */
export default function HiringManagerToggle({
  on,
  onPress,
}: {
  on: boolean;
  onPress: () => void;
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

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityLabel="Email the hiring manager on swipe"
      accessibilityState={{ checked: on }}
      accessibilityHint={
        on
          ? 'On. A right swipe applies and also emails the hiring manager.'
          : 'Off. A right swipe only submits the application.'
      }
      style={{ flex: 1, height: 46, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Ionicons name="mail-outline" size={17} color={on ? colors.accent : colors.inkSecondary} />
      {/* One line. It has room now, but keep the clamp for Dynamic Type: a
          clamped label beats a switch shoved off the edge of the bar. */}
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={1.15}
        style={{
          flex: 1,
          fontFamily: on ? fonts.sansSemibold : fonts.sansMedium,
          fontSize: 14,
          color: colors.ink,
        }}>
        Email hiring manager
      </Text>

      {/* Not touchable itself: the whole row is the target, so a tap on the
          track and a tap on the label do the same thing. */}
      <View
        pointerEvents="none"
        style={{
          width: TRACK_W,
          height: TRACK_H,
          borderRadius: TRACK_H / 2,
          padding: 2,
          justifyContent: 'center',
          backgroundColor: on ? colors.accent : colors.surface,
          borderWidth: on ? 0 : 1,
          borderColor: colors.hairline,
        }}>
        <Animated.View
          style={[
            {
              width: THUMB,
              height: THUMB,
              borderRadius: THUMB / 2,
              backgroundColor: '#FFFFFF',
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 2,
              shadowOffset: { width: 0, height: 1 },
              elevation: 2,
            },
            thumbStyle,
          ]}
        />
      </View>
    </Pressable>
  );
}
