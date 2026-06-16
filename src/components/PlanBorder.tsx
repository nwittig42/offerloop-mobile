import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useColors } from '@/theme/ThemeProvider';

/**
 * An animated gradient border that signals the user's plan, the only plan
 * indicator (no text label). The gradient slowly rotates so the color rolls
 * around the edge. Free is a plain black ring (no animation), Pro the brand
 * blues, Elite a purple gradient. The inner surface masks all but the ring.
 */
type Plan = 'Free' | 'Pro' | 'Elite';

const PLAN_COLORS: Record<Exclude<Plan, 'Free'>, readonly [string, string, ...string[]]> = {
  Pro: ['#3B82F6', '#4A60A8', '#2563EB', '#3B82F6'],
  Elite: ['#7C3AED', '#A855F7', '#6D28D9', '#7C3AED'],
};

export function PlanBorder({
  plan,
  children,
  radius = 9,
  borderWidth = 1.5,
  surface: surfaceProp,
}: {
  plan: Plan;
  children: ReactNode;
  radius?: number;
  borderWidth?: number;
  surface?: string;
}) {
  const colors = useColors();
  const surface = surfaceProp ?? colors.paper2;
  const spin = useSharedValue(0);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1, false);
  }, [spin]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  if (plan === 'Free') {
    return (
      <View
        style={{
          borderRadius: radius,
          borderWidth: 1.5,
          borderColor: colors.ink,
          overflow: 'hidden',
        }}>
        {children}
      </View>
    );
  }

  // The rotating gradient must cover the box at every angle, so its square
  // side is the box diagonal.
  const side = Math.ceil(Math.hypot(box.w, box.h)) || 1;

  return (
    <View
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{ borderRadius: radius, overflow: 'hidden' }}>
      {box.w > 0 ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: side,
              height: side,
              left: (box.w - side) / 2,
              top: (box.h - side) / 2,
            },
            spinStyle,
          ]}>
          <LinearGradient
            colors={PLAN_COLORS[plan]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      ) : null}
      <View
        style={{
          margin: borderWidth,
          borderRadius: Math.max(0, radius - borderWidth),
          backgroundColor: surface,
          overflow: 'hidden',
        }}>
        {children}
      </View>
    </View>
  );
}

export default PlanBorder;
