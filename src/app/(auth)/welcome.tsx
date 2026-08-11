import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  appleSignInAvailable,
  googleSignInAvailable,
  signInWithAppleNative,
  signInWithGoogleNative,
} from '@/auth/socialSignIn';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * First-download welcome. Sells the hero, then forks: returning users sign in,
 * brand-new users create their account IN the app (App Review guideline 4:
 * registration may not punt to the browser; the web-first flow was rejected
 * 2026-08-05). Onboarding and profile setup run natively after sign-up.
 */

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { icon: 'albums-outline', title: 'Swipe to draft', body: 'Right-swipe a job and Offerloop drafts a tailored intro to someone there.' },
  { icon: 'mic-outline', title: 'Just ask Scout', body: 'Talk or type — Scout finds the right people, drafts the intro, and preps you for the chat.' },
  { icon: 'mail-outline', title: 'Replies in one place', body: 'Drafts, sends, and replies land in an inbox built for fast follow-ups.' },
];

export default function WelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Social buttons exist only when the native modules are in this binary
  // (build 17+). On older builds both checks fail closed and the screen is
  // exactly the email flow that App Review already approved.
  const [appleReady, setAppleReady] = useState(false);
  const googleReady = googleSignInAvailable();
  const [socialBusy, setSocialBusy] = useState<'apple' | 'google' | null>(null);
  useEffect(() => {
    let alive = true;
    void appleSignInAvailable().then((ok) => {
      if (alive) setAppleReady(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  const runSocial = async (which: 'apple' | 'google') => {
    if (socialBusy) return;
    setSocialBusy(which);
    try {
      const result =
        which === 'apple' ? await signInWithAppleNative() : await signInWithGoogleNative();
      // 'ok' flips auth state and the gate routes onward; 'cancelled' is quiet.
      if (result === 'cancelled') return;
    } catch (e) {
      Alert.alert(
        'Could not sign you in',
        e instanceof Error ? e.message : 'Something went wrong. Try again.',
      );
    } finally {
      setSocialBusy(null);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.feedBg,
        paddingTop: insets.top + 36,
        paddingHorizontal: 28,
        paddingBottom: insets.bottom + 20,
      }}>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <Image
          source={require('../../../assets/images/offerloop-logo.png')}
          style={{ width: 150, height: 37 }}
          resizeMode="contain"
          accessibilityLabel="Offerloop"
        />
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 30,
            color: colors.heading,
            textAlign: 'center',
            lineHeight: 34,
            marginTop: 4,
          }}>
          Your recruiting, in your pocket
        </Text>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', gap: 22 }}>
        {FEATURES.map((f) => (
          <View key={f.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.marketing + '14',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name={f.icon} size={21} color={colors.marketing} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15.5, color: colors.ink }}>
                {f.title}
              </Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 19 }}>
                {f.body}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ gap: 12 }}>
        {/* Sign in with Apple first and equally prominent (Guideline 4.8 +
            Apple HIG). Both buttons are one tap into the same account system
            as email; Firebase links providers by address. */}
        {appleReady ? (
          <Pressable
            onPress={() => void runSocial('apple')}
            disabled={!!socialBusy}
            accessibilityRole="button"
            accessibilityLabel="Sign in with Apple"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: '#000000',
              borderRadius: 8,
              paddingVertical: 15,
              opacity: pressed || socialBusy ? 0.75 : 1,
            })}>
            {socialBusy === 'apple' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="logo-apple" size={19} color="#FFFFFF" />
            )}
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: '#FFFFFF' }}>
              Sign in with Apple
            </Text>
          </Pressable>
        ) : null}
        {googleReady ? (
          <Pressable
            onPress={() => void runSocial('google')}
            disabled={!!socialBusy}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: colors.hairline,
              borderRadius: 8,
              paddingVertical: 15,
              opacity: pressed || socialBusy ? 0.75 : 1,
            })}>
            {socialBusy === 'google' ? (
              <ActivityIndicator size="small" color={colors.ink} />
            ) : (
              <Ionicons name="logo-google" size={17} color="#4285F4" />
            )}
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: '#1F1F1F' }}>
              Continue with Google
            </Text>
          </Pressable>
        ) : null}
        {appleReady || googleReady ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.hairline }} />
            <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
              or use email
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.hairline }} />
          </View>
        ) : null}
        <Button
          label="Sign in"
          variant="primary"
          size="lg"
          fullWidth
          onPress={() => router.push('/(auth)/sign-in')}
        />
        <Button
          label="Create your account"
          variant="outline"
          size="lg"
          fullWidth
          onPress={() => router.push('/(auth)/create-account')}
        />
        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 12.5,
            color: colors.inkTertiary,
            textAlign: 'center',
            lineHeight: 18,
          }}>
          New here? Set up takes about a minute, right in the app.
        </Text>
      </View>
    </View>
  );
}
