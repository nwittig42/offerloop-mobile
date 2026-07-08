import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOut, useSharedValue } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';

import { sendScoutMessage, type ScoutAction, type ScoutTurn } from '@/api/endpoints/scout';
import ScoutOrb, { type OrbState } from '@/components/scout/ScoutOrb';
import { useApp } from '@/store/app';
import { fonts } from '@/theme/tokens';
import { requestSpeechPermissions, speechSupported, startListening } from '@/lib/speech';

/**
 * The Scout tab — P1 of PLAN-scout-voice.md ("talk to Scout"). Voice/typed
 * asks go to the existing Scout chat brain; replies render with translated
 * action chips. Receipts and action cards arrive in P2 with the action
 * contract (SCOUT-ACTION-CONTRACT.md).
 *
 * Design rules locked in the P0 review:
 *  - Scout's room is always night (this screen ignores the app theme).
 *  - Chips + type bar are idle furniture: engagement clears the stage.
 *  - The ask stays visible while thinking, with an Edit escape hatch.
 *  - Waiting words are whimsy; real work shows real stages (P2).
 * Voice is feature-detected: on builds without the native speech module the
 * tab is type-first and the orb explains the coming update.
 */

const NIGHT = {
  bg: '#0C1526',
  sky: '#12203A',
  deep: '#0A111F',
  ink: '#EAF0FF',
  ink2: '#8FA3CC',
  ink3: '#5A6B8F',
  line: 'rgba(160,190,255,0.25)',
  lineSoft: 'rgba(160,190,255,0.14)',
  accent: '#3B82F6',
  transcript: '#DCE6FF',
};

const SUGGESTIONS = [
  'Draft 3 IB analysts at Goldman',
  'Find hiring managers at Stripe',
  'Prep me for my next coffee chat',
];

const THINK_WORDS = [
  'Thinking', 'Scouting', 'Charting the route', 'Reading the trail',
  'Checking the map', 'Packing the bag', 'Sniffing around',
];

type Phase = 'idle' | 'listening' | 'thinking';

/** Code-drawn night ridgeline (brand watercolor arrives as a tuned asset in
 *  P2 polish — this keeps the horizon without shipping a light-on-dark PNG). */
function Ridgeline() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '46%' }}>
      <Svg width="100%" height="100%" viewBox="0 0 390 340" preserveAspectRatio="xMidYMax slice">
        <Defs>
          <SvgGradient id="far" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#31437A" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#1B2A44" stopOpacity="0.15" />
          </SvgGradient>
          <SvgGradient id="near" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#22335E" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#101B33" stopOpacity="0.6" />
          </SvgGradient>
        </Defs>
        <Path
          d="M0 150 L55 92 L110 138 L172 70 L235 128 L300 84 L355 122 L390 100 L390 340 L0 340 Z"
          fill="url(#far)"
        />
        <Path
          d="M0 210 L70 150 L140 196 L215 132 L290 190 L350 158 L390 176 L390 340 L0 340 Z"
          fill="url(#near)"
        />
      </Svg>
    </View>
  );
}

