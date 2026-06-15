import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/tokens';

/**
 * Fills the bottom tab bar with Apple's liquid glass on iOS 26+, so content
 * scrolling near it picks up the frosted material. Falls back to a clean
 * near-opaque white on older iOS and Android. Used as the Tabs
 * tabBarBackground; the bar itself is kept transparent so this shows.
 */
export function GlassTabBackground() {
  if (isLiquidGlassAvailable()) {
    return <GlassView glassEffectStyle="regular" style={StyleSheet.absoluteFill} />;
  }
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.94)' }]} />
  );
}

export default GlassTabBackground;
