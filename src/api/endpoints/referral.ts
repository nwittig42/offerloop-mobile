import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';

export type Referral = {
  code: string;
  shareUrl: string;
  joined: number;
  goal: number;
  unlocked: boolean;
};

/** The user's referral code + live progress toward free Elite. Returns null when
 *  the endpoint isn't live / errors, so the CTA renders nothing rather than a
 *  broken card. The reward is granted web-side; the app only shares + displays. */
export async function fetchReferral(): Promise<Referral | null> {
  if (USE_MOCKS) {
    return { code: 'DEMO123', shareUrl: 'https://offerloop.ai/?ref=DEMO123', joined: 2, goal: 5, unlocked: false };
  }
  try {
    return await apiFetch<Referral>('/api/mobile/referral', { timeoutMs: 8_000 });
  } catch {
    return null;
  }
}
