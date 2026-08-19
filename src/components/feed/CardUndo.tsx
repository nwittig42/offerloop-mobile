import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { useColors } from '@/theme/ThemeProvider';

/**
 * Undo, docked on the deck card's top-left corner (Rylan 2026-08-18 round 3:
 * "put it actually on the card, more opaque"). Solid paper, real shadow,
 * only rendered when there is something to bring back. Passes only, on both
 * decks: commits spend credits and cannot be unspent.
 */
export default function CardUndo({
  onPress,
  visible,
}: {
  onPress: () => void;
  visible: boolean;
}) {
  const colors = useColors();
  const [pressed, setPressed] = useState(false);
  if (!visible) return null;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel="Bring back the last card you passed"
      hitSlop={8}
      style={{
        position: 'absolute',
        top: 22,
        left: 30,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.paper,
        borderWidth: 1,
        borderColor: colors.hairline,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOpacity: 0.18,
        shadowRadius: 7,
        shadowOffset: { width: 0, height: 3 },
        elevation: 5,
        transform: [{ scale: pressed ? 0.92 : 1 }],
        zIndex: 20,
      }}>
      <Ionicons name="arrow-undo" size={19} color={colors.ink} />
    </Pressable>
  );
}
