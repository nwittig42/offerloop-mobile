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
