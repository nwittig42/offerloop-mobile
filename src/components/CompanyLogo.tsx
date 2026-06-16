import { Image, Text, View } from 'react-native';

import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/ThemeProvider';

/**
 * Company logo. Renders the real logo when we have a URL, otherwise a clean
 * initial tile. Our fixture companies are fake, so they have no logoUrl and
 * fall back to the letter, which is honest: a real logo only ever shows for
 * real company data (Phase 3).
 */
export function CompanyLogo({
  name,
  logoUrl,
  size = 40,
  radius,
}: {
  name: string;
  logoUrl?: string;
  size?: number;
  radius?: number;
}) {
  const colors = useColors();
  const r = radius ?? Math.round(size * 0.26);

  if (logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: r,
          borderWidth: 1,
          borderColor: colors.hairline,
          backgroundColor: colors.paper,
        }}
        resizeMode="contain"
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r,
        backgroundColor: colors.paper2,
        borderWidth: 1,
        borderColor: colors.hairline,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: size * 0.4, color: colors.navy }}>
        {name.charAt(0)}
      </Text>
    </View>
  );
}

export default CompanyLogo;
