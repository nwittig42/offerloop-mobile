import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useColors } from '@/theme/ThemeProvider';

/**
 * The pass (left swipe) button, given a chunkier, more playful look than a
 * plain icon: two thick rounded bars forming a hand-drawn X that bounces on
 * press. Sits in the Feed action bar next to the draft button.
 */
export function PlayfulPass({ onPress, size = 56 }: { onPress?: () => void; size?: number }) {
  const colors = useColors();
  const [pressed, setPressed] = useState(false);
  const bar = {
    position: 'absolute' as const,
    width: size * 0.42,
    height: size * 0.13,
    borderRadius: size * 0.13,
    backgroundColor: colors.negative,
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel="Pass"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.negative + '14',
        borderWidth: 1,
        borderColor: colors.negative + '26',
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pressed ? 0.9 : 1 }, { rotate: pressed ? '-8deg' : '0deg' }],
      }}>
      <View style={[bar, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[bar, { transform: [{ rotate: '-45deg' }] }]} />
    </Pressable>
  );
}

export default PlayfulPass;
