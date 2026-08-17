import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

/**
 * Fills the bottom tab bar with Apple's liquid glass on iOS 26+, so content
 * scrolling near it picks up the frosted material. Falls back to a clean
 * near-opaque surface on older iOS and Android. Used as the Tabs
 * tabBarBackground; the bar itself is kept transparent so this shows.
 *
 * Light mode is WHITE (Nick 2026-08-14). It used to carry a cool blue tint on
 * both paths, which read as lavender against the near-white feed and made the
 * nav look like a separate coloured band rather than a surface the app sits on.
 * Dark mode is unchanged: its fallback is a deep navy and the glass tint lifts
 * a touch so it stays visible against the dark material.
 */
export function GlassTabBackground() {
  const { scheme } = useTheme();
  const dark = scheme === 'dark';

  if (isLiquidGlassAvailable()) {
    return (
      <GlassView
        glassEffectStyle={dark ? 'clear' : 'regular'}
        // A white tint still frosts and still picks up content scrolling under
        // it; it just does so without pulling the bar blue.
        tintColor={dark ? 'rgba(108,140,210,0.22)' : 'rgba(255,255,255,0.72)'}
        style={StyleSheet.absoluteFill}
      />
    );
  }
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: dark ? 'rgba(20,27,42,0.96)' : 'rgba(255,255,255,0.97)' },
      ]}
    />
  );
}

export default GlassTabBackground;
