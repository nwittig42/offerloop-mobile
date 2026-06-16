import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import {
  isSignInWithEmailLink,
  onIdTokenChanged,
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
  /** Dev-only: email+password sign-in so the real loop is testable before the
   * magic-link universal link is set up. Stripped from release builds. */
  signInWithPassword: (email: string, password: string) => Promise<void>;
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

  const completeSignInFromUrl = useCallback(async (url: string): Promise<boolean> => {
    if (!isSignInWithEmailLink(auth, url)) return false;
    const email = (await getPendingEmail()) || '';
    if (!email) return false;
    await signInWithEmailLink(auth, email, url);
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
    Linking.getInitialURL().then((url) => {
      if (url) void completeSignInFromUrl(url);
    });
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
      signOut,
      getIdToken,
    }),
    [status, user, sendSignInLink, completeSignInFromUrl, signInWithPassword, signOut, getIdToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
