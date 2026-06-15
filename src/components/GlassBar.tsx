import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { colors, shadows } from '@/theme/tokens';

/**
 * A floating bar with Apple's liquid glass effect on iOS 26+. On anything
 * older (or Android) it falls back to a soft, near-opaque white surface so
 * the layout is identical and the buttons stay legible. Used for the Feed
 * action row.
 */
export function GlassBar({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  const radius = 30;

  if (isLiquidGlassAvailable()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        isInteractive
        style={[
          {
            borderRadius: radius,
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          },
          style,
        ]}>
        {children}
      </GlassView>
    );
  }

  return (
    <View
      style={[
        {
          borderRadius: radius,
          paddingHorizontal: 14,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.86)',
          borderWidth: 1,
          borderColor: colors.hairlineLight,
        },
        shadows.lg,
        style,
      ]}>
      {children}
    </View>
  );
}

export default GlassBar;
