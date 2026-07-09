/**
 * Scout's voice (text-to-speech via expo-speech, on-device). FEATURE-DETECTED
 * like src/lib/speech.ts: the native module only exists in builds cut after
 * 2026-07-08, but this JS OTAs to older builds — so all access is lazy and
 * failure is silent (Scout just stays quiet on old builds).
 *
 * Voice quality: iOS ships a flat "Compact" voice by default, but most
 * devices have Enhanced/Premium neural voices available (and more can be
 * downloaded in Settings → Accessibility → Spoken Content → Voices). We pick
 * the best en-US voice the device actually has, once, at first speak.
 */

type SpeechModule = typeof import('expo-speech');

let cached: SpeechModule | null | undefined;

function mod(): SpeechModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cached = require('expo-speech') as SpeechModule;
    void cached.speak;
  } catch {
    cached = null;
  }
  return cached;
}

/** Best available voice identifier, resolved once. undefined = not yet
 *  resolved, null = resolved to "use the system default". */
let bestVoice: string | null | undefined;

/** Siri voices are never exposed to apps; among the rest, Premium beats
 *  Enhanced beats Default/Compact. Ava/Zoe/Evan/Nathan are the natural
 *  neural voices most iPhones already have. */
const PREFERRED_NAMES = ['ava', 'zoe', 'evan', 'nathan', 'samantha', 'allison', 'joelle', 'noelle'];

function resolveBestVoice(m: SpeechModule) {
  if (bestVoice !== undefined) return;
  bestVoice = null; // resolve once; fall back to default if anything below fails
  m.getAvailableVoicesAsync()
    .then((voices) => {
      const enUS = voices.filter((v) => v.language === 'en-US');
      const byQuality = (q: string) => enUS.filter((v) => (v.quality || '').toLowerCase() === q);
      // Premium first, then Enhanced; within a tier prefer the known-natural names.
      for (const tier of [byQuality('premium'), byQuality('enhanced')]) {
        if (!tier.length) continue;
        const named = tier.find((v) =>
          PREFERRED_NAMES.some((n) => (v.name || '').toLowerCase().includes(n)),
        );
        bestVoice = (named ?? tier[0]).identifier;
        return;
      }
    })
    .catch(() => {
      /* keep system default */
    });
}

/** Speak Scout's reply aloud. No-op on builds without the module. */
export function speak(text: string) {
  const m = mod();
  if (!m || !text) return;
  try {
    resolveBestVoice(m); // async; first utterance may use the default voice
    m.stop();
    m.speak(text, {
      language: 'en-US',
      ...(bestVoice ? { voice: bestVoice } : {}),
      // Slightly under system rate + a touch of pitch reads as calm and
      // deliberate instead of text-to-speech-in-a-hurry.
      pitch: 1.0,
      rate: 0.95,
    });
  } catch {
    /* stay quiet */
  }
}

export function stopSpeaking() {
  try {
    mod()?.stop();
  } catch {
    /* already quiet */
  }
}
