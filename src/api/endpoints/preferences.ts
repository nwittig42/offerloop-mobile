import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';

/**
 * The one explicit "this account finished onboarding" fact the server
 * keeps (Rylan 2026-09-11). Called exactly once, from completeOnboarding(),
 * the moment the app's own onboarding flow actually finishes. Everything
 * else /me exposes is real profile data that can go true from just the
 * first onboarding step, so it is a fine heuristic for "looks established"
 * and a bad proof that onboarding is actually done. Fire-and-forget: a
 * failed write here just means the device keeps re-deriving the heuristic
 * a little longer, never a new bug.
 */
export async function markOnboardingComplete(): Promise<void> {
  if (USE_MOCKS) return;
  await apiFetch('/api/mobile/preferences', {
    method: 'POST',
    body: { onboardingComplete: true },
  });
}

/** Permanently delete the account + all data (Apple 5.1.1(v) requirement). The
 *  caller signs the user out afterward. Throws on failure so the UI can surface it. */
export async function deleteAccount(): Promise<void> {
  if (USE_MOCKS) return;
  await apiFetch('/api/mobile/account/delete', { method: 'POST', timeoutMs: 20_000 });
}

/** Save job location preferences. The feed reads preferredLocations as a soft
 *  geo ranking signal, so this makes the swipe deck lean toward places the user
 *  would realistically take — without hard-filtering away volume. */
export async function savePreferredLocations(preferredLocations: string[]): Promise<string[]> {
  if (USE_MOCKS) return preferredLocations;
  const r = await apiFetch<{ preferredLocations?: string[] }>('/api/mobile/preferences', {
    method: 'POST',
    body: { preferredLocations },
  });
  return r.preferredLocations || preferredLocations;
}

/** Persist the onboarding goal (target track). Posts to the same preferences
 *  endpoint; the backend persists targetRoles/industries to the user doc (which
 *  /me already surfaces). Best-effort — safe to call even before the backend
 *  accepts these fields (they're simply ignored until then). */
export async function saveTargetTrack(opts: {
  targetRoles?: string[];
  industries?: string[];
  /** The rest of the Profile tab. These used to be collected by Save and then
   *  dropped on the floor — updateProfile only patched the local cache, so the
   *  edit vanished on the next refetch. `about` is sent even when empty so the
   *  user can deliberately clear it. */
  about?: string;
  gradYear?: string;
  /** The People ranker's most important input, now editable from the
   *  Personal card as well as the nudge and gap survey. */
  school?: string;
  linkedinUrl?: string;
}): Promise<void> {
  if (USE_MOCKS) return;
  await apiFetch('/api/mobile/preferences', {
    method: 'POST',
    body: {
      ...(opts.targetRoles ? { targetRoles: opts.targetRoles } : {}),
      ...(opts.industries ? { industries: opts.industries } : {}),
      ...(opts.about !== undefined ? { about: opts.about } : {}),
      ...(opts.gradYear ? { gradYear: opts.gradYear } : {}),
      ...(opts.school ? { school: opts.school } : {}),
      ...(opts.linkedinUrl ? { linkedinUrl: opts.linkedinUrl } : {}),
    },
  });
  // A LinkedIn URL is a whole profile the engine can read. The website has
  // always self-enriched on this moment; the app never did, so app-only
  // users kept an empty resumeParsed and generic emails (Rylan 2026-08-31).
  // Fire-and-forget: the server merges LinkedIn under any real resume, so
  // the resume-first hierarchy holds.
  if (opts.linkedinUrl) {
    void apiFetch('/api/enrich-linkedin-onboarding', {
      method: 'POST',
      body: { linkedin_url: opts.linkedinUrl },
      timeoutMs: 60_000,
    }).catch(() => {});
  }
}

/** Acquisition attribution from onboarding ("How did you hear about us?").
 *  Persisted on the user doc via the preferences endpoint; best-effort. */
export async function saveReferralSource(source: string): Promise<void> {
  if (USE_MOCKS) return;
  await apiFetch('/api/mobile/preferences', {
    method: 'POST',
    body: { referralSource: source },
  });
}

/**
 * The two fields the People deck cannot run without: which school you went to,
 * and which firms you want. Collected by the gap survey on the People deck's
 * empty state (2026-08-16).
 *
 * Neither was writable from the app before, so an app-only student had no
 * school and no dream companies forever, and the ranker returned an empty deck
 * every single time — correctly, and permanently. This is the fix.
 *
 * Both are optional and sent independently: the survey only asks for the piece
 * that is actually missing, so a student who already has a school on file gets
 * a one-screen survey rather than two.
 */
export async function saveRankerSignals(opts: {
  school?: string;
  dreamCompanies?: string[];
  /** Exact job titles, not fields. person_ranker token-matches these against
   *  each candidate's title, and person_pool_fill aims the PDL search with
   *  them, so "Auditor" and "Finance" are very different answers. */
  targetRoles?: string[];
  /** Which offices. Scored by person_ranker (city/state match) and passed to
   *  the PDL search, so it narrows WHO gets bought as well as who ranks. */
  preferredLocations?: string[];
}): Promise<void> {
  if (USE_MOCKS) return;
  await apiFetch('/api/mobile/preferences', {
    method: 'POST',
    body: {
      ...(opts.school ? { school: opts.school } : {}),
      ...(opts.dreamCompanies?.length ? { dreamCompanies: opts.dreamCompanies } : {}),
      ...(opts.targetRoles?.length ? { targetRoles: opts.targetRoles } : {}),
      ...(opts.preferredLocations?.length ? { preferredLocations: opts.preferredLocations } : {}),
    },
  });
}
