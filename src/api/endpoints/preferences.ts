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

/** Persist the onboarding goal (target track). Posts to the same preferences
 *  endpoint; the backend persists targetRoles/industries to the user doc (which
 *  /me already surfaces). Best-effort — safe to call even before the backend
 *  accepts these fields (they're simply ignored until then). */
export async function saveTargetTrack(opts: {
  targetRoles?: string[];
  industries?: string[];
}): Promise<void> {
  if (USE_MOCKS) return;
  await apiFetch('/api/mobile/preferences', {
    method: 'POST',
    body: {
      ...(opts.targetRoles ? { targetRoles: opts.targetRoles } : {}),
      ...(opts.industries ? { industries: opts.industries } : {}),
    },
  });
}
