import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { mapScoutRoute, sendScoutMessage, type ScoutAction, type ScoutTurn } from '@/api/endpoints/scout';
import {
  ackFor,
  applyScope,
  AUTO_APPLY_CREDITS,
  clarifyFor,
  isRealCompany,
  executeApplyIntent,
  extractSlots,
  type AskSlots,
  executeDraftIntent,
  normalizeAsk,
  matchJobs,
  pickApplyCandidates,
  parseAffirmation,
  parseAgain,
  parseIntent,
  parseNav,
  preflightFor,
  industryFirmsFor,
  industryFirmsInText,
  peerFirmsInText,
  sectorForVibeText,
  referenceFirmInText,
  refineOptions,
  suggestFirm,
  findFirmInText,
  isHighConfidenceParse,
  KNOWN_FIRMS,
  type Preflight,
  type ActionProgress,
  type DraftIntent,
} from '@/api/endpoints/scoutActions';
import { iapAvailable } from '@/api/purchases';
import { presentPaywall } from '@/components/paywall/paywallBus';
import { ApiError } from '@/api/errors';
import { askScoutBrain, askScoutFindContacts, classifyAsk, fetchCompanyJobCounts, fetchVibeCompanies, transcribeAsk, type AskClassification, type ContactPreview } from '@/api/endpoints/scoutAsk';
import { AUTO_APPLY_TERMINAL, fetchAutoApplyStatus, type AutoApplyStatusDoc } from '@/api/endpoints/autoApply';
import { useIsFocused } from '@react-navigation/native';

import { scoutThread, type ScoutThreadEntry } from '@/lib/scoutThread';
import { useAuth } from '@/auth/AuthProvider';
import { pollDraftJob } from '@/api/endpoints/swipe';
import { fetchSectorJobs } from '@/api/endpoints/feed';
import ScoutOrb, { type OrbState } from '@/components/scout/ScoutOrb';
import ChatComposer from '@/components/scout/ChatComposer';
import TapHand from '@/components/tour/TapHand';
import { useTour } from '@/components/tour/TourProvider';
import { isTourPending } from '@/lib/tourFlag';
import ChatHistoryPanel from '@/components/scout/ChatHistoryPanel';
import ChatMessage from '@/components/scout/ChatMessage';
import VoiceMode from '@/components/scout/VoiceMode';
import WhatScoutDoes from '@/components/scout/WhatScoutDoes';
import type { Job } from '@/types';
import { useApp } from '@/store/app';
import { useScoutRoom } from '@/theme/scoutRoom';
import { fonts } from '@/theme/tokens';
import ScoutErrorBoundary from '@/components/scout/ScoutErrorBoundary';
import { requestSpeechPermissions, speechSupported, startListening } from '@/lib/speech';
import { speak, stopSpeaking } from '@/lib/speak';
import { track } from '@/lib/analytics';

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

/** Rotating pool — three show at a time, refreshing while the tab idles so
 *  the door never looks the same twice (all real, runnable asks). */
const SUGGESTION_POOL = [
  'Draft 3 IB analysts at Goldman Sachs',
  'Draft 2 engineers at Stripe',
  'Apply to a few jobs for me',
  'Prep me for my next coffee chat',
  'Find me a PM role to apply to',
  'Analysts at Morgan Stanley in LA',
  'Draft 2 consultants at McKinsey',
  'Engineers at Google',
  'Apply to my saved jobs',
  'Associates at Evercore in New York',
  'Draft someone on the deal team at Lazard',
];

/** No-Gmail accounts get no-setup asks up front (jobs, browsing people,
 *  prep) — drafts still work via compose links, but the magic is dimmer,
 *  so they shouldn't be the front door for a fresh account
 *  (SCOUT-RISK-REGISTER.md #5). */
const NO_GMAIL_POOL = [
  'Find me a PM role to apply to',
  'Show me people at Goldman Sachs',
  'Who works at McKinsey',
  'Find me consulting roles in LA',
  'Show me engineers at Google',
  'Prep me for my next coffee chat',
  'Draft 3 IB analysts at Goldman Sachs',
  'Analysts at Morgan Stanley in LA',
];

/** The question that is already in the box on a brand-new account. Sending it
 *  starts the tour; it never reaches the model. */
const TOUR_OPENER = 'How can you help me?';

// Voice audio-upload founder gate: LIFTED 2026-07-09. The permission copy
// in this build's app.json is honest about server transcription ("short
// clips may also be sent securely to Offerloop's servers"), so every user
// gets the accurate dual-leg path. Old builds with the on-device-only
// promise can never receive this JS: the app.json change moved the runtime
// fingerprint, and OTAs only target their own runtime.


/** Raw pipeline stage keys (filling_form, inspecting_page...) read like a
 *  stack trace on a card. Map the known ones, prettify the rest. */
const STAGE_LABELS: Record<string, string> = {
  queued: 'Queued…',
  running: 'Working…',
  filling_form: 'Filling out the form…',
  inspecting_page: 'Reading the application page…',
  answering_questions: 'Answering screening questions…',
  submitting: 'Submitting…',
  uploading_resume: 'Attaching your resume…',
  awaiting_verification: 'Filled — finishing up…',
};
const humanStage = (raw?: string | null): string => {
  const key = (raw || '').trim();
  if (!key) return 'Working…';
  if (STAGE_LABELS[key]) return STAGE_LABELS[key];
  if (/^[a-z0-9_]+$/.test(key)) {
    const words = key.replace(/_/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1) + '…';
  }
  return key;
};

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const THINK_WORDS = [
  'Thinking', 'Scouting', 'Charting the route', 'Reading the trail',
  'Checking the map', 'Packing the bag', 'Sniffing around',
];

/** Render an LLM classification back into the regex ladder's native
 *  language — canonical asks always parse, so one pipeline serves both
 *  brains and every safety gate applies to classified asks too. */
function canonicalAsk(c: AskClassification): string | null {
  const loc = c.location ? ` in ${c.location}` : '';
  switch (c.intent) {
    case 'draft_outreach': {
      const role = c.hiring_manager && !/hiring|recruit/i.test(c.role)
        ? 'hiring managers'
        : c.role || 'someone on the team';
      const at = c.company ? ` at ${c.company}` : '';
      return `${c.wants_send ? 'Send' : 'Draft'} ${c.count} ${role}${at}${loc}`;
    }
    case 'find_people':
      if (!c.company) return `Draft ${c.count} ${c.role || 'someone on the team'}${loc}`;
      return `Show me ${c.role || 'people'} at ${c.company}${loc}`;
    case 'find_jobs':
      return `find me ${c.job_query || c.role || 'new'} roles${loc}`;
    case 'apply_saved':
      return 'apply to my saved jobs';
    case 'meeting_prep':
      return 'prep me for my meeting';
    default:
      return null; // question → conversation
  }
}

/** Did the user actually SAY this company (normalized substring), or did the
 *  server brain repair it in? Repaired companies always get a confirm card. */
function companyVerbatimIn(company: string, transcript: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const c = norm(company);
  if (!c) return false;
  return ` ${norm(transcript)} `.includes(` ${c} `);
}

/** A "company" that's really transcription debris ("Bay or anywhere that
 *  like man is hiring") — must NEVER spend credits without a look, even in
 *  zero-touch mode (Rylan field test 2026-07-08: 5 credits burned on a
 *  misheard ask). */
function fishyCompany(company: string | null): boolean {
  if (!company) return false;
  return (
    company.trim().split(/\s+/).length > 3 ||
    /\b(or|anywhere|that|like|something|whatever|stuff|thing)\b/i.test(company)
  );
}

type Phase = 'idle' | 'listening' | 'thinking' | 'clarify' | 'receipt';

/** A live action card — the job plumbing wearing Scout's clothes.
 *  progressPct is optional: re-hydrated cards start WITHOUT a number (the
 *  never-invented-progress rule) and gain one when the poller reports it. */
type ActionCard = {
  id: string;
  title: string;
  stageLabel: string;
  progressPct?: number;
};

