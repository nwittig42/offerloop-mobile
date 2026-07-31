import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';

/**
 * Web checkout handoff (SPEC-app-web-upgrade-handoff.md).
 *
 * POST /api/mobile/web-handoff mints a one-time code (60s TTL, single-use,
 * minted server-side against the Firebase ID token) and returns the checkout
 * URL on www.offerloop.ai. The app opens it in Safari; the web page exchanges
 * the code and signs the user in as the same uid, so there is no re-onboarding
 * and no email round-trip. All payment happens on the web. The app itself
 * sells nothing and captures no payment.
 *
 * The code expires in 60 seconds, so always mint fresh on tap, never prefetch.
 */
export async function requestWebHandoff(): Promise<string> {
  if (USE_MOCKS) return 'https://www.offerloop.ai/checkout';
  const r = await apiFetch<{ url?: string }>('/api/mobile/web-handoff', {
    method: 'POST',
    timeoutMs: 15_000,
  });
  if (!r?.url) throw new Error('No checkout URL in handoff response');
  return r.url;
}
