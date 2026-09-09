import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * First-run tour state, on the device.
 *
 * Two flags, deliberately separate:
 *  - PENDING: onboarding just finished and the tour has not been started yet.
 *    Only this makes Scout prefill the question and float the hand. Set by
 *    completeOnboarding(), so an ESTABLISHED user never sees the tour appear
 *    out of nowhere after an update.
 *  - DONE: the tour was finished or skipped. Never offer it again.
 *
 * Device-level on purpose (same call the notification prompt makes): running
 * the tour again on a new phone is fine, and it keeps the flags out of the
 * profile payload.
 */
/**
 * Keyed by account (2026-09-08). The flags were device-wide, so every sign-in
 * that passed through onboarding re-armed the opener for whoever came next,
 * and Rylan saw "How can you help me?" on every login. Now each account gets
 * its own pair, and the opener is marked seen the moment it is OFFERED, so it
 * can only ever prefill once per account on a device. Replay re-arms it.
 */
let currentUid = 'anon';
export function setTourUser(uid: string | null | undefined): void {
  currentUid = uid || 'anon';
}
const pendingKey = () => `offerloop.tour.v2.${currentUid}.pending`;
const doneKey = () => `offerloop.tour.v2.${currentUid}.done`;

export async function markTourPending(): Promise<void> {
  await AsyncStorage.multiSet([
    [pendingKey(), '1'],
    [doneKey(), '0'],
  ]).catch(() => {});
}

export async function isTourPending(): Promise<boolean> {
  try {
    const [pending, done] = await AsyncStorage.multiGet([pendingKey(), doneKey()]);
    return pending[1] === '1' && done[1] !== '1';
  } catch {
    return false;
  }
}

/** The opener is on screen. One shot: from here it never prefills on its own
 *  again for this account, whether the user sends it, clears it, or leaves. */
export async function markTourOffered(): Promise<void> {
  await AsyncStorage.setItem(pendingKey(), '0').catch(() => {});
}

/** The moment the tour starts. Clears PENDING so a remount of the Scout tab
 *  (leave mid-tour, come back) does not prefill the opener again under the
 *  bubble that already sent (Rylan 2026-09-03, "How can you help me?" shown
 *  twice). DONE stays 0 until the tour ends; Replay re-arms both. */
export async function markTourStarted(): Promise<void> {
  await AsyncStorage.setItem(pendingKey(), '0').catch(() => {});
}

/** Started, finished, or skipped: either way it never fires on its own again. */
export async function endTour(): Promise<void> {
  await AsyncStorage.multiSet([
    [pendingKey(), '0'],
    [doneKey(), '1'],
  ]).catch(() => {});
}

/** Profile → Settings → Replay the tour. */
export async function replayTour(): Promise<void> {
  await markTourPending();
}
