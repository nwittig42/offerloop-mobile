import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';

import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/ThemeProvider';

/** Best-effort domain guess from a company name: "Cloudflare" -> cloudflare.com,
 *  "Goldman Sachs" -> goldmansachs.com. Used only to fetch a logo; a wrong guess
 *  404s on the CDN and falls through to the next source, never a wrong logo. */
function guessDomain(name: string): string | null {
  const slug = (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return slug ? `${slug}.com` : null;
}

/**
 * Company logo. Tries, in order: a real logo URL from the backend
 * (employer_logo), then Clearbit's logo CDN by guessed domain, then Google's
 * favicon service, and finally a clean initial tile. Each image that fails to
 * load advances to the next source, so a missing/blocked logo degrades quietly
 * to the letter rather than a broken image.
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

  const domain = guessDomain(name);
  const sources = [
    logoUrl,
    domain ? `https://logo.clearbit.com/${domain}` : undefined,
    domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : undefined,
  ].filter((s): s is string => !!s);

  const [idx, setIdx] = useState(0);
  // Reset to the first source when the company (or its real logo) changes, so a
  // recycled card doesn't keep a previous company's "all sources failed" state.
  useEffect(() => {
    setIdx(0);
  }, [logoUrl, domain]);

  const uri = sources[idx];

  if (uri) {
    return (
      <Image
        source={{ uri }}
        onError={() => setIdx((i) => i + 1)}
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
        {(name || '?').charAt(0)}
      </Text>
    </View>
  );
}

export default CompanyLogo;
