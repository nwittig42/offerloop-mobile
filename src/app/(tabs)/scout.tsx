import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOut, LinearTransition, useSharedValue } from 'react-native-reanimated';

import { apiFetch } from '@/api/client';
import { sendScoutMessage, type ScoutAction, type ScoutTurn } from '@/api/endpoints/scout';
import {
  ackFor,
  applyScope,
  clarifyFor,
  executeApplyIntent,
  executeDraftIntent,
  normalizeAsk,
  parseIntent,
  preflightFor,
  refineOptions,
  suggestFirm,
  type Preflight,
  type ActionProgress,
  type DraftIntent,
} from '@/api/endpoints/scoutActions';
import { pollDraftJob } from '@/api/endpoints/swipe';
import ScoutOrb, { type OrbState } from '@/components/scout/ScoutOrb';
import type { Job } from '@/types';
import { useApp } from '@/store/app';
import { fonts } from '@/theme/tokens';
import ScoutErrorBoundary from '@/components/scout/ScoutErrorBoundary';
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

/** Rotating pool — three show at a time, refreshing while the tab idles so
 *  the door never looks the same twice (all real, runnable asks). */
const SUGGESTION_POOL = [
  'Draft 3 IB analysts at Goldman Sachs',
  'Find hiring managers at Stripe',
  'Prep me for my next coffee chat',
  'Analysts at Morgan Stanley in LA',
  'Draft 2 consultants at McKinsey',
  'Recruiters at Google',
  'Apply to my saved jobs',
  'Associates at Evercore in New York',
  'Draft someone on the deal team at Lazard',
];

const THINK_WORDS = [
  'Thinking', 'Scouting', 'Charting the route', 'Reading the trail',
  'Checking the map', 'Packing the bag', 'Sniffing around',
];

type Phase = 'idle' | 'listening' | 'thinking' | 'clarify' | 'receipt';

/** A live action card — the job plumbing wearing Scout's clothes. */
type ActionCard = {
  id: string;
  title: string;
  stageLabel: string;
  progressPct: number;
};

/** The brand watercolor, night-tinted offline (light sky baked to
 *  transparency, ridges to glowing periwinkle) so it draws exactly like the
 *  mock's blended horizon without runtime blend modes. */
const RIDGES = require('../../../assets/images/scout-ridges-night.png');

function Ridgeline() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '44%' }}>
      <Image
        source={RIDGES}
        resizeMode="cover"
        style={{ width: '100%', height: '100%', opacity: 0.9 }}
      />
    </View>
  );
}

export default function ScoutTab() {
  return (
    <ScoutErrorBoundary>
      <ScoutTabInner />
    </ScoutErrorBoundary>
  );
}

