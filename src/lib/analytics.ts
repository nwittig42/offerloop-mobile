import Constants from 'expo-constants';

import { safeStringify } from '@/lib/safeJson';

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

// Tag every event so dev/test runs are filterable out of the shared prod project
// (dev builds point at the prod PostHog so mobile + web unify). Filter
// `environment = production` in PostHog to see only real users; also worth
// excluding internal test uids as internal users in project settings.
const ENV = __DEV__ ? 'development' : 'production';
const BASE_PROPS = { $lib: 'offerloop-mobile', environment: ENV };

let distinctId: string | null = null;

function post(payload: Record<string, unknown>) {
  if (!KEY) return;
  // Fire-and-forget; analytics must never throw into the UI or block a tap.
  // safeStringify: a circular/pathological property can't SIGSEGV Hermes.
  const body = safeStringify({ api_key: KEY, ...payload });
  if (!body) return;
  fetch(`${HOST}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => {});
}

/** Tie subsequent events to this user. uid = the same distinct_id the web uses,
 *  so a student's mobile + web activity is one person in PostHog. */
export function identify(uid: string, personProps: Record<string, unknown> = {}) {
  distinctId = uid;
  post({
    event: '$identify',
    distinct_id: uid,
    properties: { $set: personProps, ...BASE_PROPS },
    timestamp: new Date().toISOString(),
  });
}

/** Point events at (or clear) the current user without emitting an $identify. */
export function setAnalyticsUser(uid: string | null) {
  distinctId = uid;
}

// Sign-in happens BEFORE there is a distinct_id to send with, so the screen
// that started it records the method here and the store emits `signed_in`
// the moment the uid lands (Rylan 2026-09-08: the funnel needs sign-in by
// method: apple, google, password, magic_link, email_new).
let pendingSignInMethod: string | null = null;
export function setPendingSignInMethod(method: string | null) {
  pendingSignInMethod = method;
}
export function takePendingSignInMethod(): string | null {
  const m = pendingSignInMethod;
  pendingSignInMethod = null;
  return m;
}

/** Capture an event. Pass `$set` inside properties to also set person properties
 *  (e.g. track('x', { $set: { referral_source: 'reddit' } })). No-op pre-auth. */
export function track(event: string, properties: Record<string, unknown> = {}) {
  if (!distinctId) return;
  post({
    event,
    distinct_id: distinctId,
    properties: { ...properties, ...BASE_PROPS },
    timestamp: new Date().toISOString(),
  });
}

/**
 * JS crash capture (Rylan 2026-09-08: "saved, then it crashed" with nothing
 * to read). Sentry needs a native module and a store build; this catches
 * every uncaught JavaScript error over the air and files it in PostHog as
 * `app_crash` with the message and the top of the stack, then lets the
 * default handler run so the app still shows its error screen. Native
 * crashes (memory, native modules) are not covered; those are Sentry's job.
 * No user content is sent, only the error text and stack frames.
 */
type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
let installed = false;
export function installCrashCapture() {
  if (installed) return;
  installed = true;
  const utils = (globalThis as { ErrorUtils?: { getGlobalHandler: () => GlobalHandler; setGlobalHandler: (h: GlobalHandler) => void } }).ErrorUtils;
  if (!utils) return;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    try {
      const err = error as { message?: string; stack?: string; name?: string };
      post({
        event: 'app_crash',
        distinct_id: distinctId || 'pre-auth',
        properties: {
          ...BASE_PROPS,
          fatal: !!isFatal,
          name: String(err?.name || 'Error').slice(0, 80),
          message: String(err?.message || error).slice(0, 500),
          stack: String(err?.stack || '').split('\n').slice(0, 12).join('\n').slice(0, 2000),
        },
        timestamp: new Date().toISOString(),
      });
    } catch {
      /* never let the reporter itself throw */
    }
    previous?.(error, isFatal);
  });
}
