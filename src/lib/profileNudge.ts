import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Pacing for Scout's profile nudges — the drip-fed version of the gap survey.
 *
 * The survey only fires when the People deck is completely stuck. Most students
 * are not stuck, they are just thin: two dream companies instead of six, no
 * locations, a school but no target roles. Every one of those makes the deck
 * measurably worse and none of them will ever get fixed by a settings screen
 * nobody opens.
 *
 * So Scout asks. One question, at a pause, rarely, and it takes no for an
 * answer:
 *
 *  - ONE question at a time. A form is the thing the survey already is; this
 *    is a nudge, and a nudge with four fields is a form wearing a hat.
 *  - Only at a pause (deck exhausted, or Feed opened), never mid-swipe.
 *  - COOLDOWN_MS between any two asks, whatever the question.
 *  - Two dismissals of the same question retires it permanently. A dismissal
 *    is an answer, and asking a third time is nagging.
 *
 * Local-only, same as referralPrompt: the counters reset on reinstall, which
 * costs nothing and saves a backend round trip on every Feed open.
 */
const KEY = 'profileNudge.v1';

/** Nothing is asked twice inside this window, regardless of which question. */
const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

/** Dismissals of one question before it is retired for good. */
const MAX_DISMISSALS = 2;

/** The questions Scout can ask, ordered by what they buy the ranker.
 *  School first: it is the strongest single signal person_ranker has. */
export type NudgeKey = 'school' | 'dreamCompanies' | 'targetRoles' | 'locations';

export const NUDGE_ORDER: NudgeKey[] = ['school', 'dreamCompanies', 'targetRoles', 'locations'];

type State = {
  lastShown: number;
  /** key → times dismissed. A key at MAX_DISMISSALS is never asked again. */
  dismissed: Partial<Record<NudgeKey, number>>;
  /** key → true once answered, so a filled field is never asked about again
   *  even if the profile read is briefly stale. */
  answered: Partial<Record<NudgeKey, boolean>>;
};

const EMPTY: State = { lastShown: 0, dismissed: {}, answered: {} };

async function read(): Promise<State> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as State) };
  } catch {
    return { ...EMPTY };
  }
}

async function write(s: State): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Ignore: a lost write means one extra ask later, which is survivable.
  }
}

/**
 * Which question Scout should ask right now, or null for "stay quiet".
 *
 * `missing` is what the profile actually lacks, computed by the caller from
 * live profile data — this module never guesses at the profile, it only
 * remembers what has been asked.
 */
export async function nextProfileNudge(
  missing: NudgeKey[],
  now: number,
): Promise<NudgeKey | null> {
  if (!missing.length) return null;
  const s = await read();
  if (now - s.lastShown < COOLDOWN_MS) return null;

  for (const key of NUDGE_ORDER) {
    if (!missing.includes(key)) continue;
    if (s.answered[key]) continue;
    if ((s.dismissed[key] ?? 0) >= MAX_DISMISSALS) continue;
    return key;
  }
  return null;
}

/** Call when a nudge is actually rendered, so the cooldown starts from the
 *  moment they saw it rather than the moment they acted on it. */
export async function markNudgeShown(now: number): Promise<void> {
  const s = await read();
  s.lastShown = now;
  await write(s);
}

export async function markNudgeAnswered(key: NudgeKey): Promise<void> {
  const s = await read();
  s.answered[key] = true;
  await write(s);
}

export async function markNudgeDismissed(key: NudgeKey): Promise<void> {
  const s = await read();
  s.dismissed[key] = (s.dismissed[key] ?? 0) + 1;
  await write(s);
}
