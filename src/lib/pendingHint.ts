import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * First-ever pending reveal gets the LONG explanation (what "locking down
 * their email" means, that the bell rings, that a miss costs nothing); every
 * later one gets the short toast. Once per install. Best-effort storage: a
 * failure just means the long version might show twice, which is harmless.
 */
const KEY = 'pendingHintSeen';

export async function hasSeenPendingHint(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return true;
  }
}

export async function markPendingHintSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // nothing: worst case the long toast shows again
  }
}
