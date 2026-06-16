import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

/**
 * Fills the bottom tab bar with Apple's liquid glass on iOS 26+, so content
 * scrolling near it picks up the frosted material. Falls back to a clean
 * near-opaque surface on older iOS and Android. Used as the Tabs
 * tabBarBackground; the bar itself is kept transparent so this shows.
 *
 * Both paths carry a cool blue tint so the bar reads slightly blue rather than
 * a plain surface. In dark mode the fallback is a deep navy and the glass tint
 * lifts a touch so it stays visible against the dark material.
 */
export function GlassTabBackground() {
  const { scheme } = useTheme();
  const dark = scheme === 'dark';

  if (isLiquidGlassAvailable()) {
    return (
      <GlassView
        glassEffectStyle={dark ? 'clear' : 'regular'}
        tintColor={dark ? 'rgba(108,140,210,0.22)' : 'rgba(74,96,168,0.16)'}
        style={StyleSheet.absoluteFill}
      />
    );
  }
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: dark ? 'rgba(20,27,42,0.96)' : 'rgba(219,231,255,0.95)' },
      ]}
    />
  );
}

export default GlassTabBackground;
