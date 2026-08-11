import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
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

  // Social sign-in exists only when the native modules are in this binary
  // (build 19+). On older builds both checks fail closed, the Sign in button
  // goes straight to the email screen, and nothing else renders.
  const [appleReady, setAppleReady] = useState(false);
  const googleReady = googleSignInAvailable();
  const [socialBusy, setSocialBusy] = useState<'apple' | 'google' | null>(null);
  // One entry point, then a chooser sheet (Rylan 2026-08-11): the stacked
  // per-provider buttons read as clutter. The blue Sign in wears the logos;
  // tapping it offers Apple, Google, or email in one place.
  const [chooserOpen, setChooserOpen] = useState(false);
  const hasSocial = appleReady || googleReady;
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
    <View style={{ flex: 1, backgroundColor: colors.feedBg }}>
      {/* ScrollView + centered max-width column (App Review rejection
          2026-08-11, Guideline 4): on iPad the fixed flex layout overlapped
          into an unreadable pile. A scrolling column cannot overlap, and the
          width cap keeps it presentable on any screen. */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 36,
          paddingHorizontal: 28,
          paddingBottom: insets.bottom + 20,
        }}
        showsVerticalScrollIndicator={false}>
        <View style={{ flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
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

      <View style={{ flexGrow: 1, justifyContent: 'center', gap: 22, paddingVertical: 28 }}>
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
        {/* The single entry: when social providers exist it wears their
            logos and opens the chooser; on old builds it is the plain email
            Sign in button App Review already approved. */}
        <Pressable
          onPress={() => (hasSocial ? setChooserOpen(true) : router.push('/(auth)/sign-in'))}
          disabled={!!socialBusy}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
            backgroundColor: colors.ink,
            borderRadius: 8,
            paddingVertical: 15,
            opacity: socialBusy ? 0.8 : 1,
          }}>
          {socialBusy ? (
            <ActivityIndicator size="small" color={colors.paper} />
          ) : hasSocial ? (
            <>
              {appleReady ? <Ionicons name="logo-apple" size={18} color={colors.paper} /> : null}
              {googleReady ? <Ionicons name="logo-google" size={15} color={colors.paper} /> : null}
            </>
          ) : null}
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16.5, color: colors.paper }}>
            Sign in
          </Text>
        </Pressable>
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
      </ScrollView>

      {/* The sign-in chooser: Apple first (Guideline 4.8 prominence), then
          Google, then email. One sheet, one decision. */}
      <Modal
        visible={chooserOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setChooserOpen(false)}>
        <Pressable
          onPress={() => setChooserOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(10,14,25,0.5)', justifyContent: 'flex-end' }}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.paper,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              padding: 20,
              paddingBottom: insets.bottom + 24,
              gap: 10,
            }}>
            <Text
              style={{
                fontFamily: fonts.sansSemibold,
                fontSize: 16,
                color: colors.ink,
                textAlign: 'center',
                marginBottom: 4,
              }}>
              How do you want to sign in?
            </Text>
            {appleReady ? (
              <Pressable
                onPress={() => {
                  setChooserOpen(false);
                  void runSocial('apple');
                }}
                accessibilityRole="button"
                accessibilityLabel="Sign in with Apple"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: '#000000',
                  borderRadius: 8,
                  paddingVertical: 14,
                  opacity: 1,
                }}>
                <Ionicons name="logo-apple" size={19} color="#FFFFFF" />
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15.5, color: '#FFFFFF' }}>
                  Sign in with Apple
                </Text>
              </Pressable>
            ) : null}
            {googleReady ? (
              <Pressable
                onPress={() => {
                  setChooserOpen(false);
                  void runSocial('google');
                }}
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: colors.hairline,
                  borderRadius: 8,
                  paddingVertical: 14,
                  opacity: 1,
                }}>
                <Ionicons name="logo-google" size={17} color="#4285F4" />
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15.5, color: '#1F1F1F' }}>
                  Continue with Google
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                setChooserOpen(false);
                router.push('/(auth)/sign-in');
              }}
              accessibilityRole="button"
              accessibilityLabel="Continue with email"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                borderWidth: 1,
                borderColor: colors.hairline,
                borderRadius: 8,
                paddingVertical: 14,
                opacity: 1,
              }}>
              <Ionicons name="mail-outline" size={17} color={colors.ink} />
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15.5, color: colors.ink }}>
                Continue with email
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
