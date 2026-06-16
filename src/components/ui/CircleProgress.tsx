import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * A small ring gauge (Sorce-style). Draws a track plus a colored arc for the
 * progress, with an optional centered label (e.g. "47%"). The Svg is rotated
 * so the arc starts at the top; the label sits upright on top of it.
 */
export function CircleProgress({
  size = 54,
  strokeWidth = 5,
  progress,
  color,
  label,
}: {
  size?: number;
  strokeWidth?: number;
  progress: number;
  color: string;
  label?: string;
}) {
  const colors = useColors();
  const clamped = Math.max(0, Math.min(1, progress));
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.hairline}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </Svg>
      {label != null ? (
        <Text style={{ fontFamily: fonts.sansSemibold, fontSize: size * 0.27, color: colors.ink }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

export default CircleProgress;
