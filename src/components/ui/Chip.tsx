import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { colors, fonts, tint } from '@/theme/tokens';

/**
 * Web Badge recipe: radius 8, 11px medium text, 10px by 2px padding, thin border.
 * Soft tint: roughly 8 percent fill and 15 percent border of the tone color.
 * Neutral chips: paper-2 fill with secondary-ink text. Optional leading dot.
 *
 * size 'lg' is the enlarged, glanceable feed chip (Sorce style): bigger
 * text and padding, optional leading icon.
 */
export type ChipTone =
  | 'neutral'
  | 'brand'
  | 'accent'
  | 'positive'
  | 'negative'
  | 'waiting';

const TONE_COLOR: Record<Exclude<ChipTone, 'neutral'>, string> = {
  brand: colors.navy,
  accent: colors.accent,
  positive: colors.positive,
  negative: colors.negative,
  waiting: colors.waiting,
};

export function Chip({
  label,
  tone = 'neutral',
  dot = false,
  icon,
  size = 'sm',
}: {
  label: string;
  tone?: ChipTone;
  dot?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: 'sm' | 'lg';
}) {
  const isNeutral = tone === 'neutral';
  const c = isNeutral ? null : TONE_COLOR[tone];
  const t = c ? tint(c) : null;
  const fg = c ?? colors.inkSecondary;
  const lg = size === 'lg';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: lg ? 6 : 5,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: lg ? 12 : 10,
        paddingVertical: lg ? 7 : 2,
        alignSelf: 'flex-start',
        backgroundColor: t ? t.fill : colors.paper2,
        borderColor: t ? t.border : colors.hairline,
      }}>
      {dot ? (
        <View
          style={{
            width: 5,
            height: 5,
            borderRadius: 2.5,
            backgroundColor: fg,
          }}
        />
      ) : null}
      {icon ? <Ionicons name={icon} size={lg ? 15 : 12} color={fg} /> : null}
      <Text
        style={{
          fontSize: lg ? 14 : 11,
          fontFamily: lg ? fonts.sansSemibold : fonts.sansMedium,
          color: fg,
        }}>
        {label}
      </Text>
    </View>
  );
}

export default Chip;
