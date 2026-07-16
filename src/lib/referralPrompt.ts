import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Pacing for the post-win referral nudge. A win (a draft / application) is the
 * peak-dopamine moment to ask for an invite — but we must NOT ask every time.
 * Rule: surface on every 3rd win, and never more than once per ~20h. Purely
 * local; the count resets only on reinstall, which is fine.
 */
const KEY = 'referralPrompt.v1';
const EVERY_N_WINS = 3;
const COOLDOWN_MS = 20 * 60 * 60 * 1000;

type State = { wins: number; lastShown: number };

/** Call on each win. Returns true at most once per cooldown, on every Nth win. */
export async function shouldShowReferralPromptOnWin(now: number): Promise<boolean> {
  let s: State = { wins: 0, lastShown: 0 };
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) s = { ...s, ...(JSON.parse(raw) as State) };
  } catch {
    // ignore — treat as fresh
  }
  s.wins += 1;
  const due = s.wins % EVERY_N_WINS === 0 && now - s.lastShown > COOLDOWN_MS;
  if (due) s.lastShown = now;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // best-effort
  }
  return due;
}
