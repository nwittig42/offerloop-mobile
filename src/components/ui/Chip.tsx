import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { useColors } from '@/theme/ThemeProvider';
import { fonts, tint, type Palette } from '@/theme/tokens';

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
  | 'waiting'
  | 'marketing';

const toneColor = (c: Palette): Record<Exclude<ChipTone, 'neutral'>, string> => ({
  brand: c.navy,
  accent: c.accent,
  positive: c.positive,
  negative: c.negative,
  waiting: c.waiting,
  marketing: c.marketing,
});

export function Chip({
  label,
  tone = 'neutral',
  dot = false,
  icon,
  size = 'sm',
  numberOfLines,
}: {
  label: string;
  tone?: ChipTone;
  dot?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: 'sm' | 'lg';
  /** Clamp the label to N lines with an ellipsis (e.g. a long comp range). */
  numberOfLines?: number;
}) {
  const colors = useColors();
  const isNeutral = tone === 'neutral';
  const c = isNeutral ? null : toneColor(colors)[tone];
  const t = c ? tint(c) : null;
  const fg = c ?? colors.inkSecondary;
  const lg = size === 'lg';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: lg ? 7 : 5,
        borderRadius: lg ? 10 : 8,
        borderWidth: 1,
        paddingHorizontal: lg ? 14 : 10,
        paddingVertical: lg ? 9 : 2,
        alignSelf: 'flex-start',
        // Without this a long label (the ranker's reason sentences) sizes the
        // chip past its parent and the text runs off the card edge, clipped
        // mid-word. flexShrink on the Text below can only do its job once the
        // chip itself is allowed to stop growing.
        maxWidth: '100%',
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
      {icon ? <Ionicons name={icon} size={lg ? 17 : 12} color={fg} /> : null}
      <Text
        numberOfLines={numberOfLines}
        style={{
          flexShrink: 1,
          fontSize: lg ? 15.5 : 11,
          fontFamily: lg ? fonts.sansSemibold : fonts.sansMedium,
          color: fg,
        }}>
        {label}
      </Text>
    </View>
  );
}

export default Chip;
