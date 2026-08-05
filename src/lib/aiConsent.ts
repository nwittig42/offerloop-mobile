import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useSyncExternalStore } from 'react';

/**
 * AI data-sharing consent (App Review 5.1.1(i)/5.1.2(i), rejected 2026-08-05):
 * before any feature sends personal data to our AI providers (OpenAI,
 * Anthropic, Perplexity via the Offerloop backend), the user must be told
 * what is sent and to whom, and agree. The choice is stored per account and
 * changeable any time in Profile > Settings.
 *
 * States: null = never asked (gate on sign-in), 'granted', 'declined'.
 * Declined users keep the whole app EXCEPT the AI-powered actions (drafting,
 * auto-apply, Scout, meeting prep, resume parsing), which re-prompt on use.
 */

export type AIConsent = 'granted' | 'declined' | null;

const keyFor = (uid: string) => `offerloop.aiConsent.${uid}`;

let currentUid: string | null = null;
let value: AIConsent = null;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

/** Load (or re-load) the stored choice when the signed-in account changes. */
export async function loadAIConsent(uid: string | null): Promise<void> {
  currentUid = uid;
  loaded = false;
  value = null;
  emit();
  if (!uid) {
    loaded = true;
    emit();
    return;
  }
  try {
    const raw = await AsyncStorage.getItem(keyFor(uid));
    value = raw === 'granted' || raw === 'declined' ? raw : null;
  } catch {
    value = null;
  }
  loaded = true;
  emit();
}

export async function setAIConsent(next: Exclude<AIConsent, null>): Promise<void> {
  value = next;
  emit();
  if (currentUid) {
    try {
      await AsyncStorage.setItem(keyFor(currentUid), next);
    } catch {
      // Storage failure: the in-memory choice still governs this session and
      // the gate simply re-asks next launch. Never block the user on it.
    }
  }
}

/** Synchronous check for non-React call sites (store actions, uploadResume). */
export function hasAIConsent(): boolean {
  return value === 'granted';
}

/** Re-prompt from an AI action the user tried while unconsented. */
export function promptAIConsent(): void {
  router.push({ pathname: '/ai-consent', params: { mode: 'prompt' } });
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** React view of the consent state, shared app-wide. */
export function useAIConsent(): { consent: AIConsent; consentLoaded: boolean } {
  const consent = useSyncExternalStore(subscribe, () => value);
  const consentLoaded = useSyncExternalStore(subscribe, () => loaded);
  return { consent, consentLoaded };
}
