import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';

/**
 * Remote feature flags (Rylan 2026-09-11): a kill switch / gradual rollout
 * lever so a risky new feature can ship inside a native build turned off,
 * then get switched on (fully or for a slice of users) with zero app update,
 * not even OTA. The server resolves rollout percentages to plain booleans, so
 * this is just a flat map of flag name -> on/off.
 *
 * No mock fixture: every flag defaults to off (see useApp().isFlagEnabled),
 * so mock mode behaves exactly like a fresh install that hasn't fetched yet.
 */
export type FeatureFlags = Record<string, boolean>;

export async function getFlags(): Promise<FeatureFlags> {
  if (USE_MOCKS) return {};
  return apiFetch<FeatureFlags>('/api/mobile/flags');
}
