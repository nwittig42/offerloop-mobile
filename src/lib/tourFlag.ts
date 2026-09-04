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
const PENDING_KEY = 'offerloop.tour.v1.pending';
const DONE_KEY = 'offerloop.tour.v1.done';

export async function markTourPending(): Promise<void> {
  await AsyncStorage.multiSet([
    [PENDING_KEY, '1'],
    [DONE_KEY, '0'],
  ]).catch(() => {});
}

export async function isTourPending(): Promise<boolean> {
  try {
    const [pending, done] = await AsyncStorage.multiGet([PENDING_KEY, DONE_KEY]);
    return pending[1] === '1' && done[1] !== '1';
  } catch {
    return false;
  }
}

/** The moment the tour starts. Clears PENDING so a remount of the Scout tab
 *  (leave mid-tour, come back) does not prefill the opener again under the
 *  bubble that already sent (Rylan 2026-09-03, "How can you help me?" shown
 *  twice). DONE stays 0 until the tour ends; Replay re-arms both. */
export async function markTourStarted(): Promise<void> {
  await AsyncStorage.setItem(PENDING_KEY, '0').catch(() => {});
}

/** Started, finished, or skipped: either way it never fires on its own again. */
export async function endTour(): Promise<void> {
  await AsyncStorage.multiSet([
    [PENDING_KEY, '0'],
    [DONE_KEY, '1'],
  ]).catch(() => {});
}

/** Profile → Settings → Replay the tour. */
export async function replayTour(): Promise<void> {
  await markTourPending();
}