function ScoutTabInner() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast, unreadCount, savedJobs, profile } = useApp();

  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [ask, setAsk] = useState('');
  const [typed, setTyped] = useState('');
  const [reply, setReply] = useState<{ say: string; actions: ScoutAction[] } | null>(null);
  const [thinkWord, setThinkWord] = useState(THINK_WORDS[0]);
  const [cards, setCards] = useState<ActionCard[]>([]);
  const [clarify, setClarify] = useState<{ question: string; baseAsk: string } | null>(null);
  const [didYouMean, setDidYouMean] = useState<{ intent: DraftIntent; suggestion: string } | null>(null);
  const [refine, setRefine] = useState<{ heard: string; options: string[] } | null>(null);
  const [preflight, setPreflight] = useState<{ pf: Preflight; intent: DraftIntent } | null>(null);
  const [sugOffset, setSugOffset] = useState(0);
  const [receipt, setReceipt] = useState<{
    eligible: Job[];
    tiers: { id: string; label: string; count: number; creditEstimate: number }[];
    chosen: number;
  } | null>(null);
  const historyRef = useRef<ScoutTurn[]>([]);
  const requestSeq = useRef(0);
  const stopRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<TextInput>(null);
  const volume = useSharedValue(0);

  // Deliberately NOT probed at mount: the very first touch of the native
  // speech module happens on the user's tap, so screen-open can never crash
  // from it (post-crash hardening, 2026-07-08).
  const voiceReady = () => speechSupported();

  // The reply card excuses itself: tapping its chip clears it, and otherwise
  // it fades out after a while so the tab returns to a clean idle.
  useEffect(() => {
    if (!reply) return;
    const t = setTimeout(() => setReply(null), 20_000);
    return () => clearTimeout(t);
  }, [reply]);

  // Rotate the suggestion chips while the tab idles.
  useEffect(() => {
    if (phase !== 'idle') return;
    const t = setInterval(() => setSugOffset((o) => (o + 3) % SUGGESTION_POOL.length), 8000);
    return () => clearInterval(t);
  }, [phase]);

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

  const upsertCard = useCallback((card: ActionCard) => {
    setCards((prev) => {
      const i = prev.findIndex((c) => c.id === card.id);
      if (i === -1) return [...prev, card];
      const next = prev.slice();
      next[i] = card;
      return next;
    });
  }, []);
  const dropCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const runDraftAction = useCallback(
    async (intent: DraftIntent) => {
      const id = `scout-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      const title = intent.company
        ? `${intent.hm ? 'Hiring managers' : 'Outreach'} · ${intent.company}`
        : `Outreach · ${intent.role}`;
      setReply({ say: ackFor(intent), actions: [] });
      setPhase('idle');
      upsertCard({ id, title, stageLabel: 'Starting…', progressPct: 4 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        const res = await executeDraftIntent(intent, id, (p: ActionProgress) => {
          upsertCard({
            id,
            title,
            stageLabel: p.found ? `Found ${p.found} — ${p.stageLabel.toLowerCase()}` : p.stageLabel,
            progressPct: p.progressPct,
          });
        });
        dropCard(id);
        setReply({
          say: res.say,
          actions: res.names.length ? [{ label: 'Open Inbox', href: '/(tabs)/inbox' }] : [],
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        dropCard(id);
        setReply({
          say: "That one didn't finish — nothing was charged for anyone I couldn't draft. Ask me again.",
          actions: [],
        });
      }
    },
    [upsertCard, dropCard],
  );

  const runApplyAction = useCallback(
    async (jobs: Job[]) => {
      const id = `apply-${Date.now()}`;
      const title = `Applying to ${jobs.length} saved job${jobs.length === 1 ? '' : 's'}`;
      setReceipt(null);
      setPhase('idle');
      setReply({ say: `On it — submitting ${jobs.length} application${jobs.length === 1 ? '' : 's'}.`, actions: [] });
      upsertCard({ id, title, stageLabel: 'Starting…', progressPct: 4 });
      try {
        const res = await executeApplyIntent(jobs, (p: ActionProgress) => {
          upsertCard({ id, title, stageLabel: p.stageLabel, progressPct: p.progressPct });
        });
        dropCard(id);
        setReply({ say: res.say, actions: [{ label: 'Open Applications', href: '/(tabs)/network' }] });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        dropCard(id);
        setReply({ say: 'Those applications hit a snag — check Applications for details.', actions: [] });
      }
    },
    [upsertCard, dropCard],
  );

  // Re-hydration (SCOUT-ACTION-CONTRACT.md): after an app kill, in-flight
  // server work re-appears as cards instead of silently finishing offstage.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await apiFetch<{ items: { jobRef: { kind: string; id: string }; title: string; stageLabel?: string }[] }>(
          '/api/mobile/scout/active',
          { timeoutMs: 15_000 },
        );
        for (const item of r.items || []) {
          if (!alive || item.jobRef.kind !== 'draft_job') continue;
          const id = item.jobRef.id;
          upsertCard({ id, title: item.title, stageLabel: item.stageLabel || 'Working…', progressPct: 30 });
          pollDraftJob(id, (p) => {
            if (!alive) return;
            upsertCard({ id, title: item.title, stageLabel: p.stageLabel || 'Working…', progressPct: p.progressPct || 30 });
          })
            .then(() => {
              if (!alive) return;
              dropCard(id);
              setReply({ say: 'Done — that draft is in your Inbox.', actions: [{ label: 'Open Inbox', href: '/(tabs)/inbox' }] });
            })
            .catch(() => alive && dropCard(id));
        }
      } catch {
        /* re-hydration is best-effort */
      }
    })();
    return () => {
      alive = false;
    };
  }, [upsertCard, dropCard]);

  const submitAsk = useCallback(
    async (text: string) => {
      const norm = normalizeAsk(text.trim());
      let clean = norm.text;
      if (!clean) return;
      setRefine(null);
      setPreflight(null);

      // Clarify round-trip: a short answer ("Goldman Sachs") merges into the
      // held ask; a fresh full ask replaces it. One round max, then best effort.
      if (clarify) {
        const answerIntent = parseIntent(clean);
        if (!(answerIntent?.kind === 'draft' && answerIntent.company)) {
          clean = `${clarify.baseAsk} at ${clean}`;
        }
        setClarify(null);
        const merged = parseIntent(clean);
        if (merged?.kind === 'draft') {
          setAsk(clean);
          void runDraftAction(merged);
          return;
        }
      }

      const intent = parseIntent(clean);
      setAsk(clean);

      if (intent?.kind === 'draft') {
        const c = clarifyFor(intent);
        if (c) {
          setReply(null);
          setClarify({ question: c.question, baseAsk: clean });
          setPhase('clarify');
          return;
        }
        // Did-you-mean rescue: a near-miss of a known firm (ASR damage the
        // fix-map didn't cover) gets one confirm BEFORE spending the run.
        const suggestion = intent.company ? suggestFirm(intent.company) : null;
        if (suggestion) {
          setReply(null);
          setDidYouMean({ intent, suggestion });
          setPhase('idle');
          return;
        }
        // Pre-flight coach: corrected transcripts and senior-role asks pause
        // for one look + reply-friendly variants before credits are spent.
        const pf = preflightFor(intent, clean, norm.corrected ? text.trim() : null, profile?.preferredLocations ?? []);
        if (pf) {
          setReply(null);
          setPreflight({ pf, intent });
          setPhase('idle');
          return;
        }
        void runDraftAction(intent);
        return;
      }

      if (intent?.kind === 'apply_saved') {
        const { eligible, tiers } = applyScope(savedJobs);
        if (!eligible.length) {
          setReply({
            say: "You don't have any auto-apply-eligible saved jobs yet — save a few from the Feed first.",
            actions: [],
          });
          setPhase('idle');
          return;
        }
        setReply(null);
        setReceipt({ eligible, tiers, chosen: tiers[0]?.count ?? Math.min(5, eligible.length) });
        setPhase('receipt');
        return;
      }

      if (intent?.kind === 'prep') {
        setReply({
          say: "Let's prep — pick the person and I'll build the full brief.",
          actions: [{ label: 'Open Meeting Prep', href: '/meeting-prep/new' }],
        });
        setPhase('idle');
        return;
      }

      // Ask names a target but didn't parse into anything runnable — almost
      // always a mishear ("Manners at Goldman Sachs"). NEVER hand these to
      // the chat brain (it answers with false promises); offer complete,
      // tappable variants instead.
      const options = intent ? null : refineOptions(clean, profile?.preferredLocations ?? []);
      if (options?.length) {
        setReply(null);
        setRefine({ heard: clean, options });
        setPhase('idle');
        return;
      }

      // No action intent — regular Scout conversation (P1 behavior).
      const seq = ++requestSeq.current;
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
    [clarify, savedJobs, runDraftAction],
  );

  const beginListening = useCallback(async () => {
    if (!voiceReady()) {
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

  const orbState: OrbState =
    cards.length > 0
      ? 'acting'
      : phase === 'clarify' || phase === 'receipt'
        ? 'idle'
        : phase === 'idle'
          ? reply
            ? 'done'
            : 'idle'
          : phase;

  return (
    <View style={{ flex: 1, backgroundColor: NIGHT.bg }}>
      <LinearGradient
        colors={[NIGHT.sky, NIGHT.bg, NIGHT.deep]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <Ridgeline />

      {/* Title centered like the rest of the app's headers; the bell is the
          standard notifications icon + badge, just on the night palette. */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 22,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <View style={{ width: 32 }} />
        <Text
          style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: fonts.display,
            fontSize: 26,
            color: NIGHT.ink,
          }}>
          Scout
        </Text>
        <Pressable
          onPress={() => router.push('/notifications')}
          hitSlop={10}
          style={{ width: 32, alignItems: 'flex-end' }}>
          <View>
            <Ionicons name="notifications-outline" size={23} color={NIGHT.ink} />
            {unreadCount > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -6,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: '#DC2626',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 3,
                }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 9.5, color: '#fff' }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </View>
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

          {phase === 'clarify' && clarify ? (
            <Animated.View
              entering={FadeInDown.duration(220)}
              style={{ alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
              <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: NIGHT.ink3, textAlign: 'center' }}>
                “{clarify.baseAsk}”
              </Text>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: NIGHT.ink, textAlign: 'center' }}>
                {clarify.question}
              </Text>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: NIGHT.ink3 }}>
                say it, type it below, or
              </Text>
              <Pressable
                onPress={() => {
                  const base = clarify.baseAsk;
                  setClarify(null);
                  setPhase('idle');
                  const intent = parseIntent(base);
                  if (intent?.kind === 'draft') void runDraftAction(intent);
                }}
                style={{ borderWidth: 1, borderColor: NIGHT.line, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 15 }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12.5, color: NIGHT.ink2 }}>
                  Search anywhere
                </Text>
              </Pressable>
            </Animated.View>
          ) : null}

          {phase === 'receipt' && receipt ? (
            <Animated.View
              entering={FadeInDown.duration(220)}
              style={{
                width: '96%',
                backgroundColor: 'rgba(255,255,255,0.07)',
                borderColor: NIGHT.line,
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
                gap: 11,
              }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: NIGHT.ink }}>
                You have {receipt.eligible.length} saved job{receipt.eligible.length === 1 ? '' : 's'} ready
              </Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: NIGHT.ink2 }}>
                Pick a scope — applications submit for real:
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {receipt.tiers.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => setReceipt({ ...receipt, chosen: t.count })}
                    style={{
                      borderRadius: 999,
                      paddingVertical: 7,
                      paddingHorizontal: 12,
                      borderWidth: 1,
                      borderColor: receipt.chosen === t.count ? 'rgba(91,123,255,0.7)' : NIGHT.line,
                      backgroundColor: receipt.chosen === t.count ? 'rgba(59,130,246,0.3)' : 'transparent',
                    }}>
                    <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12.5, color: receipt.chosen === t.count ? NIGHT.ink : '#B9C8EE' }}>
                      {t.label} · {t.creditEstimate} cr
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 9, marginTop: 3 }}>
                <Pressable
                  onPress={() => {
                    setReceipt(null);
                    setPhase('idle');
                  }}
                  style={{ flex: 1, borderWidth: 1, borderColor: NIGHT.line, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: NIGHT.ink2 }}>Not now</Text>
                </Pressable>
                <Pressable
                  onPress={() => void runApplyAction(receipt.eligible.slice(0, receipt.chosen))}
                  style={{ flex: 1, backgroundColor: NIGHT.accent, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: '#fff' }}>
                    Apply to {receipt.chosen}
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : null}

          {cards.map((c) => (
            <Animated.View
              key={c.id}
              entering={FadeInDown.duration(220)}
              style={{
                width: '96%',
                backgroundColor: 'rgba(255,255,255,0.07)',
                borderColor: NIGHT.line,
                borderWidth: 1,
                borderRadius: 15,
                padding: 14,
                gap: 8,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color="#9DB4FF" />
                <Text style={{ flex: 1, fontFamily: fonts.sansSemibold, fontSize: 13.5, color: NIGHT.ink }}>{c.title}</Text>
              </View>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: '#9DB4FF' }}>{c.stageLabel}</Text>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(160,190,255,0.18)', overflow: 'hidden' }}>
                <Animated.View
                  layout={LinearTransition.duration(700)}
                  style={{
                    height: '100%',
                    width: `${Math.max(4, Math.min(c.progressPct, 96))}%`,
                    borderRadius: 2,
                    backgroundColor: NIGHT.accent,
                  }}
                />
              </View>
            </Animated.View>
          ))}

          {phase === 'idle' && preflight ? (
            <Animated.View
              entering={FadeInDown.duration(220)}
              style={{
                width: '96%',
                backgroundColor: 'rgba(255,255,255,0.07)',
                borderColor: NIGHT.line,
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
                gap: 10,
              }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15.5, color: NIGHT.ink }}>
                Ready to search: “{preflight.pf.interpreted}”
              </Text>
              {preflight.pf.heardRaw ? (
                <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: NIGHT.ink3 }}>
                  heard “{preflight.pf.heardRaw}” — I cleaned it up
                </Text>
              ) : null}
              {preflight.pf.note ? (
                <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18, color: '#B9C8EE' }}>
                  {preflight.pf.note}
                </Text>
              ) : null}
              {preflight.pf.variants.length ? (
                <View style={{ gap: 7 }}>
                  {preflight.pf.variants.map((o) => (
                    <Pressable
                      key={o}
                      onPress={() => void submitAsk(o)}
                      style={{
                        borderWidth: 1,
                        borderColor: 'rgba(91,123,255,0.5)',
                        backgroundColor: 'rgba(59,130,246,0.18)',
                        borderRadius: 12,
                        paddingVertical: 10,
                        paddingHorizontal: 13,
                      }}>
                      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: NIGHT.ink }}>{o}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 9, marginTop: 2 }}>
                <Pressable
                  onPress={() => setPreflight(null)}
                  style={{ flex: 1, borderWidth: 1, borderColor: NIGHT.line, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: NIGHT.ink2 }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const it = preflight.intent;
                    setPreflight(null);
                    void runDraftAction(it);
                  }}
                  style={{ flex: 1, backgroundColor: NIGHT.accent, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: '#fff' }}>Run it as-is</Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : null}

          {phase === 'idle' && refine ? (
            <Animated.View
              entering={FadeInDown.duration(220)}
              style={{
                width: '96%',
                backgroundColor: 'rgba(255,255,255,0.07)',
                borderColor: NIGHT.line,
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
                gap: 10,
              }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15.5, color: NIGHT.ink }}>
                I heard “{refine.heard}” — did you mean one of these?
              </Text>
              <View style={{ gap: 7 }}>
                {refine.options.map((o) => (
                  <Pressable
                    key={o}
                    onPress={() => void submitAsk(o)}
                    style={{
                      borderWidth: 1,
                      borderColor: 'rgba(91,123,255,0.5)',
                      backgroundColor: 'rgba(59,130,246,0.18)',
                      borderRadius: 12,
                      paddingVertical: 10,
                      paddingHorizontal: 13,
                    }}>
                    <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: NIGHT.ink }}>{o}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: NIGHT.ink3 }}>
                or say it again / type your own below
              </Text>
            </Animated.View>
          ) : null}

          {phase === 'idle' && didYouMean ? (
            <Animated.View
              entering={FadeInDown.duration(220)}
              style={{
                width: '96%',
                backgroundColor: 'rgba(255,255,255,0.07)',
                borderColor: NIGHT.line,
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
                gap: 11,
              }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: NIGHT.ink }}>
                Did you mean {didYouMean.suggestion}?
              </Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: NIGHT.ink2 }}>
                I heard “{didYouMean.intent.company}” — that doesn't look like a company I know.
              </Text>
              <View style={{ flexDirection: 'row', gap: 9 }}>
                <Pressable
                  onPress={() => {
                    const it = { ...didYouMean.intent };
                    setDidYouMean(null);
                    void runDraftAction(it);
                  }}
                  style={{ flex: 1, borderWidth: 1, borderColor: NIGHT.line, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: NIGHT.ink2 }}>
                    Keep “{didYouMean.intent.company}”
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const it = { ...didYouMean.intent, company: didYouMean.suggestion };
                    setDidYouMean(null);
                    void runDraftAction(it);
                  }}
                  style={{ flex: 1, backgroundColor: NIGHT.accent, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: '#fff' }}>
                    Yes — {didYouMean.suggestion}
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : null}

          {phase === 'idle' && reply && !didYouMean ? (
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
                      onPress={() => {
                        setReply(null);
                        router.push(a.href as never);
                      }}
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
              Tap and ask Scout for anything
            </Text>
          ) : null}

          {(phase === 'idle' && cards.length === 0) || phase === 'clarify' ? (
            <View style={{ alignItems: 'center', gap: 12, width: '100%' }}>
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

              {/* Quieter suggestions, under the input — prompts, not the show.
                  The window rotates every 8s while idle (key remount fades). */}
              <Animated.View
                key={sugOffset}
                entering={FadeInDown.duration(350)}
                style={{ display: phase === 'clarify' ? 'none' : 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', paddingHorizontal: 8 }}>
                {[0, 1, 2].map((i) => {
                  const sug = SUGGESTION_POOL[(sugOffset + i) % SUGGESTION_POOL.length];
                  return (
                    <Pressable
                      key={sug}
                      onPress={() => void submitAsk(sug)}
                      style={{
                        borderWidth: 1,
                        borderColor: NIGHT.lineSoft,
                        borderRadius: 999,
                        paddingVertical: 5,
                        paddingHorizontal: 10,
                        backgroundColor: 'rgba(255,255,255,0.03)',
                      }}>
                      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: '#8FA3CC' }}>{sug}</Text>
                    </Pressable>
                  );
                })}
              </Animated.View>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
