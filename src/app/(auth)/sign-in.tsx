import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { Image, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Passwordless sign-in: enter your email, we send a magic link, tapping it
 * opens the app signed in. No passwords, no social buttons (so no Sign in with
 * Apple requirement). Same account as the website, matched by email.
 */
const REVIEWER_EMAILS = (process.env.EXPO_PUBLIC_REVIEWER_EMAILS || '')
  .toLowerCase()
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

const isReviewerEmail = (email: string): boolean =>
  REVIEWER_EMAILS.includes(email.trim().toLowerCase());

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { sendSignInLink, signInWithPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<'enter' | 'sending' | 'sent'>('enter');
  const [error, setError] = useState<string | null>(null);
  // Resend: the link can land in spam or never arrive, and the only way
  // out used to be 'Use a different email'. Cooldown stops rapid taps
  // (each one invalidates the previous link).
  const [resendIn, setResendIn] = useState(0);
  const [resendNote, setResendNote] = useState<string | null>(null);

  // Password sign-in for dev + internal (preview-channel) field builds, since the
  // magic-link universal-link hand-back isn't built yet. Hidden on the production
  // channel so store builds stay passwordless — with ONE exception: App Review.
  // Apple reviewers must be able to sign in (submission gate, 2026-07-09); when
  // the email typed in the MAIN field matches the build-time reviewer allowlist
  // (EXPO_PUBLIC_REVIEWER_EMAILS, comma-separated, set in eas.json production
  // env), the password panel appears for that account only. First-party
  // email+password does not trigger the Sign-in-with-Apple rule (4.8 covers
  // third-party/social login). Invisible to every normal user.
  const [devEmail, setDevEmail] = useState(process.env.EXPO_PUBLIC_DEV_EMAIL || '');
  const [devPassword, setDevPassword] = useState(process.env.EXPO_PUBLIC_DEV_PASSWORD || '');
  const [devError, setDevError] = useState<string | null>(null);
  const [devBusy, setDevBusy] = useState(false);

  const devSignIn = async () => {
    setDevBusy(true);
    setDevError(null);
    try {
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
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
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
            placeholder="you@school.edu"
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
              backgroundColor: colors.paper,
              paddingHorizontal: 16,
              fontFamily: fonts.sans,
              fontSize: 16,
              color: colors.ink,
            }}
          />
          {error ? (
            <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.negative }}>{error}</Text>
          ) : null}
          <Button
            label={phase === 'sending' ? 'Sending...' : 'Email me a sign-in link'}
            variant="brand"
            fullWidth
            disabled={!valid || phase === 'sending'}
            onPress={send}
          />
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 11.5,
              color: colors.inkTertiary,
              textAlign: 'center',
              lineHeight: 17,
              paddingTop: 4,
            }}>
            New to Offerloop? Sign up and get set up on offerloop.ai, then sign in here with
            the same email.
          </Text>
        </View>
      )}

      {(__DEV__ || Updates.channel === 'preview' || isReviewerEmail(email)) && phase !== 'sent' ? (
        <View
          style={{
            marginTop: 28,
            borderWidth: 1,
            borderColor: colors.hairline,
            borderRadius: 12,
            padding: 14,
            gap: 8,
            backgroundColor: colors.paper,
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
          <TextInput
            value={devPassword}
            onChangeText={setDevPassword}
            placeholder="test password"
            placeholderTextColor={colors.inkTertiary}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
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
            label={devBusy ? 'Signing in...' : 'Dev sign in'}
            variant="outline"
            fullWidth
            disabled={devBusy || !devEmail || !devPassword}
            onPress={devSignIn}
          />
        </View>
      ) : null}
    </View>
  );
}
