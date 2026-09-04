import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Text } from 'react-native';

import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/ThemeProvider';

/**
 * An iMessage-style avatar: the person's photo when we hold a live URL, a
 * soft blue gradient circle with white initials otherwise.
 *
 * Photo URLs are LinkedIn-CDN hotlinks with expiry tokens (weeks to months of
 * life), so the fallback is not an edge case, it is the planned second act:
 * the moment a link dies, the row quietly returns to initials. People stay
 * people either way — company logos never stand in for a face (Rylan
 * 2026-08-27).
 */
export function Avatar({ name, photoUrl, size = 48 }: { name: string; photoUrl?: string; size?: number }) {
  const colors = useColors();
  const [broken, setBroken] = useState(false);
  const initials = name
    .split(' ')
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // LinkedIn serves a generic grey silhouette (static.licdn.com/aero-v1/...)
  // for people with no photo, and the vendors pass that URL through. Four of
  // nine contacts in the 2026-09-03 test carried it. Initials read as a
  // person; the silhouette reads as a broken app.
  const placeholder = !!photoUrl && /static\.licdn\.com\/aero-v1\//.test(photoUrl);
  if (photoUrl && !broken && !placeholder) {
    return (
      <Image
        source={{ uri: photoUrl }}
        onError={() => setBroken(true)}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface }}
        accessibilityLabel={name}
      />
    );
  }

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
