import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * The Firebase SDK persists the session itself (via AsyncStorage), so all we
 * need to stash is the email address across the magic-link round trip: the
 * user enters it on one screen, taps the link in their mail app, and we read
 * it back to complete sign-in.
 *
 * SecureStore on device, AsyncStorage on web. expo-secure-store has NO web
 * implementation: the module imports, so nothing fails until the first call,
 * and then `ExpoSecureStore.default.setValueWithKeyAsync is not a function`
 * lands in red under the email field and "Email me a sign-in link" silently
 * cannot work. Only the browser preview is affected, but the preview is where
 * this app gets reviewed, so it may as well work there.
 *
 * The security tradeoff is nil in practice. What is stored is one email address
 * the user just typed into a visible field on the same screen, not a token or a
 * password, and on web it never leaves the origin's own storage.
 */
const PENDING_EMAIL_KEY = 'offerloop.pendingEmail';

const isWeb = Platform.OS === 'web';

export async function savePendingEmail(email: string): Promise<void> {
  if (isWeb) return AsyncStorage.setItem(PENDING_EMAIL_KEY, email);
  await SecureStore.setItemAsync(PENDING_EMAIL_KEY, email);
}

export async function getPendingEmail(): Promise<string | null> {
  if (isWeb) return AsyncStorage.getItem(PENDING_EMAIL_KEY);
  return SecureStore.getItemAsync(PENDING_EMAIL_KEY);
}

export async function clearPendingEmail(): Promise<void> {
  if (isWeb) return AsyncStorage.removeItem(PENDING_EMAIL_KEY);
  await SecureStore.deleteItemAsync(PENDING_EMAIL_KEY);
}
