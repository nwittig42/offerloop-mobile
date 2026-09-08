import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Linking, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import SocialAuthButtons, { useSocialAvailable } from '@/components/auth/SocialAuthButtons';
import { Button } from '@/components/ui/Button';
import PasswordField from '@/components/ui/PasswordField';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { setPendingSignInMethod } from '@/lib/analytics';

/**
 * Sign-in, two paths sharing one email field:
 * - Magic link (default): we send an https link, tapping it opens the app
 *   signed in (completeSignInFromUrl handles the universal-link hand-back).
 * - Password: for accounts created in-app (guideline 4 registration), the
 *   App Review demo account, and dev builds. Includes password reset.
 * Also carries Apple and Google (added 2026-08-13 alongside the sign-up page):
 * anyone who created their account with one of those has no password and no
 * magic-link identity, so omitting them here would lock them out. Apple is
 * listed first inside SocialAuthButtons, per guideline 4.8. Same Firebase
 * project as the website, so accounts are shared by email.
 */
// Hardcoded, NOT an env var: EXPO_PUBLIC_* is inlined by `eas build` but NOT
// by `eas update`, so an OTA stripped the allowlist and the reviewer panel
// vanished. This is the demo account email (not a secret), safe to hardcode.
const REVIEWER_EMAILS = ['applereview@offerloop.ai'];

const isReviewerEmail = (email: string): boolean =>
  REVIEWER_EMAILS.includes(email.trim().toLowerCase());

