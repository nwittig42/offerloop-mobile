import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';

import { useColors } from '@/theme/ThemeProvider';
import { fonts, type Palette } from '@/theme/tokens';

/**
 * Web Button recipe: radius 8, 14px medium text, 8px gap, 16px icons.
 * Heights: default 36 (16px pad), sm 32 (12px pad, 13px text),
 * lg 44 (24px pad, 15px text), xs 28, icon 36x36.
 * The signature primary action is a vibrant blue fill (marketing blue).
 */

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'brand'
  | 'accent';

export type ButtonSize = 'xs' | 'sm' | 'default' | 'lg' | 'icon';

type ButtonProps = {
  label?: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  fullWidth?: boolean;
};

const SIZES: Record<
  ButtonSize,
  { height: number; paddingX: number; fontSize: number }
> = {
  xs: { height: 28, paddingX: 10, fontSize: 13 },
  sm: { height: 32, paddingX: 12, fontSize: 13 },
  default: { height: 36, paddingX: 16, fontSize: 14 },
  lg: { height: 44, paddingX: 24, fontSize: 15 },
  icon: { height: 36, paddingX: 0, fontSize: 14 },
};

function variantStyles(variant: ButtonVariant, pressed: boolean, colors: Palette) {
  switch (variant) {
    case 'primary':
      return {
        container: {
          backgroundColor: pressed ? '#2563EB' : colors.marketing,
          borderColor: 'transparent',
        },
        text: colors.paper,
      };
    case 'brand':
      return {
        container: {
          backgroundColor: pressed ? colors.navyDeep : colors.navy,
          borderColor: 'transparent',
        },
        text: colors.paper,
      };
    case 'accent':
      return {
        container: {
          backgroundColor: pressed ? colors.accent : colors.paper,
          borderColor: colors.accent,
        },
        text: pressed ? colors.paper : colors.accent,
      };
    case 'ghost':
      return {
        container: {
          backgroundColor: pressed ? colors.surface : 'transparent',
          borderColor: 'transparent',
        },
        text: colors.ink,
      };
    case 'secondary':
    case 'outline':
    default:
      return {
        container: {
          backgroundColor: pressed ? colors.paper2 : colors.paper,
          borderColor: colors.hairline,
        },
        text: colors.ink,
      };
  }
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'default',
  icon,
  disabled = false,
  fullWidth = false,
}: ButtonProps) {
  const colors = useColors();
  const [pressed, setPressed] = useState(false);
  const s = SIZES[size];
  const v = variantStyles(variant, pressed, colors);

  // A light tap so every button feels tactile.
  const handlePress = onPress
    ? () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }
    : undefined;

  const containerStyle: ViewStyle = {
    height: s.height,
    paddingHorizontal: size === 'icon' ? 0 : s.paddingX,
    width: size === 'icon' ? s.height : fullWidth ? '100%' : undefined,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    opacity: disabled ? 0.45 : 1,
    ...v.container,
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={containerStyle}
      accessibilityRole="button"
      accessibilityLabel={label}>
      {icon ? <Ionicons name={icon} size={16} color={v.text} /> : null}
      {label && size !== 'icon' ? (
        <Text
          // The button is a fixed height, so a label wider than the button
          // used to clip mid-word (a long label, a small phone, or Dynamic
          // Type at the 1.3 ceiling). Shrink to fit instead, down to 80%.
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={{
            color: v.text,
            fontSize: s.fontSize,
            fontFamily: fonts.sansMedium,
          }}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Round action circle for the Feed action row (pass, draft, undo, share). */
export function ActionCircle({
  icon,
  onPress,
  size = 56,
  tone = 'neutral',
  disabled = false,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  size?: number;
  tone?: 'neutral' | 'negative' | 'ink';
  disabled?: boolean;
  /** Required in practice: this button is icon-only, so without a label
   *  VoiceOver announces the raw glyph name ("settings-outline") or nothing.
   *  Optional in the type only so existing call sites keep compiling. */
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  const [pressed, setPressed] = useState(false);
  const tones = {
    neutral: { bg: colors.paper, fg: colors.inkSecondary, border: colors.hairline },
    negative: { bg: colors.negative + '14', fg: colors.negative, border: colors.negative + '26' },
    ink: { bg: colors.ink, fg: colors.paper, border: 'transparent' },
  } as const;
  const t = tones[tone];
  return (
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
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      }}>
      <Ionicons name={icon} size={size * 0.42} color={t.fg} />
    </Pressable>
  );
}

export default Button;
