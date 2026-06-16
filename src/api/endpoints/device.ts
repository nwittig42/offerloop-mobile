import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';

/**
 * Register this device's Expo push token with the backend so it can push
 * reply / draft-ready alerts (POST /api/mobile/device). No-op under mocks.
 */
export async function registerDevice(input: { token: string; platform: string }): Promise<void> {
  if (USE_MOCKS) return;
  await apiFetch('/api/mobile/device', { method: 'POST', body: input });
}