/* The watercolor ridgeline came off this screen (Rylan 2026-08-17): the room
   is the sky gradient and the orb, nothing else. The art still lives in
   NightSky for the rest of the app's dark mode. */

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
  // Scout follows the app's Light/Dark setting like every other screen.
  const room = useScoutRoom();
  const { showToast, unreadCount, savedJobs, allJobs, profile, loops, swipeSettings, bootPending, loopsReady } = useApp();
  const { user } = useAuth();

  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [ask, setAsk] = useState('');
  const [typed, setTyped] = useState('');
  const [reply, setReply] = useState<{ say: string; actions: ScoutAction[] } | null>(null);
  // Session transcript: every ask and every reply, reviewable behind the
  // header button. The live stage still shows one exchange at a time (the
  // voice-first identity), but nothing Scout says vanishes anymore — long
  // answers and Scout's own questions used to auto-clear after 20s with no
  // way back (parity audit's top UX gap).
  // Thread storage lives in the shared scoutThread module (one conversation
  // across the tab AND the header sheet); this counter just re-renders the
  // header button + transcript overlay when entries land.
  const [threadSize, setThreadSize] = useState(0);
  // Focus re-render: the sheet appends to the shared thread while this tab
  // is backgrounded, so coming back has to redraw the conversation.
  const isFocused = useIsFocused();
  const [historyOpen, setHistoryOpen] = useState(false);
  // Voice takes over the screen while it is open (Rylan 2026-08-17). The chat
  // keeps running underneath: every turn still lands in the thread, so closing
  // voice mode is a change of instrument, not a loss of the conversation.
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  // The permanent version of the first-run intro: the explainer someone can go
  // back to later, from the empty state or the chats drawer.
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [thinkWord, setThinkWord] = useState(THINK_WORDS[0]);
  const [cards, setCards] = useState<ActionCard[]>([]);
  const [clarify, setClarify] = useState<{ question: string; baseAsk: string } | null>(null);
  const [didYouMean, setDidYouMean] = useState<{ intent: DraftIntent; suggestion: string } | null>(null);
  const [refine, setRefine] = useState<{ heard: string; options: string[] } | null>(null);
  const [preflight, setPreflight] = useState<{ pf: Preflight; intent: DraftIntent; gate: string } | null>(null);
  const [sugOffset, setSugOffset] = useState(0);
  const [ctx, setCtx] = useState<{ slots: AskSlots; age: number } | null>(null);
  const [jobPicks, setJobPicks] = useState<{ query: string; jobs: Job[] } | null>(null);
  const [applyOne, setApplyOne] = useState<Job | null>(null);
  // "Apply to a few jobs" scope card: Scout's picks, shown by name before
  // anything irreversible runs. requested keeps the ask honest when fewer
  // are eligible; fromPool marks candidates pulled beyond today's feed.
  const [applySome, setApplySome] = useState<{
    jobs: Job[];
    requested: number;
    fromPool: boolean;
  } | null>(null);
  const [peoplePicks, setPeoplePicks] = useState<{
    items: ContactPreview[];
    role: string;
    company: string;
    location: string | null;
  } | null>(null);
  const [receipt, setReceipt] = useState<{
    eligible: Job[];
    tiers: { id: string; label: string; count: number; creditEstimate: number }[];
    chosen: number;
  } | null>(null);
  // Conversation id + history live in scoutThread (shared with the sheet):
  // echo chat_id back every turn or the backend starts a fresh chat each
  // time — server memory, clarify resolution, and titling all hang off it.
  const requestSeq = useRef(0);
  const askByVoice = useRef(false);
  const lastDraftRef = useRef<DraftIntent | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const volume = useSharedValue(0);

  // The conversation IS the screen now (Rylan 2026-08-17). scoutThread is
  // module state on purpose (the tab and the header sheet share one thread),
  // so threadSize is what tells React a turn landed. isFocused is in the deps
  // because the sheet can append while this tab is backgrounded.
  const messages: ScoutThreadEntry[] = useMemo(
    () => scoutThread.entries(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [threadSize, isFocused],
  );
  const hasThread = messages.length > 0;

  // Keep the newest turn in view, the way every chat app does.
  useEffect(() => {
    if (!hasThread) return;
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 70);
    return () => clearTimeout(t);
  }, [threadSize, phase, hasThread]);

  /** Clear the stage and start a fresh conversation. Live action cards are
   *  deliberately left alone: a running apply is real work, not chat. */
  const newChat = useCallback(() => {
    stopSpeaking();
    scoutThread.reset();
    setThreadSize(0);
    setReply(null);
    setClarify(null);
    setPreflight(null);
    setDidYouMean(null);
    setRefine(null);
    setJobPicks(null);
    setApplyOne(null);
    setApplySome(null);
    setPeoplePicks(null);
    setReceipt(null);
    setCtx(null);
    setTyped('');
    setTranscript('');
    setPhase('idle');
    setHistoryOpen(false);
    track('scout_new_chat', {});
  }, []);

  // The landing-screen bet needs first-tap data, not anecdotes
  // (SCOUT-RISK-REGISTER.md #1): what does a user touch first on this tab?
  const firstActionRef = useRef(false);
  const firstAction = useCallback((action: string) => {
    if (firstActionRef.current) return;
    firstActionRef.current = true;
    track('scout_first_action', { action });
  }, []);

  // Deliberately NOT probed at mount: the very first touch of the native
  // speech module happens on the user's tap, so screen-open can never crash
  // from it (post-crash hardening, 2026-07-08).
  const voiceReady = () => speechSupported();

  /**
   * First run. The old three-example overlay is gone (Rylan 2026-08-17: it
   * asked people to pick one of three things before they knew what any of them
   * meant). What replaces it: the question is already typed, a hand motions at
   * the send button, and sending starts the guided tour.
   *
   * Armed only by completeOnboarding(), so an established user updating the
   * app never gets it, and only on a genuinely empty thread.
   */
  const tour = useTour();
  const [tourArmed, setTourArmed] = useState(false);
  useEffect(() => {
    let alive = true;
    isTourPending()
      .then((pending) => {
        if (!alive || !pending) return;
        tourLaunched.current = false;
        setTourArmed(true);
        setTyped(TOUR_OPENER);
        track('tour_offered', {});
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  // Sending the prefilled question is the tour's start button. It deliberately
  // does NOT reach the model: this is the first thing a new user ever sends,
  // and it should be instant, free, and the same for everyone. Scout's answer
  // is the tour's first card.
  // One-shot. Two taps on the send button in the same frame both see
  // tourArmed as true; without this the opener lands in the thread twice and
  // the tour starts on top of itself.
  const tourLaunched = useRef(false);
  const startTourFromScout = useCallback(() => {
    if (tourLaunched.current) return;
    tourLaunched.current = true;
    setTourArmed(false);
    setTyped('');
    scoutThread.append({ from: 'user', text: TOUR_OPENER });
    setThreadSize(scoutThread.size());
    tour.start();
  }, [tour]);

  // Chips lean toward no-setup asks until Gmail is connected (risk #5).
  const suggestionPool = profile?.gmailConnected ? SUGGESTION_POOL : NO_GMAIL_POOL;

  // Companies this user actually targets (named in their loops) — feeds both
  // the ASR vocabulary and the voice-confidence check.
  const loopCompanies = useMemo(
    () =>
      loops
        .map((l) => extractSlots(l.brief).company)
        .filter((c): c is string => !!c),
    [loops],
  );

  // ASR vocabulary (SCOUT-RISK-REGISTER.md #6): Apple's on-device model
  // favors these exact phrases, so "Moelis" survives a loud room. The base
  // firm list plus this user's own targets — roles, locations, and any
  // company named in their loops.
  const speechVocab = useMemo(() => {
    return [
      ...new Set([
        ...KNOWN_FIRMS,
        ...loopCompanies,
        ...(profile?.targetRoles ?? []),
        ...(profile?.preferredLocations ?? []),
      ]),
    ];
  }, [loopCompanies, profile?.targetRoles, profile?.preferredLocations]);

  // The reply card stays until the next ask replaces it (every ask path
  // clears it on entry) — the old 20s auto-clear erased long answers and
  // Scout's own questions mid-read. Every reply also lands in the session
  // transcript so it stays reviewable after the stage moves on.
  useEffect(() => {
    if (!reply) return;
    ageContext();
    // Spoken asks get spoken replies (the full assistant loop); typed asks
    // stay silent — gyms and lectures are why the type bar exists. The
    // handlers are what let the circle pulse while Scout is actually talking.
    if (askByVoice.current) {
      speak(reply.say, {
        onStart: () => setSpeaking(true),
        onDone: () => setSpeaking(false),
      });
    }
    if (reply.say) {
      scoutThread.append({ from: 'scout', text: reply.say });
      setThreadSize(scoutThread.size());
    }
  }, [reply]);

  // Leaving the tab silences Scout mid-sentence.
  useEffect(() => () => stopSpeaking(), []);

  // Rotate the suggestion chips while the tab idles.
  useEffect(() => {
    if (phase !== 'idle') return;
    const t = setInterval(() => setSugOffset((o) => (o + 3) % suggestionPool.length), 8000);
    return () => clearInterval(t);
  }, [phase, suggestionPool.length]);

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

  // Thinking watchdog: no request is allowed to pin the orb forever (field
  // walk 2026-07-08 — backgrounded mid-search, spinner never recovered).
  // Timers suspend in the background too, so this fires on return at worst.
  useEffect(() => {
    if (phase !== 'thinking') return;
    const t = setTimeout(() => {
      requestSeq.current += 1; // orphan whatever is still in flight
      setPhase('idle');
      setReply({ say: "That one took too long — nothing was charged. Ask me again.", actions: [] });
      track('scout_thinking_timeout', {});
    }, 40_000);
    return () => clearTimeout(t);
  }, [phase]);

  /** Merge an utterance's slots into the rolling conversation memory. */
  const remember = useCallback((ask: string) => {
    const slots = extractSlots(ask);
    if (!Object.keys(slots).length) return;
    setCtx((prev) => ({ slots: { ...(prev?.age ?? 9) <= 3 ? prev?.slots : {}, ...slots }, age: 0 }));
  }, []);
  const ageContext = useCallback(() => {
    setCtx((prev) => {
      if (!prev) return prev;
      const age = prev.age + 1;
      return age > 3 ? null : { ...prev, age };
    });
  }, []);

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
      // Backstop: never launch a draft with no real company (empty, or a generic
      // placeholder like "companies"/"startups"). Every path lands here — chips,
      // refine picks, context inference — so one guard stops the doomed "drafting
      // 3 people at companies → didn't finish". Ask which company instead.
      if (!isRealCompany(intent.company)) {
        setClarify({
          question: "Which company should I look at? Name one — or a couple like it — and I'll pull people there.",
          baseAsk: intent.role || '',
        });
        setPhase('clarify');
        return;
      }
      lastDraftRef.current = intent;
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
        track('scout_action_completed', {
          action: 'draft',
          ok: true,
          count: res.names.length,
          requested: res.requested,
          short: Math.max(0, res.requested - res.names.length),
        });
        setReply({
          say: res.say,
          actions: res.names.length ? [{ label: 'Open Inbox', href: '/(tabs)/inbox' }] : [],
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e: unknown) {
        dropCard(id);
        // Backend industry guard (INDUSTRY_NOT_COMPANY): the server refused
        // to search an industry as an employer. Recover with the firm
        // picker instead of a generic failure - same card the client-side
        // guard shows, so the two layers feel like one behavior.
        const bodyCode = e instanceof ApiError ? ((e.body as { code?: string } | null)?.code ?? '') : '';
        if (bodyCode === 'INDUSTRY_NOT_COMPANY') {
          const firms = industryFirmsFor(intent.company)
            ?? industryFirmsInText(intent.company || '')
            ?? ['Goldman Sachs', 'JPMorgan', 'McKinsey', 'Google'];
          const loc = intent.location ? ` in ${intent.location}` : '';
          const role = intent.hm ? 'hiring managers' : (intent.role || 'people on the team');
          track('scout_gate', { gate: 'industry_not_company', from: 'server' });
          setRefine({
            heard: `${intent.role || 'people'} at ${intent.company}`,
            options: firms.slice(0, 4).map((f) =>
              intent.count > 1 ? `Draft ${intent.count} ${role} at ${f}${loc}` : `${role} at ${f}${loc}`),
          });
          setPhase('idle');
          return;
        }
        const msg = e instanceof Error ? e.message : '';
        const noCredits = /credit/i.test(msg);
        track('scout_action_completed', { action: 'draft', ok: false, no_credits: noCredits });
        setReply(
          noCredits
            ? {
                say: "You're out of credits for this one — nothing was charged. They refresh each month, and I'll pick this right back up then.",
                actions: iapAvailable()
                  ? [
                      { label: 'Get more credits', href: '#paywall' },
                      { label: 'View credits', href: '/credits' },
                    ]
                  : [{ label: 'View credits', href: '/credits' }],
              }
            : {
                say: "That one didn't finish — nothing was charged for anyone I couldn't draft. Ask me again.",
                actions: [],
              },
        );
      }
    },
    [upsertCard, dropCard],
  );

  const runApplyAction = useCallback(
    async (jobs: Job[]) => {
      const id = `apply-${Date.now()}`;
      // Serves saved jobs, single applies, and Scout's own picks now, so the
      // title stays neutral (the picks were never "saved").
      const title = `Applying to ${jobs.length} job${jobs.length === 1 ? '' : 's'}`;
      setReceipt(null);
      setPhase('idle');
      setReply({ say: `On it — submitting ${jobs.length} application${jobs.length === 1 ? '' : 's'}.`, actions: [] });
      upsertCard({ id, title, stageLabel: 'Starting…', progressPct: 4 });
      try {
        const res = await executeApplyIntent(jobs, (p: ActionProgress) => {
          upsertCard({ id, title, stageLabel: p.stageLabel, progressPct: p.progressPct });
        });
        dropCard(id);
        track('scout_action_completed', { action: 'apply', ok: true, count: jobs.length });
        setReply({
          say: res.say,
          actions: res.needsProfile
            ? [
                { label: 'Finish application profile', href: '/application-profile' },
                { label: 'Open Applications', href: '/(tabs)/network' },
              ]
            : [{ label: 'Open Applications', href: '/(tabs)/network' }],
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        dropCard(id);
        track('scout_action_completed', { action: 'apply', ok: false });
        setReply({ say: 'Those applications hit a snag — check Applications for details.', actions: [] });
      }
    },
    [upsertCard, dropCard],
  );

  /**
   * Follow one live auto-apply to a terminal state: a card while it runs, a
   * reply when it lands. Shared by the re-hydration sweep (work that survived
   * an app kill) and by a Scout chat turn that just queued one, so a
   * submission looks identical however it started.
   *
   * isAlive lets a caller inside an effect stop the loop on teardown.
   */
  const trackAutoApply = useCallback(
    async (
      autoApplyId: string,
      title: string,
      opts?: { isAlive?: () => boolean; initialStage?: string },
    ) => {
      const alive = opts?.isAlive ?? (() => true);
      const cardId = `aa-${autoApplyId}`;
      const cardTitle = title || 'Submitting application';
      upsertCard({ id: cardId, title: cardTitle, stageLabel: humanStage(opts?.initialStage) });
      for (let i = 0; i < 45 && alive(); i += 1) {
        await new Promise((res) => setTimeout(res, 4000));
        if (!alive()) return;
        let doc: AutoApplyStatusDoc;
        try {
          doc = await fetchAutoApplyStatus(autoApplyId);
        } catch {
          continue; // transient — keep the card, try again
        }
        if (!alive()) return;
        if (AUTO_APPLY_TERMINAL.includes(doc.status)) {
          dropCard(cardId);
          const who = doc.job_title
            ? `${doc.job_title}${doc.company ? ` at ${doc.company}` : ''}`
            : cardTitle;
          setReply(
            doc.status === 'submitted'
              ? { say: `Submitted — ${who} is in.`, actions: [{ label: 'See your Applications', href: '/(tabs)/network' }] }
              : doc.status === 'needs_attention' || doc.status === 'needs_verification'
                ? { say: `${who} needs you — a question or a verification code is waiting.`, actions: [{ label: 'Finish it', href: `/apply-questions/${autoApplyId}` }] }
                : { say: `${who} didn't go through — check Applications for what happened.`, actions: [{ label: 'See your Applications', href: '/(tabs)/network' }] },
          );
          return;
        }
        upsertCard({ id: cardId, title: cardTitle, stageLabel: humanStage(doc.stage) });
      }
      // Poll budget spent (~3 min) — server zombie-filters at 8; let it go quietly.
      if (alive()) dropCard(cardId);
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
          if (!alive) break;
          const id = item.jobRef.id;
          if (item.jobRef.kind === 'draft_job') {
            // No invented progress: the card starts numberless and gains a
            // real percentage on the first poll.
            upsertCard({ id, title: item.title, stageLabel: item.stageLabel || 'Working…' });
            pollDraftJob(id, (p) => {
              if (!alive) return;
              upsertCard({ id, title: item.title, stageLabel: p.stageLabel || 'Working…', progressPct: p.progressPct });
            })
              .then(() => {
                if (!alive) return;
                dropCard(id);
                setReply({ say: 'Done — that draft is in your Inbox.', actions: [{ label: 'Open Inbox', href: '/(tabs)/inbox' }] });
              })
              .catch(() => alive && dropCard(id));
          } else if (item.jobRef.kind === 'auto_apply') {
            // Previously skipped with a bare `continue` — a submitting
            // application survived the app kill invisibly.
            void trackAutoApply(id, item.title, {
              isAlive: () => alive,
              initialStage: item.stageLabel,
            });
          } else if (item.jobRef.kind === 'meeting_prep') {
            // A prep started from Scout chat survived the app kill. Preps
            // build in ~60s; poll the same doc the Meeting Prep screen
            // reads, no invented progress.
            const cardId = `prep-${id}`;
            upsertCard({ id: cardId, title: item.title || 'Building your meeting prep', stageLabel: humanStage(item.stageLabel) });
            void (async () => {
              for (let i = 0; i < 36 && alive; i += 1) {
                await new Promise((res) => setTimeout(res, 5000));
                if (!alive) return;
                let doc: { status?: string; stageLabel?: string; progressPct?: number };
                try {
                  doc = await apiFetch(`/api/coffee-chat-prep/${encodeURIComponent(id)}`, { timeoutMs: 15_000 });
                } catch {
                  continue; // transient — keep the card, try again
                }
                if (!alive) return;
                const st = (doc.status || '').toLowerCase();
                if (st && st !== 'processing') {
                  dropCard(cardId);
                  setReply(
                    st === 'completed' || st === 'complete'
                      ? { say: 'Your meeting prep is ready.', actions: [{ label: 'Open the prep', href: `/meeting-prep/${id}` }] }
                      : { say: "That meeting prep didn't finish — nothing extra was charged. Ask me to run it again.", actions: [] },
                  );
                  return;
                }
                upsertCard({
                  id: cardId,
                  title: item.title || 'Building your meeting prep',
                  stageLabel: humanStage(doc.stageLabel),
                  progressPct: typeof doc.progressPct === 'number' ? doc.progressPct : undefined,
                });
              }
              if (alive) dropCard(cardId);
            })();
          }
        }
      } catch {
        /* re-hydration is best-effort */
      }
    })();
    return () => {
      alive = false;
    };
  }, [upsertCard, dropCard, trackAutoApply]);

  const submitAsk = useCallback(
    async (
      text: string,
      meta?: {
        viaClassifier?: boolean;
        heardRaw?: string;
        byVoice?: boolean;
        source?: string;
        /** Server understanding failed — run today's pure-local ladder. */
        localOnly?: boolean;
        /** Server repaired the company to this name — always confirm-card. */
        serverCorrected?: string | null;
        /** Recorded ask audio (founder-gated) — audioend races end, so a
         *  getter + settled flag instead of a plain value. */
        getAudio?: () => { uri: string | null; settled: boolean };
      },
    ) => {
      const norm = normalizeAsk(text.trim());
      let clean = norm.text;
      if (!clean) return;
      askByVoice.current = !!meta?.byVoice;
      // Transcript: record what the user actually asked. Classifier
      // re-entries re-speak the SAME ask in canonical form — the human's
      // words are already on the thread, so skip the echo.
      if (!meta?.viaClassifier) {
        scoutThread.append({ from: 'user', text: clean });
        setThreadSize(scoutThread.size());
      }

      // Spoken confirmation/dismissal drives whatever card is waiting.
      const aff = parseAffirmation(clean);
      const pending = preflight || didYouMean || applyOne || receipt || applySome;
      if (aff && pending) {
        stopSpeaking();
        track('scout_gate_outcome', {
          gate: preflight
            ? preflight.gate
            : didYouMean
              ? 'did_you_mean'
              : applyOne
                ? 'apply_one'
                : receipt
                  ? 'receipt'
                  : 'apply_some',
          outcome: aff === 'yes' ? 'run' : 'cancel',
          method: 'voice',
        });
        if (aff === 'yes') {
          if (preflight) {
            const it = preflight.intent;
            setPreflight(null);
            void runDraftAction(it);
          } else if (didYouMean) {
            const it = { ...didYouMean.intent, company: didYouMean.suggestion };
            setDidYouMean(null);
            void runDraftAction(it);
          } else if (applyOne) {
            const j = applyOne;
            setApplyOne(null);
            setJobPicks(null);
            void runApplyAction([j]);
          } else if (receipt) {
            const jobs = receipt.eligible.slice(0, receipt.chosen);
            setReceipt(null);
            setPhase('idle');
            void runApplyAction(jobs);
          } else if (applySome) {
            const picks = applySome.jobs;
            setApplySome(null);
            void runApplyAction(picks);
          }
        } else {
          setPreflight(null);
          setDidYouMean(null);
          setApplyOne(null);
          setReceipt(null);
          setApplySome(null);
          setPhase('idle');
          setReply({ say: 'Cancelled — nothing ran.', actions: [] });
        }
        return;
      }
      if (aff === 'no') {
        // "Stop / never mind" with nothing pending: stand down cleanly.
        stopSpeaking();
        setPhase('idle');
        setReply({ say: 'Standing down — nothing ran.', actions: [] });
        return;
      }

      // "Again / one more" re-runs the last draft — through the confirm card
      // so the repeat (and its cost) is visible before it spends.
      if (parseAgain(clean) && lastDraftRef.current) {
        const it = lastDraftRef.current;
        stopSpeaking();
        setReply(null);
        track('scout_gate', { gate: 'repeat' });
        setPreflight({
          pf: {
            interpreted: `${it.wantedSend ? 'Send' : 'Draft'} ${it.count} ${it.role}${it.company ? ` at ${it.company}` : ''}${it.location ? ` in ${it.location}` : ''} · ${it.count * 5} credits`,
            heardRaw: null,
            variants: [],
            note: 'Running the same ask again.',
          },
          intent: it,
          gate: 'repeat',
        });
        setPhase('idle');
        return;
      }

      // In-app navigation by voice: just go.
      const nav = parseNav(clean);
      if (nav) {
        stopSpeaking();
        track('scout_ask', { intent: 'nav', by_voice: !!meta?.byVoice });
        setPhase('idle');
        setReply({ say: `Opening ${nav.label}.`, actions: [] });
        router.push(nav.href as never);
        return;
      }

      stopSpeaking();
      setRefine(null);
      setPreflight(null);
      setJobPicks(null);
      setApplyOne(null);
      setApplySome(null);
      setPeoplePicks(null);

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
          track('scout_gate_outcome', { gate: 'clarify', outcome: 'answered', method: meta?.byVoice ? 'voice' : 'tap' });
          setAsk(clean);
          // A clarify ANSWER is one more ASR roll of the dice — it must NOT
          // bypass the ladder (field walk 2026-07-08: "Evercore" answered,
          // "Core" ran and spent). Near-miss rescue first, then one confirm.
          const mergedSug = merged.company ? suggestFirm(merged.company) : null;
          if (mergedSug) {
            setReply(null);
            track('scout_gate', { gate: 'did_you_mean' });
            setDidYouMean({ intent: merged, suggestion: mergedSug });
            setPhase('idle');
            return;
          }
          setReply(null);
          track('scout_gate', { gate: 'clarify_confirm' });
          setPreflight({
            pf: {
              interpreted: `${merged.wantedSend ? 'Send' : 'Draft'} ${merged.count} ${merged.role}${merged.company ? ` at ${merged.company}` : ''}${merged.location ? ` in ${merged.location}` : ''} · ${merged.count * 5} credits`,
              heardRaw: null,
              variants: [],
              note: null,
            },
            intent: merged,
            gate: 'clarify_confirm',
          });
          setPhase('idle');
          return;
        }
      }

      const intent = parseIntent(clean);
      // Slot inheritance (the JPMorgan bug, 2026-07-09): a refine or
      // did-you-mean tap re-parses a SHORT variant ("Analysts at JPMorgan")
      // while fresh context still holds what the user actually asked for
      // ("draft five … in Los Angeles"). The ctx pill showed 5 · Los Angeles
      // as the job quietly ran 1 · anywhere. Inherit missing count/location
      // from fresh context — every confirm card downstream renders the
      // inherited values, so nothing spends invisibly. Count only inherits
      // when THIS ask names no number (an explicit "draft one analyst"
      // always wins).
      if (intent?.kind === 'draft' && ctx && ctx.age <= 3) {
        const namesCount = /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(clean);
        if (!namesCount && intent.count <= 1 && (ctx.slots.count ?? 0) > 1) {
          intent.count = Math.min(ctx.slots.count as number, 5);
        }
        if (!intent.location && ctx.slots.location) {
          intent.location = ctx.slots.location;
        }
      }
      // Industry-as-company guard (2026-07-09): "hiring managers in
      // investment banking" must never search PDL with the INDUSTRY in the
      // company slot — the only matches are profiles whose employer field
      // literally says "investment banking" (shells, stale accounts, dead
      // links; five junk drafts shipped tonight). Offer real firms in that
      // industry instead — complete asks carrying the count, role, and
      // location the user already gave. Catches classifier re-entries too.
      if (intent?.kind === 'draft' || intent?.kind === 'find_people') {
        // Fires two ways: the industry landed in the company slot, OR the
        // ask named no firm at all but talks about an industry ("find me
        // five employees in the tech industry in LA" — the classifier now
        // correctly leaves company empty for those).
        // Scan the ORIGINAL transcript, not the canonicalized ask — the
        // classifier path rewrites "engineers at startups like Stripe" into
        // "Draft 3 engineers", dropping the vibe. heardRaw carries the real words.
        const vibeText = meta?.heardRaw ?? clean;
        let firms = industryFirmsFor(intent.company)
          ?? (!intent.company ? industryFirmsInText(vibeText) : null)
          // "companies like Stripe" / "startups similar to OpenAI" — no firm
          // named, but a REFERENCE firm is. Suggest its peers so the vibe becomes
          // pickable instead of a dead "which company?".
          ?? (!isRealCompany(intent.company) ? peerFirmsInText(vibeText) : null);
        // One seq for both awaits below (pool-fill + count grounding).
        const seqG = ++requestSeq.current;
        // Piece 3 — pool-fill: when curated is thin/empty for this vibe, pull LIVE
        // companies from the matching sector (or a reference firm's sector) so
        // vibes we didn't hand-curate (biotech, edtech, media, defense…) still get
        // real suggestions that auto-grow with the crawl. Curated stays FIRST:
        // ranking a sector by raw job volume surfaces foreign mass-hirers, so the
        // hand-picked names lead and the pool only fills the remaining slots.
        if ((!firms || firms.length < 4) && !isRealCompany(intent.company)) {
          const sector = sectorForVibeText(vibeText);
          const ref = referenceFirmInText(vibeText);
          if (sector || ref) {
            try {
              const pool = await fetchVibeCompanies({ sector: sector || undefined, like: ref || undefined });
              if (seqG !== requestSeq.current) return;
              if (pool.length) {
                const base = firms ?? [];
                const seen = new Set(base.map((f) => f.toLowerCase()));
                firms = [...base, ...pool.filter((p) => !seen.has(p.toLowerCase()))];
              }
            } catch {
              if (seqG !== requestSeq.current) return;
            }
          }
        }
        if (firms && firms.length) {
          const n = intent.kind === 'draft' ? intent.count : 0;
          // Targeting doctrine: employees are the default. Only an explicit
          // hiring-manager ask keeps that targeting; generic words
          // ("employees", "people") and industry-words-as-role become the
          // pipeline's employee-shaped phrasing.
          const rawRole = (intent.role || '').trim();
          const roleIsGeneric =
            !rawRole || /^(employees?|people|someone|anyone|workers?)$/i.test(rawRole) ||
            !!industryFirmsFor(rawRole);
          const role = (intent.kind === 'draft' && intent.hm)
            ? 'hiring managers'
            : roleIsGeneric ? 'people on the team' : rawRole;
          const loc = intent.location ? ` in ${intent.location}` : '';
          // Piece 2 — ground in real inventory: RANK firms by open-role count so
          // the ones we can back surface first. Rank (not hard-drop): the pool is
          // ATS-crawled and tech-heavy, so finance/consulting firms legitimately
          // have 0 inventory — dropping would empty those vibes. Zeros sort last
          // and fall off the 4-slot cut. Best-effort + seq-guarded.
          let ordered = firms.slice(0, 6);
          try {
            const counts = await fetchCompanyJobCounts(ordered);
            if (seqG !== requestSeq.current) return; // superseded by a newer ask
            ordered = [...ordered].sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0));
          } catch {
            if (seqG !== requestSeq.current) return;
          }
          ordered = ordered.slice(0, 4);
          setReply(null);
          track('scout_gate', { gate: 'industry_not_company' });
          setRefine({
            heard: clean,
            options: ordered.map((f) =>
              n > 1 ? `Draft ${n} ${role} at ${f}${loc}` : `${role} at ${f}${loc}`),
          });
          setPhase('idle');
          return;
        }
      }
      setAsk(clean);

      remember(clean);

      // Ask count/day + mishear-rate inputs (SCOUT-RISK-REGISTER.md #1).
      // Classifier re-entries get their own event so scout_ask stays
      // one-per-utterance.
      if (meta?.viaClassifier) {
        track('scout_ask_classified', { intent: intent?.kind ?? 'unparsed' });
      } else {
        track('scout_ask', {
          intent: intent?.kind ?? 'unparsed',
          by_voice: !!meta?.byVoice,
          source: meta?.source ?? (meta?.byVoice ? 'voice' : 'typed'),
          corrected: !!norm.corrected,
        });
      }

      // LLM-first understanding (voice overhaul P1): a mishear that PARSES
      // cleanly ("Molly's" is a valid-looking company) used to sail past the
      // brain entirely — the root cause of the 2026-07-08 field failures.
      // Voice asks now consult the server classifier unless the parse names
      // an exact known firm; the canonical result re-enters this ladder so
      // every gate still applies. Typed asks stay regex-first (no mishears).
      // Conversational follow-ups ("associates in Los Angeles" while the
      // Moelis card is up) stay INSTANT: when the only missing piece is the
      // company and the rolling context can supply it, skip the server —
      // the context-inferred confirm card guards the inference anyway.
      const ctxCanFillCompany =
        intent?.kind === 'draft' &&
        !intent.company &&
        !!ctx &&
        ctx.age <= 3 &&
        !!ctx.slots.company;
      if (
        meta?.byVoice &&
        !meta?.viaClassifier &&
        !meta?.localOnly &&
        !ctxCanFillCompany &&
        !isHighConfidenceParse(intent, loopCompanies)
      ) {
        const seqU = ++requestSeq.current;
        setReply(null);
        setPhase('thinking');
        const t0 = Date.now();

        // Leg B needs the recording; the native audioend event races 'end',
        // so give the file URI up to 400ms to settle before deciding.
        let audioUri: string | null = null;
        if (meta.getAudio) {
          for (let w = 0; w < 8 && !meta.getAudio().settled; w++) await wait(50);
          audioUri = meta.getAudio().uri;
        }
        if (seqU !== requestSeq.current) return;

        // One resolution wins; every path re-enters submitAsk so the whole
        // gate ladder (incl. the spend gate) applies to the canonical ask.
        let done = false;
        const finish = (
          cls: AskClassification | null,
          transcript: string,
          leg: 'audio' | 'apple',
        ): boolean => {
          if (done || seqU !== requestSeq.current) return done;
          const canonical = cls && !cls.error ? canonicalAsk(cls) : null;
          if (!canonical) return false;
          done = true;
          // Verbatim is judged against the transcript THIS classification was
          // computed from — checking leg B's company against Apple's garble
          // would flag every successful server fix on the wrong string.
          const corrected =
            !!cls!.company && (cls!.repaired || !companyVerbatimIn(cls!.company, transcript));
          track('scout_understand', { leg, ms: Date.now() - t0, corrected });
          void submitAsk(canonical, {
            viaClassifier: true,
            heardRaw: clean,
            byVoice: true,
            serverCorrected: corrected ? cls!.company : null,
          });
          return true;
        };

        // Fire both legs concurrently. B (audio) subsumes A (it classifies
        // the better transcript, and the server internally falls back to the
        // Apple transcript) — so B-preferred, A is the latency hedge.
        const legA = classifyAsk(clean, `cls-${Date.now()}`).catch(() => null);
        const legB: Promise<Awaited<ReturnType<typeof transcribeAsk>> | null> = audioUri
          ? transcribeAsk({
              audioUri,
              appleTranscript: clean,
              askId: `ta-${Date.now()}`,
              hintCompanies: loopCompanies,
            }).catch(() => null)
          : Promise.resolve(null);

        let heldA: AskClassification | null = null;
        void legB.then((b) => {
          if (b) finish(b.classification, b.transcript, b.transcript_source);
        });
        void legA.then((a) => {
          if (!a || a.error) return;
          // Act on A immediately only when Apple clearly heard a real firm
          // (verbatim + unrepaired) — audio adds nothing there. Otherwise
          // hold A for the deadline; B's transcript is authoritative.
          if (a.company && !a.repaired && companyVerbatimIn(a.company, clean)) {
            finish(a, clean, 'apple');
            return;
          }
          heldA = a;
        });

        // Policy deadline: prefer B up to 12s, then act on A, then B's tail
        // (12-15s), then the pure-local ladder. Never a dead end.
        await Promise.race([legB, wait(12_000)]);
        if (!done) {
          const a = heldA ?? (await legA);
          if (a) finish(a, clean, 'apple');
        }
        if (!done) {
          const b = await legB;
          if (b) finish(b.classification, b.transcript, b.transcript_source);
        }
        if (!done && seqU === requestSeq.current) {
          track('scout_understand', { leg: 'local', ms: Date.now() - t0, corrected: false });
          void submitAsk(clean, { ...meta, localOnly: true });
        }
        return;
      }

      if (intent?.kind === 'draft') {
        // Trust rule: a server-repaired company is never run silently — one
        // look first, whatever the spend-gate setting says.
        if (meta?.serverCorrected && intent.company) {
          setReply(null);
          track('scout_gate', { gate: 'server_correction' });
          setPreflight({
            pf: {
              interpreted: `${intent.wantedSend ? 'Send' : 'Draft'} ${intent.count} ${intent.role} at ${intent.company}${intent.location ? ` in ${intent.location}` : ''} · ${intent.count * 5} credits`,
              heardRaw: meta.heardRaw ?? null,
              variants: [],
              note: `I heard ${meta.serverCorrected} in there — run it, or cancel and say it again.`,
            },
            intent,
            gate: 'server_correction',
          });
          setPhase('idle');
          return;
        }
        // Rolling conversation: a missing company fills from recent turns
        // ("find me people at Bain" … "find two hiring managers" keeps Bain)
        // — confirmed on the pre-flight card so the inference is visible.
        if (!intent.company && ctx && ctx.age <= 3 && ctx.slots.company) {
          const inferred = { ...intent, company: ctx.slots.company, location: intent.location ?? ctx.slots.location ?? null };
          setReply(null);
          track('scout_gate', { gate: 'context_inferred' });
          setPreflight({
            pf: {
              interpreted: `${inferred.wantedSend ? 'Send' : 'Draft'} ${inferred.count} ${inferred.role}${inferred.company ? ` at ${inferred.company}` : ''}${inferred.location ? ` in ${inferred.location}` : ''} · ${inferred.count * 5} credits`,
              heardRaw: null,
              variants: [],
              note: `Using ${ctx.slots.company} from earlier in this conversation — cancel if that's not what you meant.`,
            },
            intent: inferred,
            gate: 'context_inferred',
          });
          setPhase('idle');
          return;
        }
        const c = clarifyFor(intent);
        if (c) {
          // Known-firm anchor: ASR keeps famous firm names intact while
          // garbling the connectors, so the parse misses the company the
          // user clearly said ("...analyst set Evercore"). If a firm we
          // know is in the transcript, confirm it instead of asking.
          const anchored = findFirmInText(clean);
          if (anchored) {
            const inferred = { ...intent, company: anchored };
            setReply(null);
            track('scout_gate', { gate: 'firm_anchor' });
            setPreflight({
              pf: {
                interpreted: `${inferred.wantedSend ? 'Send' : 'Draft'} ${inferred.count} ${inferred.role} at ${anchored}${inferred.location ? ` in ${inferred.location}` : ''} · ${inferred.count * 5} credits`,
                heardRaw: clean,
                variants: [],
                note: `I heard ${anchored} in there — run it, or cancel and say it again.`,
              },
              intent: inferred,
              gate: 'firm_anchor',
            });
            setPhase('idle');
            return;
          }
          setReply(null);
          track('scout_gate', { gate: 'clarify' });
          setClarify({ question: c.question, baseAsk: clean });
          setPhase('clarify');
          return;
        }
        // Did-you-mean rescue: a near-miss of a known firm (ASR damage the
        // fix-map didn't cover) gets one confirm BEFORE spending the run.
        const suggestion = intent.company ? suggestFirm(intent.company) : null;
        if (suggestion) {
          setReply(null);
          track('scout_gate', { gate: 'did_you_mean' });
          setDidYouMean({ intent, suggestion });
          setPhase('idle');
          return;
        }
        // Pre-flight coach: corrected transcripts and senior-role asks pause
        // for one look + reply-friendly variants before credits are spent.
        const pf = preflightFor(intent, clean, meta?.heardRaw ?? (norm.corrected ? text.trim() : null), profile?.preferredLocations ?? []);
        if (pf) {
          setReply(null);
          track('scout_gate', { gate: 'preflight_coach' });
          setPreflight({ pf, intent, gate: 'preflight_coach' });
          setPhase('idle');
          return;
        }
        // Spend gate: voice asks confirm before credits go (default ON,
        // Settings → zero-touch to disable); transcription-debris companies
        // ALWAYS confirm, whatever the setting. Typed asks were deliberate —
        // they run instantly.
        const fishy = fishyCompany(intent.company);
        if (fishy || (meta?.byVoice && swipeSettings.scoutConfirmSpend)) {
          setReply(null);
          // The spend gate's cancel rate IS the mishear metric — the number
          // the risk register says we're currently blind to.
          track('scout_gate', { gate: fishy ? 'fishy_company' : 'spend' });
          setPreflight({
            pf: {
              interpreted: `${intent.wantedSend ? 'Send' : 'Draft'} ${intent.count} ${intent.role}${intent.company ? ` at ${intent.company}` : ''}${intent.location ? ` in ${intent.location}` : ''} · ${intent.count * 5} credits`,
              heardRaw: null,
              variants: [],
              note: fishy
                ? `“${intent.company}” doesn't look like a company — I may have misheard. Cancel and say it again, or run it anyway.`
                : null,
            },
            intent,
            gate: fishy ? 'fishy_company' : 'spend',
          });
          setPhase('idle');
          return;
        }
        void runDraftAction(intent);
        return;
      }

      if (intent?.kind === 'find_people') {
        if (fishyCompany(intent.company)) {
          // Transcription debris burns a real PDL lookup even when it's free
          // to the user — refine instead of searching noise.
          setReply(null);
          track('scout_gate', { gate: 'refine' });
          setRefine({
            heard: clean,
            options: refineOptions(clean, profile?.preferredLocations ?? []) ?? [],
          });
          setPhase('idle');
          return;
        }
        // Trust rule (browse): a server-repaired company gets one tappable
        // look before we spend a PDL search on it.
        if (meta?.serverCorrected) {
          setReply(null);
          track('scout_gate', { gate: 'server_correction' });
          setRefine({
            heard: meta.heardRaw ?? clean,
            options: [
              `Show me ${intent.role || 'people'} at ${intent.company}${intent.location ? ` in ${intent.location}` : ''}`,
            ],
          });
          setPhase('idle');
          return;
        }
        // Did-you-mean on the browse path too — "Show me people at Molly's"
        // searched PDL for Molly's while Moelis sat one rescue away (field
        // walk 2026-07-08). Free to the user, but garbage PDL spend for us.
        const browseSug = suggestFirm(intent.company);
        if (browseSug) {
          setReply(null);
          track('scout_gate', { gate: 'did_you_mean' });
          setRefine({
            heard: clean,
            options: [`Show me ${intent.role || 'people'} at ${browseSug}${intent.location ? ` in ${intent.location}` : ''}`],
          });
          setPhase('idle');
          return;
        }
        const seqF = ++requestSeq.current;
        setReply(null);
        setPhase('thinking');
        try {
          // "who are fintech at Plaid" — an INDUSTRY word in the role slot isn't a
          // job title; a PDL title search for "fintech" finds nobody. Send an
          // any-employee marker instead so it returns people at the company.
          const roleIsIndustry =
            !!industryFirmsFor(intent.role) || !!sectorForVibeText(intent.role || '');
          const env = await askScoutFindContacts({
            ask: clean,
            askId: `scout-find-${Date.now()}`,
            role: roleIsIndustry ? 'professional' : intent.role,
            company: intent.company,
            location: intent.location,
          });
          if (seqF !== requestSeq.current) return;
          // This is the find_contacts RPC, so the only receipt shape it can
          // return is contacts; the kind check narrows the union the brain
          // path added (jobs ride the same envelope now).
          const res0 = env.actions[0]?.results;
          const items = res0?.kind === 'contacts' ? res0.items : [];
          setReply({ say: env.say, actions: [] });
          if (items.length) {
            setPeoplePicks({ items, role: intent.role, company: intent.company, location: intent.location });
          } else {
            // A search that found nobody is a bad anchor — likely a mishear
            // ("Molly's · analyst" haunted the context trail for turns on
            // the field walk). Don't let it steer the next ask.
            setCtx(null);
          }
          setPhase('idle');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          if (seqF !== requestSeq.current) return;
          setPhase('idle');
          setReply({
            say: "The people search didn't come back — check your connection and try again.",
            actions: [],
          });
        }
        return;
      }

      if (intent?.kind === 'find_jobs') {
        let picks = matchJobs(allJobs, intent.query, intent.location);
        let fromPool = false;
        // Feed empty? Search the FULL pool by sector (fintech, AI, biotech…).
        // Scout's job search used to box itself to the loaded feed, so a sector
        // with hundreds of pool companies read as a flat "no jobs."
        const jobSector = sectorForVibeText(intent.query) ?? sectorForVibeText(meta?.heardRaw ?? clean);
        if (!picks.length && jobSector) {
          const seqJ = ++requestSeq.current;
          setReply(null);
          setPhase('thinking');
          try {
            const pool = await fetchSectorJobs(jobSector);
            if (seqJ !== requestSeq.current) return;
            picks = pool;
            fromPool = pool.length > 0;
          } catch {
            if (seqJ !== requestSeq.current) return;
          }
        }
        if (picks.length) {
          const applyable = picks.filter((j) => j.autoApplyEligible).length;
          const where = fromPool ? 'across the job pool' : 'in your feed';
          setReply({
            say: `Found ${picks.length} ${intent.query} role${picks.length === 1 ? '' : 's'} ${where}${applyable ? ` — ${applyable} can auto-apply` : ''}. Tap one:`,
            actions: [],
          });
          setJobPicks({ query: intent.query, jobs: picks });
        } else {
          // Jobs come from the daily feed, but people come from the full contact
          // database — so an empty job feed shouldn't dead-end. Offer to search
          // the wider database for people in that role to reach out to (re-runs
          // as a brain ask via chatMessage → full PDL, not the local feed).
          const peopleAsk = `Find people who are ${intent.query}${intent.location ? ` in ${intent.location}` : ''}`;
          setReply({
            say: `No ${intent.query} roles in today's job feed${intent.location ? ` for ${intent.location}` : ''} — it refreshes daily. Jobs come from your feed, but I can search the full database for people in that role to reach out to.`,
            actions: [
              { label: 'Find people instead', chatMessage: peopleAsk },
              { label: 'Open the Feed', href: '/(tabs)/feed' },
            ],
          });
        }
        setPhase('idle');
        return;
      }

      if (intent?.kind === 'apply_some') {
        // "Apply to a few jobs for me": candidates come from the CURRENT feed,
        // auto-apply-eligible only, target roles preferred. A sector-flavored
        // ask ("apply to a job in tech") falls through to the full pool when
        // the feed has nothing, same as the job-search path. The scope card
        // below is the irreversibility gate: every pick is shown by name with
        // the real credit cost before anything submits.
        const sector = intent.query
          ? (sectorForVibeText(intent.query) ?? sectorForVibeText(meta?.heardRaw ?? clean))
          : null;
        let candidates = pickApplyCandidates(
          allJobs,
          intent.count,
          profile?.targetRoles ?? [],
          intent.query,
          intent.location,
        );
        let fromPool = false;
        if (!candidates.length && sector) {
          const seqA = ++requestSeq.current;
          setReply(null);
          setPhase('thinking');
          try {
            const pool = await fetchSectorJobs(sector);
            if (seqA !== requestSeq.current) return;
            candidates = pickApplyCandidates(
              pool,
              intent.count,
              profile?.targetRoles ?? [],
              null,
              intent.location,
            );
            fromPool = candidates.length > 0;
          } catch {
            if (seqA !== requestSeq.current) return;
          }
        }
        if (!candidates.length) {
          const savedEligible = applyScope(savedJobs).eligible.length;
          setReply({
            say: `Nothing${intent.query ? ` matching ${intent.query}` : ''}${intent.location ? ` in ${intent.location}` : ''} can auto-apply from today's feed right now${savedEligible ? `, but ${savedEligible} of your saved jobs can` : ''}. The feed refreshes daily.`,
            actions: [
              ...(savedEligible
                ? [{ label: 'Apply to my saved jobs', chatMessage: 'apply to my saved jobs' }]
                : []),
              { label: 'Open the Feed', href: '/(tabs)/feed' },
            ],
          });
          setPhase('idle');
          return;
        }
        if (candidates.length === 1) {
          // One pick: the existing single-apply confirm card is the gate.
          setReply(null);
          track('scout_gate', { gate: 'apply_one' });
          setApplyOne(candidates[0]);
          setPhase('idle');
          return;
        }
        setReply(null);
        track('scout_gate', { gate: 'apply_some', count: candidates.length, from_pool: fromPool });
        setApplySome({ jobs: candidates, requested: intent.count, fromPool });
        setPhase('idle');
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
        track('scout_gate', { gate: 'receipt' });
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

      // No local parse — the ANY-ASK layer: LLM classification server-side
      // (cached), then the result is re-spoken in canonical form back through
      // this same pipeline so clarify/did-you-mean/pre-flight/receipts all
      // still apply. Regexes are the fast path, never the ceiling.
      if (!intent && !meta?.viaClassifier && !meta?.localOnly) {
        const seqC = ++requestSeq.current;
        setReply(null);
        setPhase('thinking');
        let cls: AskClassification | null = null;
        try {
          cls = await classifyAsk(clean, `cls-${Date.now()}`);
        } catch {
          cls = null;
        }
        if (seqC !== requestSeq.current) return;
        const canonical = cls && !cls.error ? canonicalAsk(cls) : null;
        if (canonical) {
          void submitAsk(canonical, { viaClassifier: true, heardRaw: clean, byVoice: meta?.byVoice });
          return;
        }
        setPhase('idle'); // fall through to refine/chat below with phase reset
      }

      // Ask names a target but didn't parse into anything runnable — almost
      // always a mishear ("Manners at Goldman Sachs"). NEVER hand these to
      // the chat brain (it answers with false promises); offer complete,
      // tappable variants instead.
      const options = intent ? null : refineOptions(clean, profile?.preferredLocations ?? []);
      if (options?.length) {
        setReply(null);
        track('scout_gate', { gate: 'refine' });
        setRefine({ heard: clean, options });
        setPhase('idle');
        return;
      }

      // No action intent — the real brain (Phase 2, SCOUT-ACTION-CONTRACT
      // action='ask'): one full server tool-loop turn. Receipts arrive as
      // typed actions and render natively — contact cards, prep jobRefs,
      // Inbox links — instead of prose-only chat. Falls back to the chat
      // endpoint (same brain, prose dialect) if the ask path is unavailable
      // (older backend build or transient failure).
      const seq = ++requestSeq.current;
      setReply(null);
      setPhase('thinking');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        let say = '';
        let actions: ScoutAction[] = [];
        try {
          const env = await askScoutBrain({
            ask: clean,
            askId: `ask-${Date.now()}`,
            conversationId: scoutThread.chatId(),
            source: meta?.byVoice ? 'voice' : 'typed',
          });
          if (seq !== requestSeq.current) return; // edited/superseded — drop it
          if (env.conversationId) scoutThread.setChatId(env.conversationId);
          say = env.say || "I didn't catch that — try asking again?";
          for (const a of env.actions || []) {
            if (
              (a.type === 'find_contacts' || a.type === 'find_hiring_managers') &&
              a.results?.items?.length
            ) {
              // Brain-executed searches CHARGED and saved to My Network (the
              // say text lists the people) — the receipt chip goes to where
              // they now live, never the free-preview card whose copy would
              // mislabel a paid result.
              const n = a.results.items.length;
              actions.push({ label: `View ${n} in your Network`, href: '/(tabs)/network' });
            } else if (a.type === 'navigate') {
              const href = mapScoutRoute(String(a.params?.route || ''));
              if (href) actions.push({ label: String(a.params?.label || '') || 'Take me there', href });
            } else if (a.type === 'meeting_prep' && a.jobRef?.id) {
              actions.push({ label: 'Watch the prep build', href: `/meeting-prep/${a.jobRef.id}` });
            } else if (a.type === 'draft_outreach' && a.results?.items?.length) {
              const n = a.results.items.length;
              actions.push({ label: `Open Inbox — ${n} draft${n === 1 ? '' : 's'} ready`, href: '/(tabs)/inbox' });
            } else if (a.type === 'followup' && a.params?.contactName) {
              // Scout just said someone is going cold. Make the offer
              // tappable: saying it in prose and leaving the student to type
              // "yes" is how this feature stays invisible.
              const who = String(a.params.contactName);
              const at = a.params.company ? ` at ${a.params.company}` : '';
              actions.push({
                label: a.params.draftReady ? `Send the follow-up to ${who}` : `Draft a follow-up to ${who}`,
                chatMessage: `draft a follow-up to ${who}${at}`,
              });
            } else if (a.type === 'find_jobs' && a.results?.kind === 'jobs' && a.results.items.length) {
              // Jobs the brain found in chat. The app has no results screen to
              // send them to, so each eligible one becomes a chip that asks
              // for it BY NAME. The server now sees the transcript, so that
              // follow-up resolves against this exact list instead of dying
              // as "which job did you mean".
              for (const j of a.results.items.filter((x) => x.autoApplyEligible).slice(0, 3)) {
                const where = j.company ? ` at ${j.company}` : '';
                actions.push({
                  label: `Apply: ${j.title}${where}`,
                  chatMessage: `apply to the ${j.title} role${where}`,
                });
              }
            } else if (a.type === 'auto_apply' && a.jobRef?.id) {
              // A real submission is running on the server. Previously this
              // receipt was dropped on the floor: the application went out and
              // the app said nothing, which is why asking Scout to apply felt
              // like it did nothing at all. Same live card the swipe-to-apply
              // path uses, polled to a terminal state.
              const who = [a.params?.title, a.params?.company].filter(Boolean).join(' at ')
                || 'your application';
              void trackAutoApply(String(a.jobRef.id), String(who));
              actions.push({ label: 'See your Applications', href: '/(tabs)/network' });
            }
          }
          // error.code affordances (contract Errors section) — say already
          // speaks the problem in user words; the chip is the next move.
          if (env.error && (env.error.code === 'insufficient_credits' || env.error.code === 'cap_reached')) {
            actions.push({ label: 'View credits', href: '/credits' });
          }
          // Auto-apply's own blockers. Each is fixable by the student in a
          // couple of taps, so each gets the tap rather than a dead sentence.
          if (env.error?.code === 'application_profile_required') {
            actions.push({ label: 'Finish application profile', href: '/application-profile' });
          }
          if (env.error?.code === 'auto_apply_unavailable') {
            actions.push({ label: 'See your Applications', href: '/(tabs)/network' });
          }
        } catch {
          const res = await sendScoutMessage({
            message: clean,
            history: scoutThread.history(16),
            currentPage: '/scout',
            chatId: scoutThread.chatId(),
          });
          if (seq !== requestSeq.current) return;
          if (res.chatId) scoutThread.setChatId(res.chatId);
          say = res.message;
          actions = res.actions;
        }
        // The user's ask and Scout's reply both land on the shared thread via
        // the submitAsk/reply-effect appends — no separate history to keep.
        setReply({ say, actions });
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
    // ctx included: the context-inference and instant-follow-up checks read
    // it — a stale closure here would forget the firm mid-conversation.
    // applySome/allJobs/profile joined for the apply_some path (candidate
    // pick + voice-affirmation on its scope card).
    [clarify, savedJobs, runDraftAction, runApplyAction, loopCompanies, ctx, applySome, allJobs, profile],
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
    stopSpeaking(); // the mic must never transcribe Scout's own voice
    setTranscript('');
    setReply(null);
    setPhase('listening');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    let finalText = '';
    // Ask audio for server transcription (P2) — captured for everyone now
    // that this build's permission copy is honest about it.
    let audioUri: string | null = null;
    let audioSettled = false;
    stopRef.current = startListening({
      contextualStrings: speechVocab,
      onAudioFile: (u: string | null) => {
        audioUri = u;
        audioSettled = true;
      },
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
            void submitAsk(finalText, {
              byVoice: true,
              getAudio: () => ({ uri: audioUri, settled: audioSettled }),
            });
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
  }, [voiceReady, showToast, submitAsk, volume, speechVocab]);

  const editAsk = useCallback(() => {
    requestSeq.current += 1; // orphan any in-flight reply
    track('scout_ask_edited', {});
    setPhase('idle');
    setTyped(ask);
    setTimeout(() => inputRef.current?.focus(), 60);
  }, [ask]);

  // Scout asked a question — the next utterance is an ANSWER, and the UI
  // should say so (Rylan: users need to know this is a rolling conversation).
  const awaitingAnswer = !!reply && /\?\s*$/.test(reply.say.trim());

  const orbState: OrbState = speaking
    ? 'speaking'
    : cards.length > 0
      ? 'acting'
      : phase === 'clarify' || phase === 'receipt'
        ? 'idle'
        : phase === 'idle'
          ? reply
            ? 'done'
            : 'idle'
          : phase;

  /** Anything waiting on a decision lives in the chat, not in voice mode:
   *  spending credits should never be confirmed by a screen the user cannot
   *  read the fine print on. Voice mode steps aside when one opens. */
  const gateOpen = !!(
    preflight ||
    receipt ||
    applyOne ||
    applySome ||
    didYouMean ||
    refine ||
    peoplePicks ||
    jobPicks ||
    clarify
  );
  useEffect(() => {
    if (voiceOpen && gateOpen) setVoiceOpen(false);
  }, [voiceOpen, gateOpen]);

  /** Open voice mode and start listening. Falls back to the type bar with a
   *  toast on builds where the speech module is missing (beginListening
   *  already handles that), so this never opens an empty room. */
  const openVoice = useCallback(() => {
    firstAction('voice');
    if (!voiceReady()) {
      showToast('Voice needs the latest version of the app, type below for now');
      return;
    }
    stopSpeaking();
    setSpeaking(false);
    setVoiceOpen(true);
    void beginListening();
  }, [beginListening, firstAction, showToast, voiceReady]);

  const closeVoice = useCallback(() => {
    stopRef.current?.();
    stopSpeaking();
    setSpeaking(false);
    setVoiceOpen(false);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: room.bg }}>
      <LinearGradient
        colors={[room.sky, room.bg, room.deep]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Title centered like the rest of the app's headers; the bell is the
          standard notifications icon + badge, just on the night palette.
          The title is absolutely centred rather than flexed, because the
          right-hand cluster (info, Scout, new chat, bell) is much wider than
          the menu button and a flexed title would sit visibly off-centre. */}
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 18 }}>
        <View style={{ height: 38, flexDirection: 'row', alignItems: 'center' }}>
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 26, color: room.ink }}>Scout</Text>
          </View>

          <Pressable
            onPress={() => setHistoryOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Chats"
            style={{ paddingRight: 6 }}>
            <Ionicons name="menu-outline" size={24} color={room.ink} />
          </Pressable>

          <View style={{ flex: 1 }} />

        {/* What Scout does, always one tap away (Rylan 2026-08-17). The link
            under the orb only exists on an empty chat; this is the version
            that survives the conversation starting. */}
        <Pressable
          onPress={() => {
            track('scout_explainer_opened', { from: 'header' });
            setExplainerOpen(true);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="What does Scout do"
          style={{ paddingHorizontal: 5 }}>
          <Ionicons name="information-circle-outline" size={22} color={room.ink2} />
        </Pressable>

        {/* The yeti header button is gone on THIS tab (Rylan 2026-08-18): you
            are already looking at Scout, so a second Scout face in the corner
            is furniture. Voice still has two doors, the orb and the mic. */}
        {hasThread ? (
          <Pressable
            onPress={newChat}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="New chat"
            style={{ paddingHorizontal: 5 }}>
            <Ionicons name="create-outline" size={22} color={room.ink} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => {
            firstAction('notifications');
            router.push('/notifications');
          }}
          hitSlop={10}
          style={{ paddingLeft: 5 }}>
          <View>
            <Ionicons name="notifications-outline" size={23} color={room.ink} />
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
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={insets.bottom + 46}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: hasThread ? 'stretch' : 'center',
            justifyContent: hasThread ? 'flex-start' : 'center',
            gap: 14,
            paddingHorizontal: 18,
            paddingTop: hasThread ? 14 : 0,
            paddingBottom: 10,
          }}
          keyboardShouldPersistTaps="handled">
          {/* Empty state: the orb IS the front door. Once a conversation
              exists it steps aside and the thread takes the screen, which is
              what people expect from a chat (Rylan 2026-08-17). */}
          {!hasThread ? (
            <View style={{ alignItems: 'center', gap: 16 }}>
              <ScoutOrb state={orbState} volume={volume} size={244} onPress={openVoice} />
              <Text
                style={{
                  fontFamily: fonts.sansMedium,
                  fontSize: 14.5,
                  color: room.ink2,
                  textAlign: 'center',
                  paddingHorizontal: 30,
                }}>
                {phase === 'listening'
                  ? transcript || 'Listening…'
                  : 'Tap and ask Scout for anything'}
              </Text>
              {phase === 'idle' ? (
                <Pressable
                  onPress={() => {
                    track('scout_explainer_opened', { from: 'empty_state' });
                    setExplainerOpen(true);
                  }}
                  hitSlop={8}
                  accessibilityRole="button">
                  <Text
                    style={{
                      fontFamily: fonts.sansMedium,
                      fontSize: 13,
                      color: room.accent,
                      textDecorationLine: 'underline',
                    }}>
                    What does Scout do?
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            messages.map((m, i) => (
              <ChatMessage key={`${i}-${m.from}`} from={m.from} text={m.text} room={room} />
            ))
          )}

          {/* The live utterance, as the bubble it is about to become. */}
          {hasThread && phase === 'listening' ? (
            <ChatMessage from="user" text={transcript || 'Listening…'} room={room} pending />
          ) : null}

          {phase === 'thinking' ? (
            <Animated.View
              entering={FadeInDown.duration(200)}
              exiting={FadeOut.duration(140)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator size="small" color={room.live} />
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: room.ink2 }}>
                {thinkWord}…
              </Text>
              <Pressable onPress={editAsk} hitSlop={8}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12.5, color: room.accent }}>
                  Edit
                </Text>
              </Pressable>
            </Animated.View>
          ) : null}

          {phase === 'clarify' && clarify ? (
            <Animated.View
              entering={FadeInDown.duration(220)}
              style={{ alignSelf: 'flex-start', maxWidth: '92%', gap: 8 }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, lineHeight: 22, color: room.ink }}>
                {clarify.question}
              </Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: room.ink3 }}>
                say it, type it below, or
              </Text>
              <Pressable
                onPress={() => {
                  const base = clarify.baseAsk;
                  track('scout_gate_outcome', { gate: 'clarify', outcome: 'run_anywhere', method: 'tap' });
                  setClarify(null);
                  setPhase('idle');
                  const intent = parseIntent(base);
                  if (intent?.kind === 'draft') void runDraftAction(intent);
                }}
                style={{ alignSelf: 'flex-start', borderWidth: 1, borderColor: room.line, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 15 }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12.5, color: room.ink2 }}>
                  Search anywhere
                </Text>
              </Pressable>
            </Animated.View>
          ) : null}

          {phase === 'receipt' && receipt ? (
            <Animated.View
              entering={FadeInDown.duration(220)}
              style={{
                alignSelf: 'stretch',
                backgroundColor: room.card,
                borderColor: room.line,
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
                gap: 11,
              }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: room.ink }}>
                You have {receipt.eligible.length} saved job{receipt.eligible.length === 1 ? '' : 's'} ready
              </Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: room.ink2 }}>
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
                      borderColor: receipt.chosen === t.count ? room.tintLine : room.line,
                      backgroundColor: receipt.chosen === t.count ? room.tintStrong : 'transparent',
                    }}>
                    <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12.5, color: receipt.chosen === t.count ? room.ink : room.note }}>
                      {t.label} · {t.creditEstimate} cr
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 9, marginTop: 3 }}>
                <Pressable
                  onPress={() => {
                    track('scout_gate_outcome', { gate: 'receipt', outcome: 'cancel', method: 'tap' });
                    setReceipt(null);
                    setPhase('idle');
                  }}
                  style={{ flex: 1, borderWidth: 1, borderColor: room.line, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: room.ink2 }}>Not now</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    track('scout_gate_outcome', { gate: 'receipt', outcome: 'run', method: 'tap', count: receipt.chosen });
                    void runApplyAction(receipt.eligible.slice(0, receipt.chosen));
                  }}
                  style={{ flex: 1, backgroundColor: room.accent, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
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
                alignSelf: 'stretch',
                backgroundColor: room.card,
                borderColor: room.line,
                borderWidth: 1,
                borderRadius: 15,
                padding: 14,
                gap: 8,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color={room.live} />
                <Text style={{ flex: 1, fontFamily: fonts.sansSemibold, fontSize: 13.5, color: room.ink }}>{c.title}</Text>
              </View>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: room.live }}>{c.stageLabel}</Text>
              {typeof c.progressPct === 'number' ? (
                <View style={{ height: 4, borderRadius: 2, backgroundColor: room.track, overflow: 'hidden' }}>
                  <Animated.View
                    layout={LinearTransition.duration(700)}
                    style={{
                      height: '100%',
                      width: `${Math.max(4, Math.min(c.progressPct, 96))}%`,
                      borderRadius: 2,
                      backgroundColor: room.accent,
                    }}
                  />
                </View>
              ) : (
                // No number yet (re-hydrated card) — an empty track, never an
                // invented percentage. The spinner above already says "live".
                <View style={{ height: 4, borderRadius: 2, backgroundColor: room.track }} />
              )}
            </Animated.View>
          ))}

          {phase === 'idle' && preflight ? (
            <Animated.View
              entering={FadeInDown.duration(220)}
              style={{
                alignSelf: 'stretch',
                backgroundColor: room.card,
                borderColor: room.line,
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
                gap: 10,
              }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15.5, color: room.ink }}>
                Ready to search: “{preflight.pf.interpreted}”
              </Text>
              {preflight.pf.heardRaw ? (
                <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: room.ink3 }}>
                  heard “{preflight.pf.heardRaw}” — I cleaned it up
                </Text>
              ) : null}
              {preflight.pf.note ? (
                <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18, color: room.note }}>
                  {preflight.pf.note}
                </Text>
              ) : null}
              {preflight.pf.variants.length ? (
                <View style={{ gap: 7 }}>
                  {preflight.pf.variants.map((o) => (
                    <Pressable
                      key={o}
                      onPress={() => {
                        track('scout_gate_outcome', { gate: preflight.gate, outcome: 'variant', method: 'tap' });
                        void submitAsk(o, { source: 'variant' });
                      }}
                      style={{
                        borderWidth: 1,
                        borderColor: room.tintLine,
                        backgroundColor: room.tint,
                        borderRadius: 12,
                        paddingVertical: 10,
                        paddingHorizontal: 13,
                      }}>
                      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: room.ink }}>{o}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 9, marginTop: 2 }}>
                <Pressable
                  onPress={() => {
                    track('scout_gate_outcome', { gate: preflight.gate, outcome: 'cancel', method: 'tap' });
                    setPreflight(null);
                  }}
                  style={{ flex: 1, borderWidth: 1, borderColor: room.line, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: room.ink2 }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const it = preflight.intent;
                    track('scout_gate_outcome', { gate: preflight.gate, outcome: 'run', method: 'tap' });
                    setPreflight(null);
                    void runDraftAction(it);
                  }}
                  style={{ flex: 1, backgroundColor: room.accent, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: '#fff' }}>Run it as-is</Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : null}

          {phase === 'idle' && peoplePicks ? (
            <Animated.View entering={FadeInDown.duration(220)} style={{ alignSelf: 'stretch', gap: 7 }}>
              {peoplePicks.items.map((c) => (
                <View
                  key={c.name + c.title}
                  style={{
                    borderWidth: 1,
                    borderColor: room.lineSoft,
                    backgroundColor: room.cardSoft,
                    borderRadius: 13,
                    paddingVertical: 10,
                    paddingHorizontal: 13,
                    gap: 2,
                  }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: room.ink }} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: room.ink2 }} numberOfLines={1}>
                    {c.title || 'Team member'} · {c.company}
                  </Text>
                </View>
              ))}
              <Pressable
                onPress={() => {
                  const pp = peoplePicks;
                  setPeoplePicks(null);
                  void runDraftAction({
                    kind: 'draft',
                    count: Math.min(pp.items.length, 5),
                    role: pp.role || 'someone on the team',
                    company: pp.company,
                    location: pp.location,
                    hm: /hiring manager|recruiter/i.test(pp.role),
                    wantedSend: false,
                  });
                }}
                style={{ backgroundColor: room.accent, borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: '#fff' }}>
                  Draft the best {Math.min(peoplePicks.items.length, 5)} · {Math.min(peoplePicks.items.length, 5) * 5} credits
                </Text>
              </Pressable>
              <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: room.ink3, textAlign: 'center' }}>
                preview is free — drafting finds and charges the top matches
              </Text>
            </Animated.View>
          ) : null}

          {phase === 'idle' && jobPicks && !applyOne ? (
            <Animated.View
              entering={FadeInDown.duration(220)}
              style={{ alignSelf: 'stretch', gap: 7 }}>
              {jobPicks.jobs.map((j) => (
                <Pressable
                  key={j.id}
                  onPress={() => {
                    if (j.autoApplyEligible) {
                      track('scout_gate', { gate: 'apply_one' });
                      setApplyOne(j);
                    } else router.push('/(tabs)/feed' as never);
                  }}
                  style={{
                    borderWidth: 1,
                    borderColor: room.tintLine,
                    backgroundColor: room.tint,
                    borderRadius: 13,
                    paddingVertical: 11,
                    paddingHorizontal: 13,
                    gap: 2,
                  }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: room.ink }} numberOfLines={1}>
                    {j.title}
                  </Text>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: room.ink2 }} numberOfLines={1}>
                    {j.company}{j.location ? ` · ${j.location}` : ''}
                    {j.autoApplyEligible ? '  ·  auto-apply ✓' : '  ·  view in Feed'}
                  </Text>
                </Pressable>
              ))}
            </Animated.View>
          ) : null}

          {phase === 'idle' && applyOne ? (
            <Animated.View
              entering={FadeInDown.duration(220)}
              style={{
                alignSelf: 'stretch',
                backgroundColor: room.card,
                borderColor: room.line,
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
                gap: 10,
              }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15.5, color: room.ink }}>
                Apply to {applyOne.title}?
              </Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: room.ink2 }}>
                {applyOne.company}{applyOne.location ? ` · ${applyOne.location}` : ''} · submits for real · {AUTO_APPLY_CREDITS} credits
              </Text>
              <View style={{ flexDirection: 'row', gap: 9 }}>
                <Pressable
                  onPress={() => {
                    track('scout_gate_outcome', { gate: 'apply_one', outcome: 'cancel', method: 'tap' });
                    setApplyOne(null);
                  }}
                  style={{ flex: 1, borderWidth: 1, borderColor: room.line, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: room.ink2 }}>Not now</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const j = applyOne;
                    track('scout_gate_outcome', { gate: 'apply_one', outcome: 'run', method: 'tap' });
                    setApplyOne(null);
                    setJobPicks(null);
                    void runApplyAction([j]);
                  }}
                  style={{ flex: 1, backgroundColor: room.accent, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: '#fff' }}>Apply</Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : null}

          {phase === 'idle' && applySome ? (
            <Animated.View
              entering={FadeInDown.duration(220)}
              style={{
                alignSelf: 'stretch',
                backgroundColor: room.card,
                borderColor: room.line,
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
                gap: 11,
              }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: room.ink }}>
                Apply to these {applySome.jobs.length}?
              </Text>
              {applySome.requested > applySome.jobs.length ? (
                <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: room.ink3 }}>
                  You asked for {applySome.requested} — {applySome.jobs.length} {applySome.jobs.length === 1 ? 'is' : 'are'} eligible right now.
                </Text>
              ) : null}
              <View style={{ gap: 7 }}>
                {applySome.jobs.map((j) => (
                  <View
                    key={j.id}
                    style={{
                      borderWidth: 1,
                      borderColor: room.lineSoft,
                      backgroundColor: room.cardSoft,
                      borderRadius: 13,
                      paddingVertical: 10,
                      paddingHorizontal: 13,
                      gap: 2,
                    }}>
                    <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: room.ink }} numberOfLines={1}>
                      {j.title}
                    </Text>
                    <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: room.ink2 }} numberOfLines={1}>
                      {j.company}{j.location ? ` · ${j.location}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: room.ink2 }}>
                {applySome.fromPool ? 'Pulled from the wider job pool · ' : ''}applications submit for real · {applySome.jobs.length * AUTO_APPLY_CREDITS} credits
              </Text>
              <View style={{ flexDirection: 'row', gap: 9 }}>
                <Pressable
                  onPress={() => {
                    track('scout_gate_outcome', { gate: 'apply_some', outcome: 'cancel', method: 'tap' });
                    setApplySome(null);
                  }}
                  style={{ flex: 1, borderWidth: 1, borderColor: room.line, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: room.ink2 }}>Not now</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const picks = applySome.jobs;
                    track('scout_gate_outcome', { gate: 'apply_some', outcome: 'run', method: 'tap', count: picks.length });
                    setApplySome(null);
                    void runApplyAction(picks);
                  }}
                  style={{ flex: 1, backgroundColor: room.accent, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: '#fff' }}>
                    Apply to {applySome.jobs.length}
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : null}

          {phase === 'idle' && refine ? (
            <Animated.View
              entering={FadeInDown.duration(220)}
              style={{
                alignSelf: 'stretch',
                backgroundColor: room.card,
                borderColor: room.line,
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
                gap: 10,
              }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15.5, color: room.ink }}>
                I heard “{refine.heard}” — did you mean one of these?
              </Text>
              <View style={{ gap: 7 }}>
                {refine.options.map((o) => (
                  <Pressable
                    key={o}
                    onPress={() => {
                      track('scout_gate_outcome', { gate: 'refine', outcome: 'variant', method: 'tap' });
                      void submitAsk(o, { source: 'variant' });
                    }}
                    style={{
                      borderWidth: 1,
                      borderColor: room.tintLine,
                      backgroundColor: room.tint,
                      borderRadius: 12,
                      paddingVertical: 10,
                      paddingHorizontal: 13,
                    }}>
                    <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: room.ink }}>{o}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: room.ink3 }}>
                or say it again / type your own below
              </Text>
            </Animated.View>
          ) : null}

          {phase === 'idle' && didYouMean ? (
            <Animated.View
              entering={FadeInDown.duration(220)}
              style={{
                alignSelf: 'stretch',
                backgroundColor: room.card,
                borderColor: room.line,
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
                gap: 11,
              }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: room.ink }}>
                Did you mean {didYouMean.suggestion}?
              </Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: room.ink2 }}>
                I heard “{didYouMean.intent.company}” — that doesn't look like a company I know.
              </Text>
              <View style={{ flexDirection: 'row', gap: 9 }}>
                <Pressable
                  onPress={() => {
                    const it = { ...didYouMean.intent };
                    track('scout_gate_outcome', { gate: 'did_you_mean', outcome: 'run_original', method: 'tap' });
                    setDidYouMean(null);
                    void runDraftAction(it);
                  }}
                  style={{ flex: 1, borderWidth: 1, borderColor: room.line, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: room.ink2 }}>
                    Keep “{didYouMean.intent.company}”
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const it = { ...didYouMean.intent, company: didYouMean.suggestion };
                    track('scout_gate_outcome', { gate: 'did_you_mean', outcome: 'run_suggestion', method: 'tap' });
                    setDidYouMean(null);
                    void runDraftAction(it);
                  }}
                  style={{ flex: 1, backgroundColor: room.accent, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: '#fff' }}>
                    Yes — {didYouMean.suggestion}
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : null}

          {/* Scout's reply text already lives in the transcript above; what
              is left here are its chips, sitting under the last thing it
              said the way a chat app puts quick replies under a message. */}
          {phase === 'idle' && reply && !didYouMean && reply.actions.length ? (
            <Animated.View
              entering={FadeInDown.duration(240)}
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {reply.actions.map((a) => (
                <Pressable
                  key={a.label}
                  onPress={() => {
                    setReply(null);
                    // chat_message chips run in the conversation (e.g.
                    // company intel → "Find people at X"); route chips
                    // navigate. Per SCOUT_BACKEND_HANDOFF.md §7.
                    if (a.chatMessage) {
                      void submitAsk(a.chatMessage, { source: 'chip' });
                    } else if (a.href === '#paywall') {
                      presentPaywall({ context: 'scout' });
                    } else if (a.href) {
                      router.push(a.href as never);
                    }
                  }}
                  style={{
                    borderRadius: 999,
                    paddingVertical: 7,
                    paddingHorizontal: 13,
                    backgroundColor: room.tintStrong,
                    borderWidth: 1,
                    borderColor: room.tintLine,
                  }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12.5, color: room.ink }}>
                    {a.label}
                  </Text>
                </Pressable>
              ))}
            </Animated.View>
          ) : null}

          {/* What Scout is still holding onto from earlier turns, tappable
              to forget. */}
          {phase === 'idle' && ctx && Object.keys(ctx.slots).length ? (
            <Pressable
              onPress={() => setCtx(null)}
              style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 }}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: room.ink3 }} numberOfLines={1}>
                {[
                  ctx.slots.company,
                  ctx.slots.role,
                  ctx.slots.count && ctx.slots.count > 1 ? `×${ctx.slots.count}` : null,
                  ctx.slots.location,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: room.ink3 }}>✕</Text>
            </Pressable>
          ) : null}

          {/* Loops are shelved for v1 — the Ongoing section is gone (Rylan,
              2026-07-08): one-shot asks cover the job and the night room
              stays clean. The engine + /loops page survive for deep links
              and a future "autopilot" revival; `loops` still feeds the ASR
              vocabulary and the first-run gate above. */}
        </ScrollView>

        {/* Composer. Pinned under the conversation, never scrolls away.
            Suggestions ride above it on a fresh chat only: once there is a
            thread, the conversation is the prompt. */}
        {/* Raised off the bottom lip (Rylan 2026-08-18 round 3), tightening
            the dead zone between the orb block and the composer. */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}>
          {/* Fixed geometry: one chip centered on top, two below, inside a
              constant-height box (Rylan 2026-08-18). Free-wrapping chips
              reflowed to a different height every cycle and nudged the whole
              screen; now the rotation happens inside a frame that never
              moves. */}
          {!hasThread && phase !== 'thinking' ? (
            <Animated.View
              key={sugOffset}
              entering={FadeInDown.duration(350)}
              style={{ gap: 6, alignItems: 'center', height: 66, justifyContent: 'center' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
                {[0].map((i) => {
                  const sug = suggestionPool[(sugOffset + i) % suggestionPool.length];
                  return (
                    <Pressable
                      key={sug}
                      onPress={() => {
                        firstAction('chip');
                        void submitAsk(sug, { source: 'chip' });
                      }}
                      style={{
                        borderWidth: 1,
                        borderColor: room.lineSoft,
                        borderRadius: 999,
                        paddingVertical: 6,
                        paddingHorizontal: 11,
                        backgroundColor: room.card,
                      }}>
                      <Text
                        numberOfLines={1}
                        style={{ fontFamily: fonts.sansMedium, fontSize: 11.5, color: room.ink2 }}>
                        {sug}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
                {[1, 2].map((i) => {
                  const sug = suggestionPool[(sugOffset + i) % suggestionPool.length];
                  return (
                    <Pressable
                      key={sug}
                      onPress={() => {
                        firstAction('chip');
                        void submitAsk(sug, { source: 'chip' });
                      }}
                      style={{
                        maxWidth: '49%',
                        borderWidth: 1,
                        borderColor: room.lineSoft,
                        borderRadius: 999,
                        paddingVertical: 6,
                        paddingHorizontal: 11,
                        backgroundColor: room.card,
                      }}>
                      <Text
                        numberOfLines={1}
                        style={{ fontFamily: fonts.sansMedium, fontSize: 11.5, color: room.ink2 }}>
                        {sug}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          ) : null}

          <ChatComposer
            ref={inputRef}
            room={room}
            value={typed}
            onChangeText={(t) => {
              // Typing over the prefilled question means they came here to do
              // something, not to be shown around. Drop the hand, keep the tour
              // reachable from the info button.
              if (tourArmed && t !== TOUR_OPENER) setTourArmed(false);
              setTyped(t);
            }}
            placeholder={awaitingAnswer ? 'Answer Scout' : 'Ask Scout'}
            // The examples type themselves into the box, but never over a
            // question Scout is waiting on, and never mid-conversation.
            typingHints={awaitingAnswer || hasThread ? undefined : suggestionPool}
            listening={phase === 'listening'}
            busy={phase === 'thinking'}
            onSubmit={() => {
              if (tourArmed) {
                startTourFromScout();
                return;
              }
              const t = typed;
              firstAction('typed');
              setTyped('');
              void submitAsk(t);
            }}
            onMic={openVoice}
            onStop={() => {
              // Listening: end the utterance and let it run. Thinking: cancel
              // and hand the ask back, which is what Edit already does.
              if (phase === 'listening') stopRef.current?.();
              else editAsk();
            }}
            onPlus={() => {
              firstAction('attachments');
              router.push('/attachments');
            }}
          />

          {/* The hand. Positioned off the composer's right edge so its
              fingertip lands on the send button, and it never eats the tap:
              TapHand is pointerEvents none all the way down. */}
          {tourArmed ? (
            <View
              pointerEvents="none"
              // Fingertip on the button's near edge, body reaching in from
              // below the screen. Deliberately NOT centred on the button: the
              // hand must point at the thing to tap without covering it.
              style={{ position: 'absolute', right: 44, bottom: -50 }}>
              <TapHand color={room.ink2} size={78} flip />
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>

      {explainerOpen ? (
        <WhatScoutDoes
          room={room}
          onClose={() => setExplainerOpen(false)}
          onExample={(ask) => {
            setExplainerOpen(false);
            firstAction('explainer_example');
            void submitAsk(ask, { source: 'explainer' });
          }}
        />
      ) : null}

      {voiceOpen ? (
        <VoiceMode
          room={room}
          orbState={orbState}
          volume={volume}
          listening={phase === 'listening'}
          thinking={phase === 'thinking'}
          transcript={transcript}
          say={phase === 'idle' && reply ? reply.say : null}
          thinkWord={thinkWord}
          onTalk={() => {
            stopSpeaking();
            setSpeaking(false);
            void beginListening();
          }}
          onStop={() => stopRef.current?.()}
          onClose={closeVoice}
        />
      ) : null}

      {historyOpen ? (
        <ChatHistoryPanel
          room={room}
          onClose={() => setHistoryOpen(false)}
          onNewChat={newChat}
          onLoaded={(entries) => {
            // A saved chat is the live thread now: clear whatever the stage
            // was holding so nothing from the old conversation lingers.
            setReply(null);
            setClarify(null);
            setPreflight(null);
            setDidYouMean(null);
            setRefine(null);
            setJobPicks(null);
            setApplyOne(null);
            setApplySome(null);
            setPeoplePicks(null);
            setReceipt(null);
            setPhase('idle');
            setThreadSize(entries.length);
          }}
          onError={(m) => showToast(m)}
          onExplain={() => {
            track('scout_explainer_opened', { from: 'chats' });
            setHistoryOpen(false);
            setExplainerOpen(true);
          }}
        />
      ) : null}
    </View>
  );
}