export default function ScoutTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useApp();

  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [ask, setAsk] = useState('');
  const [typed, setTyped] = useState('');
  const [reply, setReply] = useState<{ say: string; actions: ScoutAction[] } | null>(null);
  const [thinkWord, setThinkWord] = useState(THINK_WORDS[0]);
  const historyRef = useRef<ScoutTurn[]>([]);
  const requestSeq = useRef(0);
  const stopRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<TextInput>(null);
  const volume = useSharedValue(0);

  const voiceReady = useMemo(() => speechSupported(), []);

  // Rotate the trail vocabulary while thinking.
  useEffect(() => {
    if (phase !== 'thinking') return;
    let i = 0;
    setThinkWord(THINK_WORDS[0]);
    const t = setInterval(() => {
      i = (i + 1) % THINK_WORDS.length;
      setThinkWord(THINK_WORDS[i]);
    }, 1100);
    return () => clearInterval(t);
  }, [phase]);

  const submitAsk = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      const seq = ++requestSeq.current;
      setAsk(clean);
      setReply(null);
      setPhase('thinking');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        const res = await sendScoutMessage({
          message: clean,
          history: historyRef.current,
          currentPage: '/scout',
        });
        if (seq !== requestSeq.current) return; // edited/superseded — drop it
        historyRef.current = [
          ...historyRef.current.slice(-8),
          { role: 'user', content: clean },
          { role: 'assistant', content: res.message },
        ];
        setReply({ say: res.message, actions: res.actions });
        setPhase('idle');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        if (seq !== requestSeq.current) return;
        setPhase('idle');
        setReply({
          say: "I couldn't reach base camp — check your connection and ask me again.",
          actions: [],
        });
      }
    },
    [],
  );

  const beginListening = useCallback(async () => {
    if (!voiceReady) {
      showToast('Voice arrives with the next app update — type below for now');
      inputRef.current?.focus();
      return;
    }
    const ok = await requestSpeechPermissions();
    if (!ok) {
      showToast('Microphone permission is off — type below instead');
      inputRef.current?.focus();
      return;
    }
    setTranscript('');
    setReply(null);
    setPhase('listening');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    let finalText = '';
    stopRef.current = startListening({
      onTranscript: (text) => {
        finalText = text;
        setTranscript(text);
      },
      onVolume: (v) => {
        volume.value = v;
      },
      onEnd: () => {
        stopRef.current = null;
        volume.value = 0;
        // Recognition ended (tap-stop, silence, or final result).
        setPhase((p) => {
          if (p !== 'listening') return p;
          if (finalText.trim()) {
            void submitAsk(finalText);
            return 'thinking';
          }
          return 'idle';
        });
      },
    });
    if (!stopRef.current) {
      setPhase('idle');
      showToast('Voice is unavailable right now — type below instead');
    }
  }, [voiceReady, showToast, submitAsk, volume]);

  const orbPressed = useCallback(() => {
    if (phase === 'listening') {
      stopRef.current?.(); // stop → onEnd handles the handoff
      return;
    }
    if (phase === 'thinking') return; // let it cook; Edit is the escape hatch
    void beginListening();
  }, [phase, beginListening]);

  const editAsk = useCallback(() => {
    requestSeq.current += 1; // orphan any in-flight reply
    setPhase('idle');
    setTyped(ask);
    setTimeout(() => inputRef.current?.focus(), 60);
  }, [ask]);

  const orbState: OrbState = phase === 'idle' ? (reply ? 'done' : 'idle') : phase;

  return (
    <View style={{ flex: 1, backgroundColor: NIGHT.bg }}>
      <LinearGradient
        colors={[NIGHT.sky, NIGHT.bg, NIGHT.deep]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <Ridgeline />

      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 22,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 26, color: NIGHT.ink }}>Scout</Text>
        <Pressable onPress={() => router.push('/notifications')} hitSlop={10}>
          <Text style={{ fontSize: 18 }}>🔔</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={insets.bottom + 46}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 22, paddingBottom: 8 }}
          keyboardShouldPersistTaps="handled">
          <ScoutOrb state={orbState} volume={volume} onPress={orbPressed} />

          {phase === 'listening' ? (
            <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOut.duration(140)} style={{ alignItems: 'center', gap: 10 }}>
              <Text style={{ fontFamily: fonts.sans, fontSize: 16.5, lineHeight: 24, color: NIGHT.transcript, textAlign: 'center' }}>
                {transcript || 'Listening…'}
                <Text style={{ color: '#5B7BFF' }}>▍</Text>
              </Text>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: NIGHT.ink3 }}>
                tap the orb when you're done
              </Text>
            </Animated.View>
          ) : null}

          {phase === 'thinking' ? (
            <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOut.duration(140)} style={{ alignItems: 'center', gap: 10, paddingHorizontal: 12 }}>
              <Text style={{ fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: NIGHT.transcript, textAlign: 'center' }}>
                “{ask}”
              </Text>
              <Pressable
                onPress={editAsk}
                style={{ borderWidth: 1, borderColor: NIGHT.line, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12.5, color: NIGHT.ink2 }}>✎ Edit</Text>
              </Pressable>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: NIGHT.ink2 }}>
                {thinkWord}…
              </Text>
            </Animated.View>
          ) : null}

          {phase === 'idle' && reply ? (
            <Animated.View
              entering={FadeInDown.duration(240)}
              style={{
                width: '96%',
                backgroundColor: 'rgba(255,255,255,0.07)',
                borderColor: NIGHT.line,
                borderWidth: 1,
                borderRadius: 16,
                padding: 15,
                gap: 10,
              }}>
              <Text style={{ fontFamily: fonts.sans, fontSize: 14.5, lineHeight: 21.5, color: NIGHT.ink }}>
                {reply.say}
              </Text>
              {reply.actions.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {reply.actions.map((a) => (
                    <Pressable
                      key={a.label}
                      onPress={() => router.push(a.href as never)}
                      style={{
                        borderRadius: 999,
                        paddingVertical: 7,
                        paddingHorizontal: 13,
                        backgroundColor: 'rgba(59,130,246,0.25)',
                        borderWidth: 1,
                        borderColor: 'rgba(91,123,255,0.5)',
                      }}>
                      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12.5, color: NIGHT.ink }}>
                        {a.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </Animated.View>
          ) : null}

          {phase === 'idle' && !reply ? (
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14.5, color: NIGHT.ink2, textAlign: 'center', paddingHorizontal: 30 }}>
              {voiceReady ? 'Tap and ask Scout for anything' : 'Ask Scout for anything — voice arrives with the next update'}
            </Text>
          ) : null}

          {phase === 'idle' ? (
            <View style={{ alignItems: 'center', gap: 12, width: '100%' }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => void submitAsk(s)}
                    style={{
                      borderWidth: 1,
                      borderColor: NIGHT.line,
                      borderRadius: 999,
                      paddingVertical: 8,
                      paddingHorizontal: 13,
                      backgroundColor: 'rgba(255,255,255,0.04)',
                    }}>
                    <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12.5, color: '#B9C8EE' }}>{s}</Text>
                  </Pressable>
                ))}
              </View>

              <View
                style={{
                  width: '96%',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  borderWidth: 1,
                  borderColor: NIGHT.lineSoft,
                  borderRadius: 14,
                  paddingLeft: 14,
                  paddingRight: 5,
                  paddingVertical: 5,
                  backgroundColor: 'rgba(255,255,255,0.03)',
                }}>
                <TextInput
                  ref={inputRef}
                  value={typed}
                  onChangeText={setTyped}
                  placeholder="Type a command…"
                  placeholderTextColor={NIGHT.ink3}
                  returnKeyType="send"
                  onSubmitEditing={() => {
                    const t = typed;
                    setTyped('');
                    void submitAsk(t);
                  }}
                  style={{ flex: 1, color: NIGHT.transcript, fontFamily: fonts.sans, fontSize: 14.5, paddingVertical: 8 }}
                />
                <Pressable
                  onPress={() => {
                    const t = typed;
                    setTyped('');
                    void submitAsk(t);
                  }}
                  style={{ backgroundColor: NIGHT.accent, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 13 }}>
                  <Text style={{ color: '#fff', fontFamily: fonts.sansSemibold, fontSize: 13 }}>➤</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
