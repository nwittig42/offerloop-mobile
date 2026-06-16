import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Linking, Pressable, Text, View } from 'react-native';

import { useColors, useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Shown over the greyed-out deck when swipes run out: Scout waits next to a
 * big countdown to the next batch, with the web escape hatch (bulk outreach
 * has no pacing on the site). Framed as a breather, not a wall.
 *
 * A translucent light-blue wash sits over the dimmed deck: enough to keep the
 * copy legible, sheer enough that the job card still shows through behind it.
 */
function fmt(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function CooldownView({
  secondsLeft,
  onRecharge,
}: {
  secondsLeft: number;
  onRecharge: () => void;
}) {
  const colors = useColors();
  const { scheme } = useTheme();
  const dark = scheme === 'dark';

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
        gap: 16,
        overflow: 'hidden',
      }}>
      {/* Sheer light-blue wash: legible copy, job card still visible behind. */}
      <LinearGradient
        colors={
          dark
            ? (['rgba(22,41,74,0.62)', 'rgba(16,26,51,0.56)'] as const)
            : (['rgba(220,232,255,0.62)', 'rgba(238,243,255,0.54)'] as const)
        }
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Image
          source={require('../../../assets/images/scout-prep.png')}
          style={{ width: 96, height: 78 }}
          resizeMode="contain"
        />
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 46, color: colors.marketing, lineHeight: 50 }}>
            {fmt(secondsLeft)}
          </Text>
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.inkSecondary }}>
            until your next swipes
          </Text>
        </View>
      </View>

      <Text
        style={{
          fontFamily: fonts.sansMedium,
          fontSize: 13.5,
          color: colors.ink,
          textAlign: 'center',
          lineHeight: 20,
          maxWidth: 300,
        }}>
        Scout is lining up your next batch. We space your outreach out so it lands in
        inboxes, not spam.
      </Text>

      <Pressable onPress={() => Linking.openURL('https://offerloop.ai')} accessibilityRole="button">
        <LinearGradient
          colors={['#2563EB', '#4F46E5', '#7C3AED'] as const}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderRadius: 12,
            paddingHorizontal: 20,
            paddingVertical: 12,
          }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: '#FFFFFF' }}>
            Keep going on offerloop.ai
          </Text>
          <Ionicons name="open-outline" size={15} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>

      <Pressable onPress={onRecharge} style={{ padding: 6 }}>
        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.inkTertiary }}>
          Recharge now (demo)
        </Text>
      </Pressable>
    </View>
  );
}

export default CooldownView;
