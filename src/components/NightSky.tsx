import { LinearGradient } from 'expo-linear-gradient';
import { Image, View, type DimensionValue } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { darkSky } from '@/theme/tokens';

const RIDGES = require('../../assets/images/scout-ridges-night.png');

/**
 * Scout's night room as an app-wide dark-mode backdrop (Rylan 2026-08-10):
 * the same sky gradient and watercolor ridgeline the Scout tab draws, so a
 * dark screen feels like the same place instead of an inverted light screen.
 * Renders nothing in light mode. Place it first inside a screen's root View;
 * it absorbs no touches. Defaults are slightly subtler than the Scout tab
 * (0.9 opacity, 44% ridge) so list content stays readable over it.
 */
export default function NightSky({
  ridgeHeight = '38%',
  ridgeOpacity = 0.7,
}: {
  ridgeHeight?: DimensionValue;
  ridgeOpacity?: number;
}) {
  const { pref } = useTheme();
  if (pref !== 'dark') return null;

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <LinearGradient colors={[darkSky.top, darkSky.mid, darkSky.bottom]} style={{ flex: 1 }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: ridgeHeight }}>
        <Image
          source={RIDGES}
          resizeMode="cover"
          style={{ width: '100%', height: '100%', opacity: ridgeOpacity }}
        />
      </View>
    </View>
  );
}
