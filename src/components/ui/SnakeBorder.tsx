import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/**
 * A vibrant dash that chases around a rounded-rect border as a progress cue.
 * The dash + gap sum to exactly the perimeter so the comet tiles once and loops
 * seamlessly. Size it to the parent (pass measured w/h from onLayout).
 */
export default function SnakeBorder({
  w,
  h,
  color,
  radius = 13,
  strokeWidth = 2.5,
  durationMs = 1500,
}: {
  w: number;
  h: number;
  color: string;
  radius?: number;
  strokeWidth?: number;
  durationMs?: number;
}) {
  const r = radius;
  const perim = 2 * (w + h) - 8 * r + 2 * Math.PI * r;
  const dash = perim * 0.32;
  const offset = useSharedValue(0);
  useEffect(() => {
    offset.value = 0;
    offset.value = withRepeat(withTiming(-perim, { duration: durationMs, easing: Easing.linear }), -1, false);
  }, [offset, perim, durationMs]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  if (w <= 0 || h <= 0) return null;
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      <AnimatedRect
        x={2}
        y={2}
        width={w - 4}
        height={h - 4}
        rx={r}
        ry={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={[dash, perim - dash]}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}
