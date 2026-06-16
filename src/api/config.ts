import Constants from 'expo-constants';

/**
 * API base URL resolution. The host root only (no trailing /api); endpoint
 * functions include the full `/api/...` path so they read 1:1 against the
 * backend routes. Set `expo.extra.apiBaseUrl` in app.json (or the
 * EXPO_PUBLIC_API_BASE_URL env var) per environment; dev falls back to the
 * local Flask host on port 5001.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as { apiBaseUrl?: string; useMocks?: boolean };

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_BASE_URL || extra.apiBaseUrl || 'http://localhost:5001';

export const IS_DEV: boolean = __DEV__;

/**
 * When true, endpoint functions return mock fixtures instead of hitting the
 * network, so the app still runs fully offline. Defaults on only in dev when no
 * base URL is configured, or when EXPO_PUBLIC_USE_MOCKS is set.
 */
export const USE_MOCKS: boolean =
  process.env.EXPO_PUBLIC_USE_MOCKS === '1' || extra.useMocks === true;
