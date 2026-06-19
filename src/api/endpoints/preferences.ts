import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';

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
