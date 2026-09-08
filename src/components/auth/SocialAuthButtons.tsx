import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import {
  appleSignInAvailable,
  googleSignInAvailable,
  signInWithAppleNative,
  signInWithGoogleNative,
} from '@/auth/socialSignIn';
import GoogleG from '@/components/auth/GoogleG';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { setPendingSignInMethod } from '@/lib/analytics';

/**
 * Apple and Google, rendered inline on the sign-up and sign-in PAGES. These
 * used to live in a bottom sheet; Nick moved them onto the page (2026-08-13) so
 * the email form and the third-party options are visible together, the way the
 * website does it.
 *
 * Order is not cosmetic: Guideline 4.8 requires Sign in with Apple to be
 * offered wherever another third-party login is, presented as an equivalent
 * option. Apple stays first. Do not reorder.
 *
 * Both providers only exist when the native modules are in the binary (build
 * 19+). useSocialAvailable() reports whether ANY is present so callers can hide
 * the whole block, including its divider, on older builds.
 */

export function useSocialAvailable(): boolean {
  const [appleReady, setAppleReady] = useState(false);
  const googleReady = googleSignInAvailable();
  useEffect(() => {
    let alive = true;
    void appleSignInAvailable().then((ok) => {
      if (alive) setAppleReady(ok);
    });
    return () => {
      alive = false;
    };
  }, []);
  return appleReady || googleReady;
}

export default function SocialAuthButtons({
  onError,
}: {
  /** Surfaced inline by the host screen, next to its own form errors, rather
   *  than in an alert that covers the page. */
  onError?: (message: string) => void;
}) {
  const colors = useColors();
  const [appleReady, setAppleReady] = useState(false);
  const googleReady = googleSignInAvailable();
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);

  useEffect(() => {
    let alive = true;
    void appleSignInAvailable().then((ok) => {
      if (alive) setAppleReady(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  const run = async (which: 'apple' | 'google') => {
    if (busy) return;
    setBusy(which);
    setPendingSignInMethod(which);
    try {
      const result =
        which === 'apple' ? await signInWithAppleNative() : await signInWithGoogleNative();
      // 'ok' flips auth state and the gate routes onward; 'cancelled' is quiet.
      if (result === 'cancelled') return;
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Could not sign you in. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const row = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    minHeight: 48,
    borderRadius: 8,
    paddingVertical: 14,
  };

  return (
    <>
      {appleReady ? (
        <Pressable
          onPress={() => void run('apple')}
          disabled={!!busy}
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
          style={{ ...row, backgroundColor: '#000000', opacity: busy ? 0.7 : 1 }}>
          {busy === 'apple' ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="logo-apple" size={19} color="#FFFFFF" />
          )}
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15.5, color: '#FFFFFF' }}>
            Continue with Apple
          </Text>
        </Pressable>
      ) : null}

      {googleReady ? (
        <Pressable
          onPress={() => void run('google')}
          disabled={!!busy}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          style={{
            ...row,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: colors.hairline,
            opacity: busy ? 0.7 : 1,
          }}>
          {busy === 'google' ? <ActivityIndicator size="small" color="#4285F4" /> : <GoogleG size={18} />}
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15.5, color: '#1F1F1F' }}>
            Continue with Google
          </Text>
        </Pressable>
      ) : null}
    </>
  );
}
