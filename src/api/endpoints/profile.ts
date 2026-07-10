import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';

export type EnrichResult = { enriched: boolean; error?: string };

/**
 * Trigger LinkedIn enrichment for the signed-in user. Reuses the web
 * onboarding endpoint (POST /api/enrich-linkedin-onboarding) which scrapes +
 * structures the profile and writes linkedinUrl / resumeParsed /
 * linkedinResumeParsed to Firestore — so a subsequent /me refetch fills in
 * grad year, school, experiences, and the LinkedIn highlights. Slow (live
 * scrape, ~10–25s). Returns enriched=false with a reason on failure.
 */
export async function enrichLinkedin(linkedinUrl: string): Promise<EnrichResult> {
  if (USE_MOCKS) return { enriched: true };
  const res = await apiFetch<{ enriched?: boolean; error?: string }>(
    '/api/enrich-linkedin-onboarding',
    { method: 'POST', body: { linkedin_url: linkedinUrl } },
  );
  return { enriched: Boolean(res?.enriched), error: res?.error };
}

/** Gmail connect, in-app (the product runs on Gmail: real sends, drafts in
 *  their own account, reply tracking). The backend start route returns the
 *  Google auth URL; `surface=mobile` tells its callback to bounce back to
 *  offerloop://gmail-connected so the auth session closes on its own. */
export async function startGmailOAuth(): Promise<string> {
  const r = await apiFetch<{ authUrl: string }>('/api/google/oauth/start?surface=mobile', {
    timeoutMs: 20_000,
  });
  if (!r?.authUrl) throw new Error('Could not start the Gmail connection.');
  return r.authUrl;
}
