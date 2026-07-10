import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

/**
 * API base URL resolution. The host root only (no trailing /api); endpoint
 * functions include the full `/api/...` path so they read 1:1 against the
 * backend routes. Set `expo.extra.apiBaseUrl` in app.json (or the
 * EXPO_PUBLIC_API_BASE_URL env var) per environment; dev falls back to the
 * local Flask host on port 5001.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as { apiBaseUrl?: string; useMocks?: boolean };

/**
 * In dev, derive the backend host from Metro's own host (the "debuggerHost" /
 * hostUri that the app already connected to for the JS bundle) and just swap in
 * the Flask port. This makes the app auto-follow your Mac's LAN IP every time
 * you change WiFi — no more editing app.json per network. Returns null when the
 * host can't be determined (falls back to app.json / localhost).
 */
function devApiBaseFromMetro(): string | null {
  const hostUri =
    (Constants.expoConfig as any)?.hostUri ||
    (Constants as any)?.expoGoConfig?.debuggerHost ||
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri ||
    '';
  const host = String(hostUri).split(':')[0];
  // Only trust an actual LAN/host address, not a tunnel domain.
  return host && host !== 'localhost' && /[.\d]/.test(host) ? `http://${host}:5001` : null;
}

/**
 * Internal field builds (preview channel) always talk to the staging backend.
 * Hardcoded — NOT via EXPO_PUBLIC_API_BASE_URL — because env inlining applies
 * to `eas build` but proved unreliable for `eas update` bundles, which then
 * fell through to the stale LAN IP in extra.apiBaseUrl. The channel check
 * keeps dev (Metro-derived) and production (env/extra) resolution unchanged.
 */
const PREVIEW_API_BASE_URL = 'https://offerloop-staging.onrender.com';

/**
 * Production (App Store) builds: same host, same hardcode rationale. The
 * mobile API surface (/api/mobile/*) lives on the staging service — NOT on
 * offerloop.ai, whose backend deploys from origin/main and has no mobile
 * routes (submission decision, 2026-07-09; graduation path is a pinned
 * prod/mobile Render service + an OTA that swaps this constant).
 */
const PRODUCTION_API_BASE_URL = 'https://offerloop-staging.onrender.com';

export const API_BASE_URL: string =
  (!__DEV__ && Updates.channel === 'preview' ? PREVIEW_API_BASE_URL : null) ||
  (!__DEV__ && Updates.channel === 'production' ? PRODUCTION_API_BASE_URL : null) ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (__DEV__ ? devApiBaseFromMetro() : null) ||
  extra.apiBaseUrl ||
  'http://localhost:5001';

export const IS_DEV: boolean = __DEV__;

/**
 * When true, endpoint functions return mock fixtures instead of hitting the
 * network, so the app still runs fully offline. Defaults on only in dev when no
 * base URL is configured, or when EXPO_PUBLIC_USE_MOCKS is set.
 */
export const USE_MOCKS: boolean =
  process.env.EXPO_PUBLIC_USE_MOCKS === '1' || extra.useMocks === true;
