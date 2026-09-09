import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PrimaryCta from '@/components/ui/PrimaryCta';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * First-download welcome. One idea, one focal point, then two ways forward.
 *
 * Order note (2026-08-13, revised): the account comes FIRST, then the resume,
 * then the feed preview. An earlier version put intake ahead of the account so
 * value landed before the ask; that needed the resume builder opened to
 * signed-out callers, a holding pen for everything collected, and a flush after
 * sign-up. With Apple and Google the wall is two taps, so Nick took the
 * simpler shape: the intake steps moved into (onboarding), and all of that
 * machinery went away. Registration still happens in-app, never in the browser
 * (App Review guideline 4; the web-first flow was rejected 2026-08-05).
 *
 * The previous version of this screen was a left-aligned wordmark, a vague
 * tagline, and three disconnected icon rows, with "Sign in" as the loud button
 * on a screen almost nobody reaches already having an account.
 */

export default function WelcomeScreen() {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Plain paper ground (Nick 2026-08-13): the floated icon reads cleanest on
  // white. Dark keeps the night sky, since white would be a flashbang on open.
  const screenBg = scheme === 'dark' ? colors.surface : colors.paper;

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      {/* ScrollView + centered max-width column (App Review rejection
          2026-08-11, Guideline 4): on iPad the fixed flex layout overlapped
          into an unreadable pile. A scrolling column cannot overlap, and the
          width cap keeps it presentable on any screen. */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 32,
          paddingHorizontal: 24,
          paddingBottom: 16,
        }}
        showsVerticalScrollIndicator={false}>
        <View style={{ flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
          <View style={{ alignItems: 'center', paddingTop: 96 }}>
            {/* The home-screen app icon with its baked white ground unmultiplied
                out (assets/images/offerloop-icon-float.png, generated from
                icon.png): the mark and its soft drop shadow survive as real
                alpha, so it floats on any ground with no tile around it. Native
                aspect is 720x817, keep the ratio when resizing. */}
            <Image
              source={require('../../../assets/images/offerloop-icon-float.png')}
              style={{ width: 172, height: 195 }}
              resizeMode="contain"
              accessibilityLabel="Offerloop"
            />

            {/* Instrument Serif ships Regular only (see useFonts in
                app/_layout), so there is no heavier cut to reach for, and size
                is capped by the two-line rule: past about 40 the first line
                wraps and the headline becomes three lines. adjustsFontSizeToFit
                holds that line on the 375pt SE. */}
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              numberOfLines={2}
              style={{
                fontFamily: fonts.display,
                fontSize: 40,
                lineHeight: 44,
                color: colors.heading,
                textAlign: 'center',
                marginTop: 32,
              }}>
              An assistant for your{'\n'}
              <Text style={{ color: colors.marketing }}>entire job search</Text>
            </Text>

            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 15,
                lineHeight: 22,
                color: colors.inkSecondary,
                textAlign: 'center',
                marginTop: 16,
              }}>
              Finds the jobs. Emails people there. Applies for you. Preps you. Keeps you
              organized.
            </Text>
          </View>

        </View>
      </ScrollView>

      {/* Pinned footer, outside the scroll (Rylan 2026-09-08: "Get started"
          looked missing on first open). It used to sit at the bottom of the
          scrolling column, which on smaller phones put it below the fold. A
          fixed footer is on screen on every phone, no scrolling required. */}
      <View
        style={{
          width: '100%',
          maxWidth: 560,
          alignSelf: 'center',
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: insets.bottom + 16,
          gap: 16,
          backgroundColor: screenBg,
        }}>
        <PrimaryCta label="Get started" onPress={() => router.push('/(auth)/create-account')} />

        <Pressable
          onPress={() => router.push('/(auth)/sign-in')}
          accessibilityRole="button"
          accessibilityLabel="Sign in to an existing account"
          style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 14.5,
              color: colors.inkSecondary,
              textAlign: 'center',
            }}>
            Already have an account?{' '}
            <Text style={{ fontFamily: fonts.sansSemibold, color: colors.marketing }}>
              Sign in
            </Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
