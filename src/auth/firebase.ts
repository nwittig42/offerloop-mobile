import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getApp, getApps, initializeApp } from 'firebase/app';
// getReactNativePersistence is exported from firebase/auth at runtime; the type
// surface omits it on some versions, hence the loose import below.
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getReactNativePersistence } = require('firebase/auth') as {
  getReactNativePersistence: (storage: unknown) => unknown;
};

/**
 * Firebase app + Auth, configured against the same project as the website
 * (offerloop-native), so an email-link sign-in lands in the SAME account a
 * student already has on the web (matched by email). Config comes from
 * app.json -> expo.extra.firebase. Auth uses AsyncStorage so the session
 * survives app restarts.
 */
const firebaseConfig = (Constants.expoConfig?.extra as any)?.firebase;

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage) as any,
  });
} catch {
  // initializeAuth throws if already initialized (e.g. Fast Refresh); reuse it.
  auth = getAuth(app);
}

export { app, auth };
