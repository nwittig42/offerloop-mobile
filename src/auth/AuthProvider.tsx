import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Alert } from 'react-native';
import {
  createUserWithEmailAndPassword,
  isSignInWithEmailLink,
  onIdTokenChanged,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { registerTokenGetter, registerUnauthorizedHandler } from '@/api/authToken';
import { auth } from '@/auth/firebase';
import { clearPendingEmail, getPendingEmail, savePendingEmail } from '@/auth/tokenStore';

/**
 * Email magic-link auth (no social buttons -> no Sign in with Apple required).
 * Flow: enter email -> `sendSignInLink` mails an https link -> tapping it opens
 * the app via the universal link -> `completeSignInFromUrl` finishes it. Same
 * Firebase project as the website, so the account is shared by email.
 *
 * The continue URL must be an https universal link that opens the app (hosted
 * on offerloop.ai with the matching associated-domains entitlement). Configure
 * it via app.json -> expo.extra.authContinueUrl.
 */

type Status = 'loading' | 'signedOut' | 'signedIn';

type AuthContextValue = {
  status: Status;
  user: User | null;
  sendSignInLink: (email: string) => Promise<void>;
  completeSignInFromUrl: (url: string) => Promise<boolean>;
  /** Email+password sign-in: reviewers, users who registered in-app, and dev. */
  signInWithPassword: (email: string, password: string) => Promise<void>;
  /** In-app registration (App Review guideline 4: no browser sign-up). The
   * backend provisions the account on the first authenticated call. */
  createAccountWithPassword: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const CONTINUE_URL: string =
  (Constants.expoConfig?.extra as any)?.authContinueUrl || 'https://offerloop.ai/app/finish-signin';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);

  const getIdToken = useCallback(
    (forceRefresh?: boolean) => (auth.currentUser ? auth.currentUser.getIdToken(forceRefresh) : Promise.resolve(null)),
    [],
  );

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
    await clearPendingEmail();
  }, []);

  const sendSignInLink = useCallback(async (email: string) => {
    const clean = email.trim().toLowerCase();
    await sendSignInLinkToEmail(auth, clean, {
      url: CONTINUE_URL,
      handleCodeInApp: true,
      iOS: { bundleId: 'ai.offerloop.app' },
    });
    await savePendingEmail(clean);
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  }, []);

  const createAccountWithPassword = useCallback(async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
  }, []);

  const completeSignInFromUrl = useCallback(async (url: string): Promise<boolean> => {
    // The finish-signin web page hands the app the ORIGINAL magic-link URL
    // wrapped as offerloop://finish-signin?link=<encoded>. The Firebase SDK
    // historically unwraps a `link` param itself (dynamic-link format), but
    // don't bet sign-in on SDK internals: unwrap explicitly and try both.
    let candidate = url;
    if (!isSignInWithEmailLink(auth, candidate)) {
      try {
        const wrapped = /[?&]link=([^&]+)/.exec(url)?.[1];
        if (wrapped) candidate = decodeURIComponent(wrapped);
      } catch {
        /* fall through with the raw url */
      }
      if (!isSignInWithEmailLink(auth, candidate)) return false;
    }
    const email = (await getPendingEmail()) || '';
    if (!email) {
      // Link opened on a device that never started sign-in (or after a
      // reinstall) — the stashed email is gone. Surface it instead of the
      // old silent false: the sign-in screen tells them to re-enter the
      // email and send a fresh link.
      Alert.alert(
        'Almost there',
        'This sign-in link was started on a different device or the app was reinstalled. Enter your email again and send a fresh link.',
      );
      return false;
    }
    try {
      await signInWithEmailLink(auth, email, candidate);
    } catch {
      Alert.alert(
        'Sign-in link expired',
        'That link is no longer valid - links are single-use and expire. Send yourself a fresh one.',
      );
      return false;
    }
    await clearPendingEmail();
    return true;
  }, []);

  // Keep `user`/`status` in sync with Firebase, and expose the token getter +
  // sign-out to the API client (for bearer auth + hard-401 handling).
  useEffect(() => {
    registerTokenGetter(getIdToken);
    registerUnauthorizedHandler(() => {
      void signOut();
    });
    const unsub = onIdTokenChanged(auth, (u) => {
      setUser(u);
      setStatus(u ? 'signedIn' : 'signedOut');
    });
    return unsub;
  }, [getIdToken, signOut]);

  // Complete sign-in when the magic link opens the app (cold start + warm).
  useEffect(() => {
    Linking.getInitialURL()
      .then((url) => {
        if (url) void completeSignInFromUrl(url);
      })
      .catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => {
      void completeSignInFromUrl(url);
    });
    return () => sub.remove();
  }, [completeSignInFromUrl]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      sendSignInLink,
      completeSignInFromUrl,
      signInWithPassword,
      createAccountWithPassword,
      sendPasswordReset,
      signOut,
      getIdToken,
    }),
    [status, user, sendSignInLink, completeSignInFromUrl, signInWithPassword, createAccountWithPassword, sendPasswordReset, signOut, getIdToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
