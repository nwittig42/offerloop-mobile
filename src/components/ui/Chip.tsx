import { Text, View } from 'react-native';

import { colors, fonts, tint } from '@/theme/tokens';

/**
 * Web Badge recipe: radius 8, 11px medium text, 10px by 2px padding, thin border.
 * Soft tint: roughly 8 percent fill and 15 percent border of the tone color.
 * Neutral chips: paper-2 fill with secondary-ink text. Optional leading dot.
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
}: {
  label: string;
  tone?: ChipTone;
  dot?: boolean;
}) {
  const isNeutral = tone === 'neutral';
  const c = isNeutral ? null : TONE_COLOR[tone];
  const t = c ? tint(c) : null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 2,
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
            backgroundColor: c ?? colors.inkSecondary,
          }}
        />
      ) : null}
      <Text
        style={{
          fontSize: 11,
          fontFamily: fonts.sansMedium,
          color: c ?? colors.inkSecondary,
        }}>
        {label}
      </Text>
    </View>
  );
}

export default Chip;
