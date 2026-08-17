import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  signInWithPopup,
} from 'firebase/auth';
import { Platform } from 'react-native';

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

/**
 * True when Google sign-in can actually run here.
 *
 * On WEB that means Firebase's own popup, not the native module. The module
 * imports fine in a browser, so the original "does GoogleSignin exist" check
 * said yes, rendered the button, and then every method threw "you are calling
 * a not-implemented method on web platform, web support is only available to
 * sponsors" in red under the form. The package has no web build outside its
 * sponsor tier, so the web path uses the Firebase JS SDK instead (same Firebase
 * project, same accounts, same result).
 *
 * On NATIVE it still means the module is in this binary (build 17+); builds
 * 15/16 receive OTA updates and do not have it.
 */
export function googleSignInAvailable(): boolean {
  if (Platform.OS === 'web') return true;
  const m = googleModule();
  return !!m?.GoogleSignin;
}

/**
 * True when Sign in with Apple can run here.
 *
 * On WEB this is always true, and deliberately not conditional on anything we
 * can measure. Guideline 4.8 requires Apple wherever another third-party
 * sign-in is offered, so a screen that shows Google and hides Apple is the one
 * arrangement that must never ship. expo-apple-authentication reports
 * unavailable in a browser (it is native-only), which silently produced exactly
 * that asymmetry the moment Google gained a web path, so web goes through
 * Firebase's Apple provider instead.
 *
 * Whether that provider is ENABLED in the Firebase console is not something the
 * client can query. If it is not, the popup fails with auth/operation-not-allowed
 * and signInWithAppleNative turns that into a sentence that names the fix,
 * rather than an opaque error.
 */
export async function appleSignInAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
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
  /**
   * Web: Firebase's popup. Same provider, same project, so an account created
   * here is the same account the native sheet would reach, and creating one is
   * just signing in for the first time (Firebase provisions on first use).
   *
   * This exists so the browser preview can walk the Google path at all. The
   * preview runs the app inside an iframe, and a popup opened from one needs
   * the click that triggered it to still count as user activation, which it
   * does here (the button's own onPress). A browser that blocks it anyway
   * reports auth/popup-blocked, which is reported rather than swallowed.
   */
  if (Platform.OS === 'web') {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      return 'ok';
    } catch (e) {
      const code = (e as { code?: string })?.code || '';
      // Closing the window or double-clicking the button is not an error.
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/user-cancelled'
      ) {
        return 'cancelled';
      }
      if (code === 'auth/popup-blocked') {
        throw new Error('Your browser blocked the Google window. Allow popups and try again.');
      }
      throw e;
    }
  }

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
  /**
   * Web: Firebase's Apple provider via popup, the counterpart to the Google
   * branch above. Apple returns the name only on the FIRST authorization ever,
   * same as native, so nothing is lost by taking this path in the browser.
   */
  if (Platform.OS === 'web') {
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    try {
      await signInWithPopup(auth, provider);
      return 'ok';
    } catch (e) {
      const code = (e as { code?: string })?.code || '';
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/user-cancelled'
      ) {
        return 'cancelled';
      }
      if (code === 'auth/popup-blocked') {
        throw new Error('Your browser blocked the Apple window. Allow popups and try again.');
      }
      // The one failure a developer can actually act on, so it says what to do
      // instead of surfacing a raw Firebase code. Apple on web needs its own
      // provider setup (Services ID + key) beyond the native entitlement, so
      // this fires on a project where only native Apple was ever configured.
      if (code === 'auth/operation-not-allowed') {
        throw new Error(
          'Sign in with Apple is not enabled for web in Firebase yet. It still works on the phone.',
        );
      }
      throw e;
    }
  }

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
