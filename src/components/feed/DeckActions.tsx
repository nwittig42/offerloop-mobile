import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type AnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { useColors } from '@/theme/ThemeProvider';

/**
 * The deck's floating verbs, riding the card's bottom edge (Rylan 2026-08-18:
 * "bring back the red X and the checkmark... super apparent, almost dumb...
 * overlap with the card a little, floating"). Deliberately louder than the
 * design system's quiet outlines: these two circles are the screen's primary
 * actions and they dress like it, vibrant red and vibrant blue.
 *
 * They mirror the live drag: dragging left grows the X, dragging right grows
 * the commit circle, so the buttons and the gesture read as one system.
 *
 * Static Pressable styles + pressed state only; release builds strip
 * function-form Pressable styles (App Store rejection #6).
 */

function Circle({
  size,
  onPress,
  disabled = false,
  accessibilityLabel,
  children,
  growStyle,
  shadow,
}: {
  size: number;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  children: React.ReactNode;
  growStyle?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
  shadow?: string;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Animated.View style={growStyle}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: disabled ? 0.35 : 1,
          transform: [{ scale: pressed ? 0.92 : 1 }],
          shadowColor: shadow ?? '#000000',
          shadowOpacity: shadow ? 0.38 : 0.16,
          shadowRadius: shadow ? 10 : 6,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

export default function DeckActions({
  drag,
  onPass,
  onCommit,
  commitIcon,
  passLabel,
  commitLabel,
}: {
  /** The deck's live horizontal drag, for the grow-with-the-gesture read. */
  drag?: SharedValue<number>;
  onPass: () => void;
  onCommit: () => void;
  /** Concrete verb per deck: checkmark = apply, pencil = draft,
   *  paper-plane = send, bookmark = save. Never a decorative glyph. */
  commitIcon: 'checkmark' | 'pencil' | 'paper-plane' | 'bookmark';
  passLabel: string;
  commitLabel: string;
}) {
  const colors = useColors();

  const passGrow = useAnimatedStyle(() => ({
    transform: [
      {
        scale: drag
          ? interpolate(drag.value, [-130, 0, 130], [1.22, 1, 0.88], Extrapolation.CLAMP)
          : 1,
      },
    ],
  }));
  const commitGrow = useAnimatedStyle(() => ({
    transform: [
      {
        scale: drag
          ? interpolate(drag.value, [-130, 0, 130], [0.88, 1, 1.22], Extrapolation.CLAMP)
          : 1,
      },
    ],
  }));

  return (
    <View
      pointerEvents="box-none"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
      }}>
      {/* Undo left this row (Rylan 2026-08-18 round 3): it lives on the
          card's top-left corner now, so the X and commit sit centered as a
          true pair. */}
      <Circle
        size={60}
        onPress={onPass}
        accessibilityLabel={passLabel}
        growStyle={passGrow}
        shadow="#EF4444">
        <View
          style={{
            flex: 1,
            borderRadius: 30,
            backgroundColor: '#EF4444',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="close" size={30} color="#FFFFFF" />
        </View>
      </Circle>
      <Circle
        size={60}
        onPress={onCommit}
        accessibilityLabel={commitLabel}
        growStyle={commitGrow}
        shadow="#3B82F6">
        <LinearGradient
          colors={['#4B8AF9', '#3B82F6', '#2563EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flex: 1,
            borderRadius: 30,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name={commitIcon} size={28} color="#FFFFFF" />
        </LinearGradient>
      </Circle>
    </View>
  );
}
