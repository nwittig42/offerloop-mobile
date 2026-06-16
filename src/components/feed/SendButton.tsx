import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable } from 'react-native';

import { useColors } from '@/theme/ThemeProvider';

/**
 * The draft/send button: a vibrant blue circle with a baked-in gradient of
 * the brand blues (the looped blues of the Offerloop logo). Static, no
 * motion. The standout color makes it the obvious thing to tap.
 */
export function SendButton({
  onPress,
  disabled = false,
  size = 56,
}: {
  onPress?: () => void;
  disabled?: boolean;
  size?: number;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Draft outreach"
      style={{ opacity: disabled ? 0.4 : 1 }}>
      <LinearGradient
        colors={['#3B82F6', '#2563EB', '#4A60A8'] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name="paper-plane" size={size * 0.4} color={colors.paper} />
      </LinearGradient>
    </Pressable>
  );
}

export default SendButton;
