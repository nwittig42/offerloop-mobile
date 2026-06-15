import { LinearGradient } from 'expo-linear-gradient';
import { Text } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

/**
 * An iMessage-style avatar: a soft blue gradient circle with white initials.
 * Keeps the contact list familiar to anyone who uses Messages.
 */
export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <LinearGradient
      colors={['#7CA0E6', '#4A60A8'] as const}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: size * 0.36, color: colors.paper }}>
        {initials}
      </Text>
    </LinearGradient>
  );
}

export default Avatar;
