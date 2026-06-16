import * as SecureStore from 'expo-secure-store';

/**
 * The Firebase SDK persists the session itself (via AsyncStorage), so all we
 * need to stash is the email address across the magic-link round trip: the
 * user enters it on one screen, taps the link in their mail app, and we read
 * it back to complete sign-in.
 */
const PENDING_EMAIL_KEY = 'offerloop.pendingEmail';

export async function savePendingEmail(email: string): Promise<void> {
  await SecureStore.setItemAsync(PENDING_EMAIL_KEY, email);
}

export async function getPendingEmail(): Promise<string | null> {
  return SecureStore.getItemAsync(PENDING_EMAIL_KEY);
}

export async function clearPendingEmail(): Promise<void> {
  await SecureStore.deleteItemAsync(PENDING_EMAIL_KEY);
}
