import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { track } from '@/lib/analytics';

/**
 * Pacing for the App Store rating prompt.
 *
 * Apple draws the popup, we only choose the moment. Two rules shape everything
 * here:
 *
 *  1. iOS silently ignores more than 3 prompts per user per 365 days, and users
 *     can switch the popup off entirely in Settings. So a call is a request,
 *     never a guarantee, and we must never build UI that assumes it appeared.
 *  2. Whatever a student feels in the 10 seconds before the stars appear is the
 *     rating we get. So we ask after a win and stay quiet after friction.
 *
 * Triggers (approved 2026-08-17):
 *  - Primary: they open a reply from a real contact. Sending is hope, a reply
 *    is proof the product worked.
 *  - Backup: 5 separate days in the app AND 10+ emails out, for the students
 *    who are grinding but have not heard back yet. Fires at a pause (Feed),
 *    never mid-swipe.
 *
 * Pacing: 30 days minimum between asks, at most 3 in any rolling 365 days
 * (Apple's full allowance, nothing held in reserve). Repeat asks cost nothing:
 * anyone who already rated has their prompt swallowed by iOS, so the only
 * people a second ask reaches are the ones who skipped the first.
 *
 * Local-only, same as referralPrompt and profileNudge. The counters reset on
 * reinstall, which is survivable (Apple's own 3-per-year cap is the real
 * backstop) and saves a backend round trip on every Feed open.
 */

const KEY = 'appRating.v1';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Minimum gap between two asks. */
const MIN_GAP_MS = 30 * DAY_MS;

/** Apple's own ceiling. Asking past it is a no-op, so there is no point trying. */
const MAX_ASKS_PER_YEAR = 3;
const YEAR_MS = 365 * DAY_MS;

/** Backup trigger thresholds, for users who never get a reply. */
const BACKUP_MIN_OPEN_DAYS = 5;
const BACKUP_MIN_SENT = 10;

/**
 * After an error, the app is the last thing anyone wants to rate. Any failed
 * API call mutes the prompt for this long.
 */
const FRICTION_WINDOW_MS = 5 * 60 * 1000;

/** Why we asked. Kept in analytics so we can tell which trigger earns stars. */
export type RatingTrigger = 'reply' | 'habit';

type State = {
  /** Timestamps of every ask, trimmed to the last 365 days. */
  asks: number[];
  /** Distinct local days the app was opened, as YYYY-MM-DD. Trimmed. */
  openDays: string[];
};

const EMPTY: State = { asks: [], openDays: [] };

/**
 * Session-only. "Did something just break" is a question about the last few
 * minutes, so it never needs to survive a cold start and never needs a write
 * on the API hot path.
 */
let lastFrictionAt = 0;

async function read(): Promise<State> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<State>;
    return {
      asks: Array.isArray(parsed.asks) ? parsed.asks : [],
      openDays: Array.isArray(parsed.openDays) ? parsed.openDays : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

async function write(s: State): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Ignore. A lost write means one extra ask later, which Apple caps anyway.
  }
}

/** Local calendar day, so "5 separate days" means what a student would think. */
function dayKey(now: number): string {
  const d = new Date(now);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * expo-store-review lazily, so a runtime without the native module (Expo Go,
 * the web preview, any build made before this module was added) leaves the
 * feature off instead of crashing at import. Same shape as the RevenueCat
 * guard in api/purchases.
 */
type StoreReviewModule = {
  isAvailableAsync: () => Promise<boolean>;
  hasAction: () => Promise<boolean>;
  requestReview: () => Promise<void>;
};

let storeReviewModule: StoreReviewModule | null | undefined;

function storeReview(): StoreReviewModule | null {
  if (storeReviewModule !== undefined) return storeReviewModule;
  try {
    // Deliberate require: a static import would crash at module load on a
    // runtime without the native module, which is the case this guard exists for.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    storeReviewModule = require('expo-store-review') as StoreReviewModule;
  } catch {
    storeReviewModule = null;
  }
  return storeReviewModule;
}

/** Call on app start. Records today toward the backup trigger's day count. */
export async function noteAppOpen(now: number): Promise<void> {
  const s = await read();
  const today = dayKey(now);
  if (s.openDays.includes(today)) return;
  // Only the count matters, so keep the tail short rather than growing forever.
  s.openDays = [...s.openDays, today].slice(-BACKUP_MIN_OPEN_DAYS * 2);
  await write(s);
}

/**
 * Call when something goes wrong (any failed API call). Mutes the prompt for
 * FRICTION_WINDOW_MS. Cheap on purpose: this runs on every network error.
 */
export function noteFriction(now: number): void {
  lastFrictionAt = now;
}

/** How many separate days this person has opened the app. */
export async function openDayCount(): Promise<number> {
  const s = await read();
  return s.openDays.length;
}

type AskOptions = {
  /**
   * Emails actually out the door (sent + replied). Required for the 'habit'
   * trigger, ignored for 'reply'. The caller counts real outreach rows, so
   * there is no second counter to drift.
   */
  sentCount?: number;
};

/**
 * Ask for a rating if this moment qualifies. Returns true if the prompt was
 * requested, which is NOT the same as shown: iOS decides that, silently.
 *
 * Never throws, never blocks the UI. Safe to fire and forget.
 */
export async function requestReviewIfDue(
  trigger: RatingTrigger,
  now: number,
  opts: AskOptions = {},
): Promise<boolean> {
  // The web preview has no store to rate in.
  if (Platform.OS === 'web') return false;

  // Something just broke. Ask another day.
  if (now - lastFrictionAt < FRICTION_WINDOW_MS) return false;

  const s = await read();

  if (trigger === 'habit') {
    if (s.openDays.length < BACKUP_MIN_OPEN_DAYS) return false;
    if ((opts.sentCount ?? 0) < BACKUP_MIN_SENT) return false;
  }

  // Pacing. Drop asks older than a year first, so the allowance refills over
  // time instead of retiring someone permanently after their third ask.
  const recent = s.asks.filter((t) => now - t < YEAR_MS);
  if (recent.length >= MAX_ASKS_PER_YEAR) return false;
  const last = recent.length ? Math.max(...recent) : 0;
  if (last && now - last < MIN_GAP_MS) return false;

  const mod = storeReview();
  if (!mod) return false;
  try {
    // isAvailableAsync is false on TestFlight builds, so this whole path is
    // untestable there by design. Verify pacing with the analytics event.
    if (!(await mod.isAvailableAsync())) return false;
    if (!(await mod.hasAction())) return false;
    await mod.requestReview();
  } catch {
    // Native side refused. Do not burn one of the three slots for it.
    return false;
  }

  await write({ ...s, asks: [...recent, now] });
  track('rating_prompt_requested', { trigger, ask_number: recent.length + 1 });
  return true;
}
