import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { fonts } from '@/theme/tokens';

/**
 * The vibrant blue -> indigo -> purple call-to-action, used for the "go to the
 * web" prompts (and other moments that deserve the loud button). Same gradient
 * family as the Loop cards, credits surfaces, and the cooldown CTA, so the
 * web-funnel button reads consistently everywhere. White label + icon.
 */
const GRADIENT = ['#2563EB', '#4F46E5', '#7C3AED'] as const;

export function GradientButton({
  label,
  icon,
  onPress,
  fullWidth = false,
  size = 'default',
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  fullWidth?: boolean;
  size?: 'default' | 'lg';
}) {
  const [pressed, setPressed] = useState(false);
  const lg = size === 'lg';

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ alignSelf: fullWidth ? 'stretch' : 'flex-start', opacity: pressed ? 0.9 : 1 }}>
      <LinearGradient
        colors={GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          borderRadius: 12,
          paddingHorizontal: lg ? 24 : 18,
          paddingVertical: lg ? 14 : 12,
        }}>
        <Text style={{ fontFamily: fonts.sansSemibold, fontSize: lg ? 15.5 : 14.5, color: '#FFFFFF' }}>
          {label}
        </Text>
        {icon ? <Ionicons name={icon} size={lg ? 17 : 15} color="#FFFFFF" /> : null}
      </LinearGradient>
    </Pressable>
  );
}

export default GradientButton;
