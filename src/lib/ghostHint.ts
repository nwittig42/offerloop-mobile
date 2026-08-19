import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * First-entry ghost-swipe hints on the LIVE decks (Rylan 2026-08-19).
 * One flag per deck, per install: the hand teaches once and never nags.
 * Best-effort storage: a read/write failure just means it might teach twice.
 */
const KEY = (deck: 'people' | 'jobs') => `ghostHintSeen.${deck}`;

export async function hasSeenGhostHint(deck: 'people' | 'jobs'): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY(deck))) === '1';
  } catch {
    return true;
  }
}

export async function markGhostHintSeen(deck: 'people' | 'jobs'): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY(deck), '1');
  } catch {
    // nothing: worst case it shows again
  }
}