export default function SignInScreen() {
  const { colors, scheme } = useTheme();
  // Paper ground, matching Welcome and the onboarding steps (Nick 2026-08-13).
  // On white, white inputs would vanish, so the fields take the grey instead:
  // the page and the field swap roles rather than both going flat.
  const screenBg = scheme === 'dark' ? colors.surface : colors.paper;
  const fieldBg = scheme === 'dark' ? colors.paper2 : colors.surface;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sendSignInLink, signInWithPassword, sendPasswordReset } = useAuth();
  const socialAvailable = useSocialAvailable();

  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<'enter' | 'sending' | 'sent'>('enter');
  const [error, setError] = useState<string | null>(null);
  // Password path for accounts registered in-app. Off by default so the
  // passwordless flow stays the hero; one tap reveals it.
  const [showPassword, setShowPassword] = useState(false);
  const [resetNote, setResetNote] = useState<string | null>(null);
  // Resend: the link can land in spam or never arrive, and the only way
  // out used to be 'Use a different email'. Cooldown stops rapid taps
  // (each one invalidates the previous link).
  const [resendIn, setResendIn] = useState(0);
  const [resendNote, setResendNote] = useState<string | null>(null);

  // Password panel state. Auto-opens for dev builds, the preview channel, and
  // the App Review demo account (typed in the main field); any user can also
  // reveal it via "Sign in with a password instead" since in-app registration
  // (guideline 4) creates password accounts.
  const [devEmail, setDevEmail] = useState(process.env.EXPO_PUBLIC_DEV_EMAIL || '');
  // Reviewer types their address once, in the main field: mirror it down so
  // the panel only needs the password.
  useEffect(() => {
    if (isReviewerEmail(email)) setDevEmail(email.trim().toLowerCase());
  }, [email]);
  const [devPassword, setDevPassword] = useState(process.env.EXPO_PUBLIC_DEV_PASSWORD || '');
  const [devError, setDevError] = useState<string | null>(null);
  const [devBusy, setDevBusy] = useState(false);

  const devSignIn = async () => {
    setDevBusy(true);
    setDevError(null);
    try {
      setPendingSignInMethod('password');
      await signInWithPassword(devEmail, devPassword);
    } catch (e: any) {
      setDevError(e?.message || 'Dev sign-in failed.');
    } finally {
      setDevBusy(false);
    }
  };

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const resend = async () => {
    if (resendIn > 0) return;
    setResendNote(null);
    try {
      setPendingSignInMethod('magic_link');
      await sendSignInLink(email);
      setResendIn(30);
      setResendNote('Sent again — check your inbox and spam.');
    } catch (e: any) {
      setResendNote(e?.message || 'Could not resend. Try again in a moment.');
    }
  };

  const valid = /\S+@\S+\.\S+/.test(email.trim());

  const send = async () => {
    if (!valid) return;
    setPhase('sending');
    setError(null);
    try {
      await sendSignInLink(email);
      setPhase('sent');
      setResendIn(30);
    } catch (e: any) {
      setError(e?.message || 'Could not send the link. Try again.');
      setPhase('enter');
    }
  };

  return (
    // Keyboard-aware + scrollable: the password panel renders BELOW the send
    // button, and with the keyboard up it used to sit off-screen entirely —
    // the reviewer (and we) could never reach it.
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: screenBg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 40,
          paddingHorizontal: 28,
          paddingBottom: insets.bottom + 24,
        }}>
      <View style={{ alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <Image
          source={require('../../../assets/images/offerloop-mark.png')}
          style={{ width: 44, height: 44 }}
          resizeMode="contain"
          accessibilityLabel="Offerloop"
        />
        <Text style={{ fontFamily: fonts.display, fontSize: 30, color: colors.heading }}>
          {phase === 'sent' ? 'Check your email' : 'Sign in to Offerloop'}
        </Text>
        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 14,
            color: colors.inkSecondary,
            textAlign: 'center',
            lineHeight: 21,
            maxWidth: 300,
          }}>
          {phase === 'sent'
            ? `We sent a sign-in link to ${email.trim()}. Open it on this phone to finish.`
            : 'We will email you a one-tap link. Use the same email as your offerloop.ai account.'}
        </Text>
      </View>

      {phase === 'sent' ? (
        <View style={{ alignItems: 'center', gap: 16 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: colors.accent + '14',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="mail-unread-outline" size={30} color={colors.accent} />
          </View>
          <Button
            label="Open my email app"
            variant="brand"
            fullWidth
            onPress={async () => {
              // Gmail first (most of our users), Apple Mail as fallback.
              // openURL does not need LSApplicationQueriesSchemes, so this
              // stays OTA-safe; a failed scheme just falls through.
              try {
                await Linking.openURL('googlegmail://');
              } catch {
                try {
                  await Linking.openURL('message://');
                } catch {
                  setResendNote('Could not open a mail app. Check your inbox manually.');
                }
              }
            }}
          />
          <Button
            label={resendIn > 0 ? `Resend link (${resendIn}s)` : 'Resend link'}
            variant="outline"
            disabled={resendIn > 0}
            onPress={resend}
          />
          {resendNote ? (
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 12,
                color: colors.inkTertiary,
                textAlign: 'center',
                maxWidth: 280,
              }}>
              {resendNote}
            </Text>
          ) : null}
          <Button label="Use a different email" variant="ghost" onPress={() => setPhase('enter')} />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@gmail.com"
            placeholderTextColor={colors.inkTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            inputMode="email"
            returnKeyType="go"
            onSubmitEditing={send}
            style={{
              height: 50,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.hairline,
              backgroundColor: fieldBg,
              paddingHorizontal: 16,
              fontFamily: fonts.sans,
              fontSize: 16,
              color: colors.ink,
            }}
          />
          {error ? (
            <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.negative }}>{error}</Text>
          ) : null}
          {isReviewerEmail(email) ? (
            <Text
              style={{
                fontFamily: fonts.sansMedium,
                fontSize: 12.5,
                color: colors.accent,
                textAlign: 'center',
                lineHeight: 18,
              }}>
              Review account detected — use the password panel below.
            </Text>
          ) : (
            <Button
              label={phase === 'sending' ? 'Sending...' : 'Email me a sign-in link'}
              variant="brand"
              fullWidth
              disabled={!valid || phase === 'sending'}
              onPress={send}
            />
          )}
          {!showPassword ? (
            <Button
              label="Sign in with a password instead"
              variant="ghost"
              onPress={() => setShowPassword(true)}
            />
          ) : null}

          {/* Apple and Google, matching the sign-up page (2026-08-13). Not
              optional: once Get started offers them, anyone who signed up that
              way has no password and no magic-link account to fall back on, so
              leaving them off this screen locks them out of their own app. */}
          {socialAvailable ? (
            <View style={{ gap: 12, marginTop: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.hairline }} />
                <Text
                  style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.inkTertiary }}>
                  or
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.hairline }} />
              </View>
              <SocialAuthButtons />
            </View>
          ) : null}
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 11.5,
              color: colors.inkTertiary,
              textAlign: 'center',
              lineHeight: 17,
              paddingTop: 4,
            }}>
            New to Offerloop?{' '}
            <Text
              style={{ color: colors.accent, fontFamily: fonts.sansMedium }}
              onPress={() => router.replace('/(auth)/create-account')}>
              Create your account
            </Text>{' '}
            right here in the app.
          </Text>
        </View>
      )}

      {(__DEV__ || Updates.channel === 'preview' || isReviewerEmail(email) || showPassword) &&
      phase !== 'sent' ? (
        <View
          style={{
            marginTop: 28,
            borderWidth: 1,
            borderColor: colors.hairline,
            borderRadius: 12,
            padding: 14,
            gap: 8,
            backgroundColor: fieldBg,
          }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 11, letterSpacing: 1, color: colors.inkTertiary }}>
            {__DEV__ || Updates.channel === 'preview' ? 'DEV SIGN-IN (TEST ACCOUNT)' : 'PASSWORD SIGN-IN'}
          </Text>
          <TextInput
            value={devEmail}
            onChangeText={setDevEmail}
            placeholder="test email"
            placeholderTextColor={colors.inkTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={{
              height: 40,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.hairline,
              backgroundColor: colors.surface,
              paddingHorizontal: 12,
              fontFamily: fonts.sans,
              fontSize: 14,
              color: colors.ink,
            }}
          />
          <PasswordField
            value={devPassword}
            onChangeText={setDevPassword}
            placeholder="Password"
            placeholderTextColor={colors.inkTertiary}
            style={{
              height: 40,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.hairline,
              backgroundColor: colors.surface,
              paddingHorizontal: 12,
              fontFamily: fonts.sans,
              fontSize: 14,
              color: colors.ink,
            }}
          />
          {devError ? (
            <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.negative }}>{devError}</Text>
          ) : null}
          <Button
            label={devBusy ? 'Signing in...' : __DEV__ || Updates.channel === 'preview' ? 'Dev sign in' : 'Sign in'}
            variant="outline"
            fullWidth
            disabled={devBusy || !devEmail || !devPassword}
            onPress={devSignIn}
          />
          <Button
            label="Forgot password?"
            variant="ghost"
            disabled={!/\S+@\S+\.\S+/.test(devEmail.trim())}
            onPress={async () => {
              setResetNote(null);
              try {
                await sendPasswordReset(devEmail);
                setResetNote('Password reset email sent. Check your inbox and spam.');
              } catch {
                setResetNote('Could not send the reset email. Check the address and try again.');
              }
            }}
          />
          {resetNote ? (
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 11.5,
                color: colors.inkTertiary,
                textAlign: 'center',
              }}>
              {resetNote}
            </Text>
          ) : null}
        </View>
      ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
