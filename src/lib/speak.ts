/**
 * Scout's voice (text-to-speech via expo-speech, on-device). FEATURE-DETECTED
 * like src/lib/speech.ts: the native module only exists in builds cut after
 * 2026-07-08, but this JS OTAs to older builds — so all access is lazy and
 * failure is silent (Scout just stays quiet on old builds).
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

/** Speak Scout's reply aloud. No-op on builds without the module. */
export function speak(text: string) {
  const m = mod();
  if (!m || !text) return;
  try {
    m.stop();
    m.speak(text, { language: 'en-US', pitch: 1.02, rate: 1.0 });
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
