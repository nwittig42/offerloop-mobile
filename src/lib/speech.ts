/**
 * On-device speech recognition (Apple SFSpeechRecognizer via
 * expo-speech-recognition). FEATURE-DETECTED: the native module only exists
 * in builds cut after 2026-07-07, but this JS ships over the air to older
 * builds too — so every access goes through lazy require + try/catch, and
 * callers render a type-first UI when voice isn't available yet.
 * Recognition runs on-device (requiresOnDeviceRecognition) for the live
 * transcript; when a caller passes onAudioFile, the raw clip is also
 * persisted locally and MAY be uploaded for server transcription — gated to
 * founder accounts until the permission-copy build ships (see app.json note
 * in the voice-overhaul plan).
 */

type SpeechModule = typeof import('expo-speech-recognition');

let cached: SpeechModule | null | undefined;

function mod(): SpeechModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cached = require('expo-speech-recognition') as SpeechModule;
    // Touch the native module so a JS-only OTA on an old binary fails HERE,
    // quietly, instead of at start().
    void cached.ExpoSpeechRecognitionModule.getStateAsync;
  } catch {
    cached = null;
  }
  return cached;
}

/** Voice is possible on this build (native module present). */
export function speechSupported(): boolean {
  return mod() !== null;
}

export async function requestSpeechPermissions(): Promise<boolean> {
  const m = mod();
  if (!m) return false;
  try {
    const res = await m.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return !!res.granted;
  } catch {
    return false;
  }
}

export type SpeechEvents = {
  /** Fires repeatedly with the best transcript so far (interim + final). */
  onTranscript: (text: string, isFinal: boolean) => void;
  /** Recognition ended (stop(), final result, error, or silence timeout). */
  onEnd: () => void;
  /** Live input loudness 0..1 for the orb. */
  onVolume?: (level: number) => void;
  /** Domain vocabulary the recognizer should favor (firm names, the user's
   *  targets) — SFSpeechRecognitionRequest.contextualStrings on iOS. Apple
   *  wants this list short and specific, so callers should cap it. */
  contextualStrings?: string[];
  /** URI of the persisted recording (voice overhaul P2) — fires on the
   *  native 'audioend' event, null on platforms that can't record
   *  (Android <13). The file is the raw ask, uploadable for server ASR. */
  onAudioFile?: (uri: string | null) => void;
};

/** Start listening. Returns a stop() function, or null if unavailable. */
export function startListening(events: SpeechEvents): (() => void) | null {
  const m = mod();
  if (!m) return null;

  let subs: { remove: () => void }[] = [];
  try {
    subs = [
    m.ExpoSpeechRecognitionModule.addListener('result', (e: any) => {
      const text = e?.results?.[0]?.transcript ?? '';
      events.onTranscript(text, !!e?.isFinal);
    }),
    m.ExpoSpeechRecognitionModule.addListener('volumechange', (e: any) => {
      // value arrives roughly in [-2, 10] dBish range per docs; normalize.
      const v = typeof e?.value === 'number' ? Math.max(0, Math.min(1, (e.value + 2) / 12)) : 0;
      events.onVolume?.(v);
    }),
    m.ExpoSpeechRecognitionModule.addListener('audioend', (e: any) => {
      events.onAudioFile?.(e?.uri ?? null);
    }),
    m.ExpoSpeechRecognitionModule.addListener('end', () => {
      subs.forEach((s) => s.remove());
      events.onEnd();
    }),
    m.ExpoSpeechRecognitionModule.addListener('error', () => {
      // 'end' fires after 'error'; nothing extra to do — onEnd handles cleanup.
    }),
    ];
  } catch {
    subs.forEach((x) => x.remove());
    return null;
  }

  try {
    m.ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: false,
      requiresOnDeviceRecognition: true,
      addsPunctuation: true,
      volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
      ...(events.contextualStrings?.length
        ? { contextualStrings: events.contextualStrings.slice(0, 120) }
        : {}),
      // Persist the raw ask audio (voice overhaul P2) so the server can
      // transcribe it with a vocabulary-primed model. iOS may ignore the
      // 16k hint and emit 44.1k — the server reads the WAV header, and a
      // 10s clip is <1MB either way. On-device recognition still runs for
      // the live transcript; the callers' founder gate decides uploads.
      ...(events.onAudioFile
        ? {
            recordingOptions: {
              persist: true,
              outputFileName: `scout_ask_${Date.now()}.wav`,
              outputSampleRate: 16000,
              outputEncoding: 'pcmFormatInt16',
            },
          }
        : {}),
    });
  } catch {
    subs.forEach((s) => s.remove());
    return null;
  }

  return () => {
    try {
      m.ExpoSpeechRecognitionModule.stop();
    } catch {
      /* end event still fires */
    }
  };
}
