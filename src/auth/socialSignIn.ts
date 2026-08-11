import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
} from 'firebase/auth';

import { auth } from '@/auth/firebase';

/**
 * Native social sign-in (build 17+): Google via the native account sheet
 * (App Review rejected the browser flow under Guideline 4) and Sign in with
 * Apple (required by Guideline 4.8 the moment Google exists).
 *
 * Both native modules are ABSENT from builds 15/16, and OTA updates reach
 * those builds. Every access is a guarded lazy require: on an old build the
 * availability checks return false, the buttons never render, and nothing
 * crashes. Same account system as email: Firebase links providers by email,
 * so an existing email user who taps Google lands in their same account.
 */

const WEB_CLIENT_ID =
  '184607281467-926iu2br2icrpvgu0f4j4ouic3kuq0jh.apps.googleusercontent.com';

/* eslint-disable @typescript-eslint/no-var-requires */
function googleModule(): any {
  try {
    return require('@react-native-google-signin/google-signin');
  } catch {
    return null;
  }
}

function appleModule(): any {
  try {
    return require('expo-apple-authentication');
  } catch {
    return null;
  }
}

function cryptoModule(): any {
  try {
    return require('expo-crypto');
  } catch {
    return null;
  }
}
/* eslint-enable @typescript-eslint/no-var-requires */

/** True when the Google native module is in this binary (build 17+). */
export function googleSignInAvailable(): boolean {
  const m = googleModule();
  return !!m?.GoogleSignin;
}

/** True when Sign in with Apple can run on this device and binary. */
export async function appleSignInAvailable(): Promise<boolean> {
  const m = appleModule();
  if (!m?.isAvailableAsync) return false;
  try {
    return await m.isAvailableAsync();
  } catch {
    return false;
  }
}

export type SocialResult = 'ok' | 'cancelled';

export async function signInWithGoogleNative(): Promise<SocialResult> {
  const m = googleModule();
  if (!m?.GoogleSignin) {
    throw new Error('Google sign-in needs the newest App Store version.');
  }
  const { GoogleSignin, isErrorWithCode, statusCodes } = m;
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  let idToken: string | undefined;
  try {
    const res = await GoogleSignin.signIn();
    // v16 returns { type: 'success' | 'cancelled', data: { idToken } };
    // older majors returned the user object with idToken directly.
    if (res?.type === 'cancelled') return 'cancelled';
    idToken = res?.data?.idToken ?? res?.idToken;
  } catch (e) {
    if (isErrorWithCode?.(e) && (e as any).code === statusCodes?.SIGN_IN_CANCELLED) {
      return 'cancelled';
    }
    throw e;
  }
  if (!idToken) throw new Error('Google did not return a sign-in token. Try again.');
  await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  return 'ok';
}

export async function signInWithAppleNative(): Promise<SocialResult> {
  const apple = appleModule();
  const crypto = cryptoModule();
  if (!apple?.signInAsync || !crypto?.digestStringAsync) {
    throw new Error('Sign in with Apple needs the newest App Store version.');
  }
  // Standard replay protection: Apple signs the HASH of a nonce; Firebase
  // verifies against the raw value.
  const rawNonce: string =
    crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
  const hashedNonce = await crypto.digestStringAsync(
    crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );
  let credential: { identityToken?: string | null };
  try {
    credential = await apple.signInAsync({
      requestedScopes: [
        apple.AppleAuthenticationScope.FULL_NAME,
        apple.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return 'cancelled';
    throw e;
  }
  if (!credential.identityToken) {
    throw new Error('Apple did not return a sign-in token. Try again.');
  }
  const provider = new OAuthProvider('apple.com');
  await signInWithCredential(
    auth,
    provider.credential({ idToken: credential.identityToken, rawNonce }),
  );
  return 'ok';
}
