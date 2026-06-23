import Constants from 'expo-constants';

/**
 * Lightweight PostHog client — fetch to the capture API, no native module (so it
 * runs on the current dev build with no rebuild). Use the SAME project key + host
 * as the web app so mobile and web events unify under one PostHog project, keyed
 * on the Firebase uid as distinct_id (the same identity the web uses).
 *
 * Config via app.json -> expo.extra.posthogKey / posthogHost, or the
 * EXPO_PUBLIC_POSTHOG_KEY / EXPO_PUBLIC_POSTHOG_HOST env vars. With no key set,
 * every call is a no-op (analytics simply disabled) — safe to ship before the
 * key is wired.
 */

const extra = (Constants.expoConfig?.extra ?? {}) as { posthogKey?: string; posthogHost?: string };
const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY || extra.posthogKey || '';
const HOST = (process.env.EXPO_PUBLIC_POSTHOG_HOST || extra.posthogHost || 'https://us.i.posthog.com').replace(
  /\/+$/,
  '',
);

export const analyticsEnabled = !!KEY;

let distinctId: string | null = null;

function post(payload: Record<string, unknown>) {
  if (!KEY) return;
  // Fire-and-forget; analytics must never throw into the UI or block a tap.
  fetch(`${HOST}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: KEY, ...payload }),
  }).catch(() => {});
}

/** Tie subsequent events to this user. uid = the same distinct_id the web uses,
 *  so a student's mobile + web activity is one person in PostHog. */
export function identify(uid: string, personProps: Record<string, unknown> = {}) {
  distinctId = uid;
  post({
    event: '$identify',
    distinct_id: uid,
    properties: { $set: personProps, $lib: 'offerloop-mobile' },
    timestamp: new Date().toISOString(),
  });
}

/** Point events at (or clear) the current user without emitting an $identify. */
export function setAnalyticsUser(uid: string | null) {
  distinctId = uid;
}

/** Capture an event. Pass `$set` inside properties to also set person properties
 *  (e.g. track('x', { $set: { referral_source: 'reddit' } })). No-op pre-auth. */
export function track(event: string, properties: Record<string, unknown> = {}) {
  if (!distinctId) return;
  post({
    event,
    distinct_id: distinctId,
    properties: { ...properties, $lib: 'offerloop-mobile' },
    timestamp: new Date().toISOString(),
  });
}
