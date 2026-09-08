import { Ionicons } from '@expo/vector-icons';
import PasswordField from '@/components/ui/PasswordField';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import SocialAuthButtons, { useSocialAvailable } from '@/components/auth/SocialAuthButtons';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, type Palette } from '@/theme/tokens';
import { setPendingSignInMethod } from '@/lib/analytics';

/**
 * In-app registration (App Review guideline 4: account creation may not punt
 * to the browser). Email + password, instant: Firebase creates the account,
 * the backend provisions it free-tier on the first authenticated call
 * (_ensure_user_doc), and the auth gate drops brand-new users into the
 * in-app onboarding. First-party email+password does not trigger the
 * Sign-in-with-Apple rule (4.8 covers third-party login only).
 */

const TERMS_URL = 'https://offerloop.ai/terms-of-service';
const PRIVACY_URL = 'https://offerloop.ai/privacy';

const inputStyle = (colors: Palette, fieldBg: string) =>
  ({
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: fieldBg,
    paddingHorizontal: 16,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.ink,
  }) as const;

function friendlyError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('email-already-in-use'))
    return 'That email already has an account. Sign in instead.';
  if (code.includes('invalid-email')) return 'That email address does not look right.';
  if (code.includes('weak-password')) return 'Please pick a stronger password (at least 8 characters).';
  if (code.includes('network')) return 'No connection. Check your internet and try again.';
  return 'Could not create the account. Please try again.';
}

export default function CreateAccountScreen() {
  const { colors, scheme } = useTheme();
  // Paper ground, matching Welcome and the onboarding steps (Nick 2026-08-13).
  // On white, white inputs would vanish, so the fields take the grey instead:
  // the page and the field swap roles rather than both going flat.
  const screenBg = scheme === 'dark' ? colors.surface : colors.paper;
  const fieldBg = scheme === 'dark' ? colors.paper2 : colors.surface;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { createAccountWithPassword } = useAuth();

  const socialAvailable = useSocialAvailable();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = /\S+@\S+\.\S+/.test(email.trim());
  const passwordValid = password.length >= 8;
  const confirmValid = confirm === password && confirm.length > 0;
  const canSubmit = emailValid && passwordValid && confirmValid && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      setPendingSignInMethod('email_new');
      await createAccountWithPassword(email, password);
      // No navigation here: the auth gate sees the new session and routes
      // brand-new users into onboarding on its own.
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  };

  return (
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
          {/* No subtitle. The heading, three labelled fields, the Google
              button and the terms line already say everything; anything else
              here is filler people skip on the way to the email field. */}
          <Text style={{ fontFamily: fonts.display, fontSize: 30, color: colors.heading }}>
            Create your account
          </Text>
        </View>

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
            textContentType="username"
            style={inputStyle(colors, fieldBg)}
          />
          <PasswordField
            value={password}
            onChangeText={setPassword}
            placeholder="Password (8+ characters)"
            placeholderTextColor={colors.inkTertiary}
            textContentType="newPassword"
            style={inputStyle(colors, fieldBg)}
          />
          <PasswordField
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Confirm password"
            placeholderTextColor={colors.inkTertiary}
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={submit}
            style={inputStyle(colors, fieldBg)}
          />
          {confirm.length > 0 && !confirmValid ? (
            <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.negative }}>
              Passwords do not match yet.
            </Text>
          ) : null}
          {error ? (
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.negative }}>
                {error}
              </Text>
              {error.includes('Sign in instead') ? (
                <Button
                  label="Go to sign in"
                  variant="outline"
                  onPress={() => router.replace('/(auth)/sign-in')}
                />
              ) : null}
            </View>
          ) : null}
          <Button
            label={busy ? 'Creating your account...' : 'Create account'}
            variant="brand"
            fullWidth
            disabled={!canSubmit}
            onPress={submit}
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
            By creating an account you agree to our{' '}
            <Text
              style={{ color: colors.accent }}
              onPress={() => void Linking.openURL(TERMS_URL)}>
              Terms of Use
            </Text>{' '}
            and{' '}
            <Text
              style={{ color: colors.accent }}
              onPress={() => void Linking.openURL(PRIVACY_URL)}>
              Privacy Policy
            </Text>
            . You can delete your account any time in Settings.
          </Text>
        </View>

        {/* Third-party sign-in, on the page rather than in a sheet (Nick
            2026-08-13). Apple before Google: Guideline 4.8 requires Sign in
            with Apple wherever another third-party login is offered, shown as
            an equivalent option. Both are absent on builds without the native
            modules, and the email form above still stands on its own. */}
        {socialAvailable ? (
          <View style={{ marginTop: 24, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.hairline }} />
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.inkTertiary }}>
                or
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.hairline }} />
            </View>
            <SocialAuthButtons onError={setError} />
          </View>
        ) : null}

        <View style={{ marginTop: 24, alignItems: 'center' }}>
          <Button
            label="I already have an account"
            variant="ghost"
            icon="arrow-back-outline"
            onPress={() => router.replace('/(auth)/sign-in')}
          />
        </View>

        <View style={{ flex: 1 }} />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingTop: 16,
          }}>
          <Ionicons name="lock-closed-outline" size={12} color={colors.inkTertiary} />
          <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary }}>
            Your password is stored securely and never shared.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
