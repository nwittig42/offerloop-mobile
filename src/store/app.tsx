import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { USE_MOCKS } from '@/api/config';
import {
  fetchFeedPage,
  fetchFilteredJobsPage,
  rankJobsByLocation,
  sendJobFeedback,
  type DeckPage,
} from '@/api/endpoints/feed';
import { fetchInbox } from '@/api/endpoints/inbox';
import { createLoop, fetchLoops, setLoopPaused, type LoopPeople } from '@/api/endpoints/loops';
import { fetchMe } from '@/api/endpoints/me';
import {
  fetchNotifications,
  markNotificationsRead as apiMarkNotificationsRead,
} from '@/api/endpoints/notifications';
import {
  alreadyApplied,
  startAutoApply,
  type AppliedJob,
} from '@/api/endpoints/autoApply';
import { createMeetingPrep, fetchMeetingPreps } from '@/api/endpoints/meetingPreps';
import { markOnboardingComplete } from '@/api/endpoints/preferences';
import { enrichLinkedin, type EnrichResult } from '@/api/endpoints/profile';
import { runSwipe, type DraftJobProgress } from '@/api/endpoints/swipe';
import { isInsufficientCredits } from '@/api/errors';
import { iapAvailable } from '@/api/purchases';
import { presentPaywall } from '@/components/paywall/paywallBus';
import { hasAIConsent, promptAIConsent } from '@/lib/aiConsent';
import { qk } from '@/api/queryKeys';
import { useAuth } from '@/auth/AuthProvider';
import { identify, setAnalyticsUser, takePendingSignInMethod, track } from '@/lib/analytics';
import { safeStringify } from '@/lib/safeJson';
import { normCompanyName, sameCompany } from '@/lib/company';
import { markTourPending, setTourUser } from '@/lib/tourFlag';
import {
  hasNotificationPermission,
  registerForPushNotificationsAsync,
} from '@/notifications/push';

import {
  MOCK_FILES,
  MOCK_JOBS,
  MOCK_MEETING_PREPS,
  MOCK_NOTIFICATIONS_SEED,
  MOCK_OUTREACH_SEED,
  MOCK_PROFILE,
} from '@/mocks/data';
import { restorePassedCandidate } from '@/api/endpoints/ranker';
import type {
  Job,
  Loop,
  LoopActivity,
  MeetingPrep,
  NotificationItem,
  OutreachItem,
  ProfileFile,
  ResumeExperience,
  SwipeSettings,
  TrackerRow,
  Candidate,
} from '@/types';

/**
 * Swipe→draft queue: at most ONE draft request in flight; the rest wait their
 * turn (their Inbox placeholders show as queued). Each draft is a heavy
 * 25–60s server pipeline and the backend has few workers — a burst of
 * parallel swipes starves every other call (/me, the inbox poll) and fails
 * the excess: the exact field-test failure mode. Serializing keeps a worker
 * free and makes rapid swiping the intended UX. Module-level so it survives
 * re-renders. See PLAN-instant-feel.md Phase 0.
 */
let draftChain: Promise<unknown> = Promise.resolve();
let draftQueueDepth = 0;
function enqueueDraft<T>(task: () => Promise<T>, onStart: () => void): Promise<T> {
  draftQueueDepth += 1;
  const start = () => {
    onStart();
    return task();
  };
  const run = draftChain.then(start, start);
  const settle = () => {
    draftQueueDepth -= 1;
  };
  draftChain = run.then(settle, settle);
  return run;
}

/**
 * App store. Profile/credits and the job feed are server-backed via React Query
 * (GET /api/mobile/me, /api/jobs/feed); a right swipe calls the real
 * find + draft (/api/prompt-search) behind an optimistic "drafting" placeholder
 * that reconciles with the returned contact. Inbox, loops, and meeting prep are
 * still seeded from fixtures pending their own wiring.
 */

const DEFAULT_SWIPE_SETTINGS: SwipeSettings = {
  action: 'draft',
  contacts: 1,
  // OFF by default (Rylan, 2026-08-10, reversing the 07-21 call): submitting
  // applications on someone's behalf is opt-in trust, it spends credits, and
  // most new users lack the application profile it needs (they hit a wall on
  // their first swipe). Auto-apply is now an earned upgrade the user turns on
  // deliberately; the choice persists per-user (swipeSettingsStorageKey).
  autoApply: false,
  priority: 'employee',
  // OFF by default, same reasoning as autoApply: emailing a decision-maker on
  // the user's behalf spends credits and acts in their name. A right swipe
  // applies; adding the email is a deliberate second choice.
  emailHiringManager: false,
  scoutConfirmSpend: true,
  // No filter until the user writes one. Both decks open on the ranked default,
  // which is the only feed we can build without asking them anything.
  jobFilter: null,
  jobFilterRecents: [],
  peopleFilter: null,
  peopleFilterRecents: [],
};

/**
 * The Network "Contacts" list is the same people as the Inbox — everyone
 * you've reached out to — just shaped for the iMessage-style row. So we derive
 * it from the (real, polled) `outreach` array instead of a second fetch, which
 * also keeps the two surfaces in lockstep. Drops in-flight drafts and
 * no-contact-found failures (no real person to show yet).
 */
function outreachToTrackerRows(outreach: OutreachItem[]): TrackerRow[] {
  const rows: TrackerRow[] = [];
  for (const o of outreach) {
    if (o.status === 'queued' || o.status === 'drafting' || o.status === 'failed') continue;
    const needsYou = (o.status === 'replied' && !o.attended) || o.status === 'ready';
    let preview: string;
    let statusLabel: string;
    let statusTone: TrackerRow['statusTone'];
    let bucket: TrackerRow['bucket'];
    if (o.status === 'ready') {
      preview = o.subject ?? 'Draft ready to send';
      statusLabel = 'Draft ready';
      statusTone = 'accent';
      bucket = 'attention';
    } else if (o.status === 'replied') {
      const last = o.thread?.[o.thread.length - 1];
      preview = last && last.from === 'them' ? last.text : o.snippet ?? 'Replied';
      statusLabel = 'Replied';
      statusTone = 'positive';
      bucket = o.attended ? 'active' : 'attention';
    } else {
      // sent
      preview = `You: ${o.subject ?? 'Outreach sent'}`;
      statusLabel = 'Waiting';
      statusTone = 'waiting';
      bucket = 'active';
    }
    rows.push({
      id: o.id,
      contactName: o.contact?.name ?? o.company,
      company: o.company,
      lastActivity: statusLabel,
      outreachId: o.id,
      preview,
      timeShort: o.timeLabel,
      unread: needsYou,
      bucket,
      statusLabel,
      statusTone,
      pinned: o.pinned,
    });
  }
  return rows;
}

/**
 * Swipe "stamina": a batch of SWIPES (gestures) that refills after a
 * cooldown, the energy/stamina retention pattern. The metered unit is the
 * swipe, not the email: one swipe spends one swipe-token no matter how many
 * people it reaches, and the multi-contact cost is carried by CREDITS
 * instead. This keeps the daily allowance generous and rewards the
 * networked-applying play, while credits stay economically honest.
 * Deliverability spacing is a backend send-cadence concern, not this.
 * Real cooldowns would be hours; the mock compresses them to see the rhythm.
 */
const BATCH_BY_PLAN: Record<'Free' | 'Pro' | 'Elite', number> = { Free: 5, Pro: 8, Elite: 12 };

// Queries persisted to disk so a cold launch lands on the previous data
// instantly (the deck, inbox, loops, profile, …) while live queries refetch in
// the background. Keyed per-user so accounts never share a cache. Bump the
// version suffix if any of these shapes change so a stale blob can't restore.
const PERSIST_CACHE_VERSION = 'v1';
const PERSISTED_QUERIES: { name: string; key: readonly unknown[] }[] = [
  { name: 'me', key: qk.me },
  { name: 'feed', key: qk.feed },
  { name: 'inbox', key: qk.inbox },
  { name: 'loops', key: qk.loops },
  { name: 'meetingPreps', key: qk.meetingPreps },
  { name: 'notifications', key: qk.notifications },
];
const cacheStorageKey = (uid: string, name: string) =>
  `offerloop.cache.${uid}.${name}.${PERSIST_CACHE_VERSION}`;
// First-run onboarding completion, stored per-user (separate from the query
// cache above — it's a single flag, not a restorable blob). Bump the version to
// re-show the flow to everyone after a redesign.
const onboardingStorageKey = (uid: string) => `offerloop.onboarding.${uid}.v1`;
// Jobs the user swiped away, cached per-user with a short TTL so they don't keep
// reappearing in the feed mid-session / across a relaunch, but also don't pile up
// stale forever. Half a day: long enough to cover a session, short enough that a
// job you passed this morning can resurface tomorrow.
const passedJobsStorageKey = (uid: string) => `offerloop.passedJobs.${uid}.v1`;
const passedPeopleStorageKey = (uid: string) => `offerloop.passedPeople.${uid}.v1`;
// People do not churn the way job listings do: keep a pass for a month.
const PASSED_PEOPLE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Swipe settings used to be plain in-memory state, so every relaunch silently
// reset targeting and auto-apply back to defaults. Persisted per-user now:
// saved choices win, defaults only fill gaps (new fields, fresh installs).
const swipeSettingsStorageKey = (uid: string) => `offerloop.swipeSettings.${uid}.v1`;
const PASSED_JOBS_TTL_MS = 12 * 60 * 60 * 1000;
// The exact job card the user swiped, kept per company so the company page can
// show the real card they acted on (not a generic company blurb).
const swipedCardsStorageKey = (uid: string) => `offerloop.swipedCards.${uid}.v1`;
const companyKey = (name: string) => (name || '').trim().toLowerCase();
// Jobs the user swiped UP to save for later (no TTL — saving is intentional).
const savedJobsStorageKey = (uid: string) => `offerloop.savedJobs.${uid}.v1`;
// Dev override: always start at onboarding on launch (set in .env / eas profile).
const FORCE_ONBOARDING = process.env.EXPO_PUBLIC_FORCE_ONBOARDING === '1';
const REAL_COOLDOWN_HOURS: Record<'Free' | 'Pro' | 'Elite', number> = { Free: 5, Pro: 4, Elite: 3 };
const MOCK_COOLDOWN_SECONDS = 60; // demo timer, stands in for REAL_COOLDOWN_HOURS

type ToastState = { message: string; showInboxAction: boolean } | null;

type Profile = typeof MOCK_PROFILE;

type AppStore = {
  jobs: Job[];
  allJobs: Job[];
  outreach: OutreachItem[];
  notifications: NotificationItem[];
  trackerRows: TrackerRow[];
  profile: Profile;
  /**
   * Live state of the server-backed profile call. The app renders MOCK_PROFILE
   * whenever the real /api/mobile/me hasn't returned, so `status`/`usingSampleData`
   * let the UI say so instead of passing fixtures off as real data.
   */
  connection: {
    /** 'reconnecting' = a refetch failed but we still have real data cached —
     * softer banner, no "sample data" claim (which would be false). */
    status: 'ok' | 'loading' | 'error' | 'reconnecting';
    usingSampleData: boolean;
    retry: () => void;
  };
  /** Signed in but the profile hasn't arrived from cache or network yet — the
   *  app shell holds its launch spinner instead of flashing MOCK_PROFILE as if
   *  it were the user's data. Releases on first /me settle (data OR error; the
   *  error path hands off to the honest "sample data" banner). */
  bootPending: boolean;
  /** Loops fleet has actually been fetched (success or error) — before this,
   *  `loops` is the empty fixture and "user has no loops" is unknowable.
   *  Gates first-run UI that keys off an empty Scout. */
  loopsReady: boolean;
  /**
   * Per-screen load state for the job feed and inbox. The store falls back to
   * fixtures until each query resolves, so these let the Feed/Inbox render their
   * own skeleton / error placeholder instead of flashing mock cards as real.
   */
  feedState: { loading: boolean; error: boolean; retry: () => void };
  inboxState: { loading: boolean; error: boolean; retry: () => void };
  /** Force-refetch the inbox (pull-to-refresh). Resolves when the fetch settles
   *  so a RefreshControl can show its spinner. Also runs the optimistic->real id
   *  reconcile, so a just-swiped draft picks up its real id immediately. */
  refetchInbox: () => Promise<unknown>;
  loops: Loop[];
  loopActivity: LoopActivity[];
  resumeExperiences: ResumeExperience[];
  files: ProfileFile[];
  meetingPreps: MeetingPrep[];
  toast: ToastState;
  unreadCount: number;
  // True for a couple seconds right after a swipe's draft lands, so the Inbox
  // tab badge can flash green ("one finished").
  draftJustCompleted: boolean;
  canUndo: boolean;
  passedCount: number;
  passedJobs: Job[];
  /** People swiped left on the People deck, newest last. */
  passedPeople: Candidate[];
  addPassedPerson: (person: Candidate) => void;
  restorePassedPerson: (id: string) => void;
  savedCount: number;
  savedJobs: Job[];
  swipeSettings: SwipeSettings;
  updateSwipeSettings: (patch: Partial<SwipeSettings>) => void;
  /** How many drafts the user can still afford. Credits are the only meter. */
  draftsLeft: number;
  /** Credits one swipe costs, given how many people it reaches. */
  costPerSwipe: number;
  notificationsEnabled: boolean;
  notifPromptDismissed: boolean;
  /** False until the async OS permission read resolves. The prompt must not
   *  render before this is true, or it flashes in on every launch. */
  notifPermissionResolved: boolean;
  setNotificationsEnabled: (value: boolean) => void;
  dismissNotifPrompt: () => void;
  passJob: (id: string) => void;
  draftJob: (id: string, opts?: { silent?: boolean }) => void;
  draftAnotherContact: (opts: { company: string; jobTitle?: string }) => void;
  /** Re-run the draft for a failed Inbox row (tap-to-retry). */
  retryDraft: (id: string) => void;
  beginPersonPending: (person: { name: string; company: string; title?: string }) => string;
  /** Drop a ghost row when the hunt it stood for came back empty. */
  endPersonPending: (id: string) => void;
  /** Remember a job as the swiped card for its company (per-company Roles deck). */
  rememberSwipedCard: (job: Job) => void;
  /** Deduped auto-apply for any job — blocks a second application to the same one. */
  autoApplyJob: (job: Job) => void;
  undoLastPass: () => void;
  restorePassedJob: (id: string) => void;
  saveJob: (id: string) => void;
  unsaveJob: (id: string) => void;
  restoreSavedJob: (id: string) => void;
  resetDeck: () => void;
  /** Fetch a fresh, deeper slice of the ranked pool — new/adjacent roles. */
  rerollFeed: () => void;
  /** True while a rerollFeed() fetch is in flight (for button state). */
  rerolling: boolean;
  updateOutreach: (id: string, patch: Partial<OutreachItem>) => void;
  /** Map a stale optimistic outreach id to its real server id once reconciled. */
  resolveOutreachId: (id: string) => string;
  /** The exact job card the user swiped at this company, if we captured it. */
  swipedCardForCompany: (company: string) => Job | undefined;
  toggleOutreachPin: (id: string) => void;
  toggleContactPin: (id: string) => void;
  markOutreachSent: (id: string) => void;
  markNotificationsRead: () => void;
  updateProfile: (patch: Partial<Profile>) => void;
  /**
   * First-run onboarding gate. `null` while the per-user flag is still loading
   * from disk (the auth gate waits on this before routing); `false` → show the
   * flow; `true` → completed. completeOnboarding() persists done; resetOnboarding()
   * replays it (dev).
   */
  onboardingDone: boolean | null;
  /** True only for a confirmed brand-new user — the auth gate force-shows
   *  onboarding when set. Never true for an established profile. */
  needsOnboarding: boolean;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  /** Backfills the local done-flag for an account the gate is ALREADY
   *  treating as established (real profile, not on an onboarding screen),
   *  without arming the first-run tour the way completeOnboarding() does.
   *  Called by the auth gate only, never from onboarding's own screens. */
  confirmOnboardingDone: () => void;
  /** Save LinkedIn URL + run enrichment, then refetch the now-populated profile. */
  enrichLinkedin: (url: string) => Promise<EnrichResult>;
  addLoop: (brief: string, people?: LoopPeople, autoSend?: boolean) => void;
  toggleLoop: (id: string) => void;
  addMeetingPrep: (input: { name: string; linkedinUrl: string }) => Promise<string>;
  showToast: (message: string, showInboxAction?: boolean) => void;
};

const AppContext = createContext<AppStore | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>(MOCK_JOBS);
  const [deckSeeded, setDeckSeeded] = useState(false);
  // Fixtures ONLY in mock mode: a fresh real account (the Apple reviewer)
  // must never see fake replies, badge counts, or "Taylor Test" activity
  // (no-fake-numbers rule; launch sweep blocker #1).
  const [outreach, setOutreach] = useState<OutreachItem[]>(USE_MOCKS ? MOCK_OUTREACH_SEED : []);
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    USE_MOCKS ? MOCK_NOTIFICATIONS_SEED : [],
  );
  // Profile + credits are now server-backed: GET /api/mobile/me via React Query.
  // Falls back to the fixture until the first fetch resolves (or offline mocks).
  const { status: authStatus, user } = useAuth();
  const uid = user?.uid;
  // Tour flags are per account (see lib/tourFlag); tell it who is signed in.
  setTourUser(uid);
  const queryClient = useQueryClient();

  // Swipe settings live UP HERE, above the feed query, because they now carry
  // the job feed's filter prompt (swipeSettings.jobFilter) and the feed query
  // keys off it. Reading a value declared further down the component would be a
  // TDZ crash on the first render, not a subtle bug.
  const [swipeSettings, setSwipeSettings] = useState<SwipeSettings>(DEFAULT_SWIPE_SETTINGS);
  const [swipeSettingsLoaded, setSwipeSettingsLoaded] = useState(false);
  // Load the saved settings on sign-in; persist on every change after that.
  useEffect(() => {
    if (!uid) {
      setSwipeSettings(DEFAULT_SWIPE_SETTINGS);
      setSwipeSettingsLoaded(true);
      return;
    }
    setSwipeSettingsLoaded(false);
    let cancelled = false;
    AsyncStorage.getItem(swipeSettingsStorageKey(uid))
      .then((raw) => {
        if (cancelled) return;
        let next = DEFAULT_SWIPE_SETTINGS;
        try {
          const parsed = raw ? JSON.parse(raw) : null;
          if (parsed && typeof parsed === 'object') {
            next = {
              ...DEFAULT_SWIPE_SETTINGS,
              ...(parsed as Partial<SwipeSettings>),
              // The ACTIVE filters never come back from disk (Nick 2026-08-17:
              // "every time you reload the app it goes to the normal feed").
              // A filter is a thing you asked for just now, not a mode you get
              // trapped in: opening the app tomorrow to a deck still narrowed
              // by last night's sentence, with no memory of setting it, reads
              // as a broken feed. The RECENTS survive, so getting back to it is
              // one tap. Forced null here as well as stripped on write, so a
              // filter persisted by an older build is dropped on first load
              // rather than lingering until the next settings change.
              jobFilter: null,
              peopleFilter: null,
            };
          }
        } catch {
          /* corrupt blob: fall back to defaults */
        }
        setSwipeSettings(next);
        setSwipeSettingsLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setSwipeSettings(DEFAULT_SWIPE_SETTINGS);
          setSwipeSettingsLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);
  useEffect(() => {
    if (!uid || !swipeSettingsLoaded) return;
    // Everything EXCEPT the two active filters, which are session-scoped. The
    // recents lists are in here, so the sentence itself is never lost.
    const { jobFilter: _jf, peopleFilter: _pf, ...persistable } = swipeSettings;
    const j = safeStringify(persistable);
    if (j) AsyncStorage.setItem(swipeSettingsStorageKey(uid), j).catch(() => {});
  }, [uid, swipeSettings, swipeSettingsLoaded]);

  /** The active jobs filter, or null for the ranked default deck. */
  const jobFilter = swipeSettings.jobFilter?.trim() || null;
  const meQuery = useQuery({
    queryKey: qk.me,
    queryFn: fetchMe,
    enabled: authStatus === 'signedIn',
    // Self-heal: without an interval, one failed fetch (LTE blip, backend
    // deploy) left isError sticky forever and the red banner never cleared
    // until a manual Retry. Matches the inbox/notifications cadence.
    refetchInterval: 60_000,
  });
  const profile: Profile = meQuery.data ?? MOCK_PROFILE;

  /** Optimistically patch the cached profile (used by mutations until each gets a real PATCH). */
  const patchProfile = useCallback(
    (patch: Partial<Profile>) => {
      queryClient.setQueryData<Profile>(qk.me, (prev) => ({ ...(prev ?? MOCK_PROFILE), ...patch }));
    },
    [queryClient],
  );

  // Job feed: the ranked deck from GET /api/jobs/feed. Seed the local deck once
  // so passes/undos keep mutating it client-side as before; allJobs (used by
  // the company "other roles" view) tracks the full fetched list.
  // Passed jobs, kept as timestamped entries so we can expire them (TTL above).
  // passedJobs (the exposed list) is just the jobs, derived from the entries.
  // Declared before the feed seed so the seed can filter passed ids out.
  const [passedEntries, setPassedEntries] = useState<{ job: Job; ts: number }[]>([]);
  const [passedLoaded, setPassedLoaded] = useState(false);
  const passedJobs = useMemo(() => passedEntries.map((e) => e.job), [passedEntries]);
  const passedIds = useMemo(() => new Set(passedEntries.map((e) => e.job.id)), [passedEntries]);
  // Load the cached passes on sign-in, dropping anything past the TTL.
  useEffect(() => {
    if (!uid) {
      // No user (mock/dev/signed-out): nothing to load, but mark loaded so the
      // feed seed (gated on this) still runs.
      setPassedEntries([]);
      setPassedLoaded(true);
      return;
    }
    setPassedLoaded(false);
    let cancelled = false;
    AsyncStorage.getItem(passedJobsStorageKey(uid))
      .then((raw) => {
        if (cancelled) return;
        const cutoff = Date.now() - PASSED_JOBS_TTL_MS;
        let entries: { job: Job; ts: number }[] = [];
        try {
          const parsed = raw ? JSON.parse(raw) : [];
          if (Array.isArray(parsed)) {
            entries = parsed.filter((e) => e && e.job && typeof e.ts === 'number' && e.ts >= cutoff);
          }
        } catch {
          /* ignore a corrupt blob */
        }
        setPassedEntries(entries);
        setPassedLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setPassedEntries([]);
          setPassedLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);
  // Persist on every change (after the initial load), keyed per-user.
  useEffect(() => {
    if (!uid || !passedLoaded) return;
    { const j = safeStringify(passedEntries); if (j) AsyncStorage.setItem(passedJobsStorageKey(uid), j).catch(() => {}); }
  }, [uid, passedEntries, passedLoaded]);

  // People passed on the People deck, same shape as passed jobs: timestamped
  // entries, per-user key, expired on load. The deck's own undo covers only
  // the last pass this session; this is the bin (Rylan 2026-09-03).
  const [passedPeopleEntries, setPassedPeopleEntries] = useState<{ person: Candidate; ts: number }[]>([]);
  const [passedPeopleLoaded, setPassedPeopleLoaded] = useState(false);
  const passedPeople = useMemo(() => passedPeopleEntries.map((e) => e.person), [passedPeopleEntries]);
  useEffect(() => {
    if (!uid) {
      setPassedPeopleEntries([]);
      setPassedPeopleLoaded(true);
      return;
    }
    setPassedPeopleLoaded(false);
    let cancelled = false;
    AsyncStorage.getItem(passedPeopleStorageKey(uid))
      .then((raw) => {
        if (cancelled) return;
        const cutoff = Date.now() - PASSED_PEOPLE_TTL_MS;
        let entries: { person: Candidate; ts: number }[] = [];
        try {
          const parsed = raw ? JSON.parse(raw) : [];
          if (Array.isArray(parsed)) {
            entries = parsed.filter((e) => e && e.person && typeof e.ts === 'number' && e.ts >= cutoff);
          }
        } catch {
          /* ignore a corrupt blob */
        }
        setPassedPeopleEntries(entries);
        setPassedPeopleLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setPassedPeopleEntries([]);
          setPassedPeopleLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);
  useEffect(() => {
    if (!uid || !passedPeopleLoaded) return;
    { const j = safeStringify(passedPeopleEntries); if (j) AsyncStorage.setItem(passedPeopleStorageKey(uid), j).catch(() => {}); }
  }, [uid, passedPeopleEntries, passedPeopleLoaded]);
  const addPassedPerson = useCallback((person: Candidate) => {
    setPassedPeopleEntries((prev) => [...prev.filter((e) => e.person.id !== person.id), { person, ts: Date.now() }]);
  }, []);
  const restorePassedPerson = useCallback(
    (id: string) => {
      setPassedPeopleEntries((prev) => prev.filter((e) => e.person.id !== id));
      void restorePassedCandidate(id).finally(() =>
        queryClient.invalidateQueries({ queryKey: ['rankerDeck'] }),
      );
    },
    [queryClient],
  );

  // The real job card the user swiped, per company (see key above). Persisted so
  // the company page shows the exact card even after a relaunch.
  const [swipedCards, setSwipedCards] = useState<Record<string, Job>>({});
  const swipedLoadedRef = useRef(false);
  // Latches true the first time /me returns a real profile — see needsOnboarding.
  const everHadServerProfile = useRef(false);
  useEffect(() => {
    swipedLoadedRef.current = false;
    if (!uid) {
      setSwipedCards({});
      swipedLoadedRef.current = true;
      return;
    }
    let cancelled = false;
    AsyncStorage.getItem(swipedCardsStorageKey(uid))
      .then((raw) => {
        if (cancelled) return;
        try {
          const parsed = raw ? JSON.parse(raw) : {};
          const stored = parsed && typeof parsed === 'object' ? parsed : {};
          // Merge, preferring anything captured in-session — otherwise a swipe
          // made before this async load resolves would get clobbered by the
          // (older) on-disk value.
          setSwipedCards((cur) => ({ ...stored, ...cur }));
        } catch {
          /* keep whatever's in memory */
        }
        swipedLoadedRef.current = true;
      })
      .catch(() => {
        if (!cancelled) {
          setSwipedCards({});
          swipedLoadedRef.current = true;
        }
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);
  useEffect(() => {
    if (!uid || !swipedLoadedRef.current) return;
    { const j = safeStringify(swipedCards); if (j) AsyncStorage.setItem(swipedCardsStorageKey(uid), j).catch(() => {}); }
  }, [uid, swipedCards]);
  const recordSwipedCard = useCallback((job: Job) => {
    const k = companyKey(job.company);
    if (!k) return;
    setSwipedCards((prev) => ({ ...prev, [k]: job }));
  }, []);
  const swipedCardForCompany = useCallback(
    (company: string): Job | undefined => swipedCards[companyKey(company)],
    [swipedCards],
  );

  // Saved jobs (swipe up to save for later). Persisted per-user, no TTL.
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const savedLoadedRef = useRef(false);
  useEffect(() => {
    savedLoadedRef.current = false;
    if (!uid) {
      setSavedJobs([]);
      savedLoadedRef.current = true;
      return;
    }
    let cancelled = false;
    AsyncStorage.getItem(savedJobsStorageKey(uid))
      .then((raw) => {
        if (cancelled) return;
        try {
          const parsed = raw ? JSON.parse(raw) : [];
          setSavedJobs(Array.isArray(parsed) ? parsed : []);
        } catch {
          setSavedJobs([]);
        }
        savedLoadedRef.current = true;
      })
      .catch(() => {
        if (!cancelled) {
          setSavedJobs([]);
          savedLoadedRef.current = true;
        }
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);
  useEffect(() => {
    if (!uid || !savedLoadedRef.current) return;
    { const j = safeStringify(savedJobs); if (j) AsyncStorage.setItem(savedJobsStorageKey(uid), j).catch(() => {}); }
  }, [uid, savedJobs]);

  /**
   * The deck's source, and the ONE place that decides it.
   *
   * With no filter this is the ranked feed (/api/jobs/feed), which is personal
   * and scored. With a filter it is a plain search of the job index
   * (/api/jobs/search), which is neither. It is exactly the roles the sentence
   * described, newest first. Keying the query on the filter means changing the
   * prompt refetches instead of showing the old deck under a new label, and
   * going back to the default restores the ranked deck from cache.
   */
  const feedQuery = useQuery<DeckPage>({
    queryKey: jobFilter ? [...qk.feed, 'filter', jobFilter] : qk.feed,
    queryFn: () =>
      jobFilter
        ? fetchFilteredJobsPage(jobFilter)
        : fetchFeedPage(),
    // Wait for the saved settings (one AsyncStorage read) so a user who left a
    // filter on doesn't spend a round trip fetching the default deck first.
    enabled: authStatus === 'signedIn' && swipeSettingsLoaded,
  });
  // Paging state. The feed now serves a page at a time (see FEED_PAGE_SIZE)
  // instead of shipping the entire ~420-card deck on open. `loadedJobs`
  // accumulates every page we've pulled this session — Scout's job-matching
  // reads it, so it must keep growing as the user swipes, not just hold page 0.
  const [loadedJobs, setLoadedJobs] = useState<Job[]>([]);
  // Number for the ranked feed's offset, string for the search route's opaque
  // (posted_at, job_id) token. Whichever source seeded the deck also produced
  // this, so the two can never page into each other.
  const [feedCursor, setFeedCursor] = useState<number | string | null>(null);
  const loadingMoreRef = useRef(false);

  // Changing the filter is a different deck, not more of the same one. Without
  // this the old cards stay on screen (deckSeeded is already true) and the new
  // query's result is silently ignored.
  const seededFilterRef = useRef<string | null>(null);
  useEffect(() => {
    if (seededFilterRef.current === jobFilter) return;
    seededFilterRef.current = jobFilter;
    setLoadedJobs([]);
    setFeedCursor(null);
    setDeckSeeded(false);
  }, [jobFilter]);

  // Never fall back to fixture jobs for REAL flows: Scout job-matching reads
  // allJobs, and a fixture pick could fire a real auto-apply against a fake
  // job id (sweep blocker #10). Mock mode keeps the offline demo alive.
  const allJobs = loadedJobs.length
    ? loadedJobs
    : (feedQuery.data?.jobs ?? (USE_MOCKS ? MOCK_JOBS : []));

  useEffect(() => {
    // Wait for the passed cache so a just-relaunched deck doesn't briefly show
    // jobs the user already swiped away this session.
    if (feedQuery.data && passedLoaded && !deckSeeded) {
      // Lean the freshly-seeded deck toward the user's preferred locations
      // (with wildcards for volume), and drop anything passed within the TTL.
      // Done once at seed so the order doesn't reshuffle mid-swipe.
      const fresh = feedQuery.data.jobs.filter((j) => !passedIds.has(j.id));
      setJobs(rankJobsByLocation(fresh, meQuery.data?.preferredLocations ?? []));
      setLoadedJobs(feedQuery.data.jobs);
      setFeedCursor(feedQuery.data.nextCursor);
      setDeckSeeded(true);
    }
  }, [feedQuery.data, passedLoaded, passedIds, deckSeeded, meQuery.data?.preferredLocations]);

  /** Pull the next page and append it to the deck. */
  const loadMoreJobs = useCallback(async () => {
    if (loadingMoreRef.current || feedCursor == null || USE_MOCKS) return;
    loadingMoreRef.current = true;
    try {
      // Same source as the seed, or the cursor would be handed to a route that
      // cannot read it.
      const page = jobFilter
        ? await fetchFilteredJobsPage(jobFilter, String(feedCursor))
        : await fetchFeedPage({ cursor: Number(feedCursor) });
      setFeedCursor(page.nextCursor);
      if (page.jobs.length) {
        setLoadedJobs((prev) => {
          const seen = new Set(prev.map((j) => j.id));
          return [...prev, ...page.jobs.filter((j) => !seen.has(j.id))];
        });
        setJobs((prev) => {
          const seen = new Set(prev.map((j) => j.id));
          const add = page.jobs.filter((j) => !seen.has(j.id) && !passedIds.has(j.id));
          return [...prev, ...rankJobsByLocation(add, meQuery.data?.preferredLocations ?? [])];
        });
      }
    } catch {
      /* transient — we'll try again on the next swipe that drops us under the mark */
    } finally {
      loadingMoreRef.current = false;
    }
  }, [feedCursor, passedIds, meQuery.data?.preferredLocations, jobFilter]);

  // Prefetch the next page BEFORE the deck runs out, so paging is invisible: the
  // user should never watch a spinner mid-swipe. 15 cards of runway at a page
  // size of 60 is plenty of time for the request to land.
  useEffect(() => {
    if (!deckSeeded || feedCursor == null) return;
    if (jobs.length <= 15) void loadMoreJobs();
  }, [jobs.length, deckSeeded, feedCursor, loadMoreJobs]);

  // First-run onboarding flag, loaded per-user from disk. `null` until resolved
  // so the auth gate doesn't flash the feed before deciding. FORCE_ONBOARDING
  // (dev) skips the read and always starts the flow.
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  useEffect(() => {
    if (!uid) {
      setOnboardingDone(null);
      return;
    }
    if (FORCE_ONBOARDING) {
      setOnboardingDone(false);
      return;
    }
    let cancelled = false;
    AsyncStorage.getItem(onboardingStorageKey(uid))
      .then((v) => {
        if (!cancelled) setOnboardingDone(v === '1');
      })
      .catch(() => {
        if (!cancelled) setOnboardingDone(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const completeOnboarding = useCallback(() => {
    setOnboardingDone(true);
    if (uid) AsyncStorage.setItem(onboardingStorageKey(uid), '1').catch(() => {});
    // Arm the first-run tour. Only here, so an established user updating the
    // app never gets a tour appearing out of nowhere; the Scout tab reads this
    // on mount and offers the walkthrough.
    void markTourPending();
    // The one explicit server-side "onboarding actually finished" fact
    // (Rylan 2026-09-11). Fire-and-forget: a failed write here just means
    // this account keeps relying on the hasServerProfile heuristic a
    // little longer, never a new bug — see confirmOnboardingDone below.
    void markOnboardingComplete().catch(() => {});
  }, [uid]);

  const resetOnboarding = useCallback(() => {
    setOnboardingDone(false);
    if (uid) AsyncStorage.removeItem(onboardingStorageKey(uid)).catch(() => {});
  }, [uid]);

  // Backfills the local flag for an account the gate is ALREADY treating as
  // established, so the NEXT cold launch never has to re-win the /me race
  // (Rylan 2026-09-11: "a user who has created an account gets plopped back
  // into onboarding when they sign back in" — a fresh device, a reinstall,
  // or any AsyncStorage loss leaves this unset forever, since nothing else
  // ever writes it for an account that onboarded somewhere other than THIS
  // app flow, e.g. the website).
  //
  // Deliberately NOT completeOnboarding(): that also arms the first-run
  // tour, which must never appear out of nowhere for an existing user. The
  // auth gate is the only caller, and only once it has already decided
  // NOT to force onboarding for this render (see _layout.tsx) — never from
  // a screen inside onboarding itself, so a user who has only done the
  // first intake step (which alone can make hasServerProfile true) is
  // never marked done before they actually finish.
  const confirmOnboardingDone = useCallback(() => {
    setOnboardingDone(true);
    if (uid) AsyncStorage.setItem(onboardingStorageKey(uid), '1').catch(() => {});
  }, [uid]);

  // Should the auth gate force this user into onboarding? Only a genuinely-new
  // user: hasn't completed it AND the real /me has no profile data yet. Gated on
  // meQuery.isSuccess so we never force-redirect on the mock fallback (which
  // would trap established users). FORCE_ONBOARDING (dev) overrides for testing.
  // Onboarding-done flag is authoritative: forcing onboarding when the SERVER
  // looks empty raced the finish() navigation (the /me query is stale right
  // after onboarding, so the gate yanked the user back to /(onboarding) mid
  // transition to /(tabs) — two competing navigations crashed
  // react-native-screens). A fresh install always has the flag unset, so a
  // brand-new user (and the reviewer) still onboards; re-testing on the same
  // install clears the flag via reinstall.
  // Latch: once we've seen a real server profile this session, NEVER let a
  // transient empty /me refetch flip needsOnboarding back on. That flicker was
  // bouncing already-onboarded users (esp. web-onboarded ones whose local
  // onboardingDone flag is unset) into onboarding "every so often" — a broken
  // look and an App Store review risk. A genuine new user has never seen a
  // profile, so this doesn't block real onboarding.
  if (profile.hasServerProfile) everHadServerProfile.current = true;
  const needsOnboarding =
    onboardingDone === false &&
    !everHadServerProfile.current &&
    (FORCE_ONBOARDING || (meQuery.isSuccess && !profile.hasServerProfile));

  // PostHog identity: point analytics at the signed-in user (Firebase uid =
  // the web's distinct_id), and set person properties once /me resolves so the
  // CMO can segment by school/plan. Best-effort; no-op until a key is configured.
  useEffect(() => {
    setAnalyticsUser(uid ?? null);
    if (uid) {
      const method = takePendingSignInMethod();
      if (method) track('signed_in', { method });
    }
    if (uid && meQuery.isSuccess) {
      identify(uid, { school: profile.school, plan: profile.plan, grad_year: profile.gradYear });
    }
  }, [uid, meQuery.isSuccess, profile.school, profile.plan, profile.gradYear]);

  // On launch, restore the persisted queries from disk so the deck/inbox/loops/
  // profile show the previous data instantly while live queries refetch. Skip
  // any query the live fetch already populated (don't clobber a fresh result).
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void Promise.all(
      PERSISTED_QUERIES.map(async ({ name, key }) => {
        if (queryClient.getQueryData(key)) return;
        const raw = await AsyncStorage.getItem(cacheStorageKey(uid, name)).catch(() => null);
        if (cancelled || !raw) return;
        try {
          const data = JSON.parse(raw);
          if (data != null && !queryClient.getQueryData(key)) {
            queryClient.setQueryData(key, data);
          }
        } catch {
          /* ignore a corrupt/stale blob */
        }
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [uid, queryClient]);

  // Persist those queries to disk whenever their cache updates, keyed per-user.
  useEffect(() => {
    if (!uid) return;
    const nameByKey = new Map(PERSISTED_QUERIES.map((q) => [JSON.stringify(q.key), q.name]));
    return queryClient.getQueryCache().subscribe((event) => {
      const q = event?.query;
      if (!q) return;
      const name = nameByKey.get(JSON.stringify(q.queryKey));
      if (!name) return;
      const data = q.state.data;
      if (data != null) {
        const j = safeStringify(data);
        if (j) AsyncStorage.setItem(cacheStorageKey(uid, name), j).catch(() => {});
      }
    });
  }, [uid, queryClient]);

  // Inbox: real threads from GET /api/outbox/threads, polled for replies. We
  // sync to the server list but keep any in-flight "drafting" placeholders on
  // top (a swipe that hasn't reconciled / been saved server-side yet).
  const inboxQuery = useQuery({
    queryKey: qk.inbox,
    queryFn: fetchInbox,
    enabled: authStatus === 'signedIn',
    refetchInterval: 60_000,
  });
  useEffect(() => {
    const server = inboxQuery.data;
    if (!server) return;
    // Match optimistic items to the server by contact+company (the optimistic id
    // is a placeholder; the server assigns a real Firestore id). Keep an
    // optimistic item until the server actually has it; when it does, record the
    // id swap so an open detail screen can follow it, and let the server copy win.
    // Company names arrive spelled differently per source ("Janestreet" from
    // the job card vs "jane street" from the saved contact; the app says
    // "Moelis" while PDL returns the legal "Moelis & Company" — field-tested
    // 2026-07-09: both rows rendered and the ghost had no LinkedIn/prep).
    // Shared normalizer in lib/company.ts; the company screen filters with it too.
    const normName = (o: OutreachItem) => (o.contact?.name || o.personName || '').toLowerCase().trim();
    const keyOf = (o: OutreachItem) => `${normName(o)}|${normCompanyName(o.company || '')}`;
    setOutreach((prev) => {
      const serverByKey = new Map(server.map((s) => [keyOf(s), s] as const));
      const keptOptimistic: OutreachItem[] = [];
      for (const o of prev) {
        if (!o.id.startsWith('out-new-')) continue; // stale server rows are replaced by the fresh list
        let match = serverByKey.get(keyOf(o));
        if (!match) {
          // Fallback: same person, prefix-related company names ("Meta" vs
          // "Meta Platforms") — merging errs toward no-duplicates.
          const oName = normName(o);
          match = server.find((s) => normName(s) === oName && sameCompany(s.company || '', o.company || ''));
        }
        // If the SERVER has this person, the server row wins — full stop.
        //
        // This used to also require the optimistic item not be 'drafting'/'queued',
        // which conflated two opposite cases the `else` comment ran together:
        // "still drafting" and "the server doesn't have it yet". When the server
        // DOES have them but our local copy still said drafting (the poll hadn't
        // landed, or the app was backgrounded mid-swipe), we kept the ghost AND
        // rendered the server row — the same person twice in the Inbox. That's
        // the duplicate Rylan saw on a batch: one row showing the email body, one
        // showing the subject, "Palantir" vs "Palantir Technologies".
        //
        // The backend writes the contact row only after the draft exists, so a
        // match means the draft is genuinely done and the local 'drafting' status
        // is just stale. Keep the optimistic ONLY while the server has never
        // heard of them.
        if (match) {
          reconciledIds.current[o.id] = match.id; // remember the swap; drop the optimistic
        } else {
          keptOptimistic.push(o); // the server doesn't have it yet — keep showing progress
        }
      }
      return [...keptOptimistic, ...server];
    });
  }, [inboxQuery.data]);

  // Header-bell feed from GET /api/mobile/notifications (the reply-webhook +
  // loop-cycle outbox doc, the same source push notifications fire from).
  // Polled so a reply/loop push surfaces in the list + bell badge.
  const notificationsQuery = useQuery({
    queryKey: qk.notifications,
    queryFn: fetchNotifications,
    enabled: authStatus === 'signedIn',
    refetchInterval: 60_000,
  });
  useEffect(() => {
    if (notificationsQuery.data) setNotifications(notificationsQuery.data);
  }, [notificationsQuery.data]);

  // Connection status for the UI. `profile` above is `meQuery.data ?? MOCK_PROFILE`,
  // so a failed or still-pending /api/mobile/me silently shows the fixture. This
  // derives an explicit state the ConnectionBanner can render, and a retry that
  // refetches the server-backed queries.
  const connection = useMemo<AppStore['connection']>(() => {
    const signedIn = authStatus === 'signedIn';
    const usingSampleData = signedIn && meQuery.data === undefined;
    let status: 'ok' | 'loading' | 'error' | 'reconnecting' = 'ok';
    if (signedIn) {
      // 'error' (red, "sample data") only when we truly have nothing real to
      // show. A failed refetch with real data still cached is 'reconnecting'.
      if (meQuery.isError) status = meQuery.data === undefined ? 'error' : 'reconnecting';
      else if (meQuery.data === undefined) status = 'loading';
    }
    return {
      status,
      usingSampleData,
      retry: () => {
        queryClient.invalidateQueries({ queryKey: qk.me });
        queryClient.invalidateQueries({ queryKey: qk.feed });
        queryClient.invalidateQueries({ queryKey: qk.inbox });
      },
    };
  }, [authStatus, meQuery.isError, meQuery.data, queryClient]);

  // Cold-start honesty: while signed in with NO profile yet (cache restore is
  // ~50ms for returning users; first-ever session waits on the first /me), the
  // shell keeps its launch spinner up instead of flashing MOCK_PROFILE as if
  // it were real. An /me ERROR releases the gate — the red "sample data"
  // banner is the honest state for that, and a spinner would never resolve.
  const bootPending =
    authStatus === 'signedIn' && meQuery.data === undefined && !meQuery.isError;

  // Per-screen load state. `loading` is the first fetch only (isLoading is false
  // while disabled pre-auth); `error` is a failed fetch with no data to show.
  const signedIn = authStatus === 'signedIn';
  const feedState = useMemo<AppStore['feedState']>(
    () => ({
      loading: signedIn && feedQuery.isLoading,
      error: signedIn && feedQuery.isError && feedQuery.data === undefined,
      retry: () => queryClient.invalidateQueries({ queryKey: qk.feed }),
    }),
    [signedIn, feedQuery.isLoading, feedQuery.isError, feedQuery.data, queryClient],
  );
  const inboxState = useMemo<AppStore['inboxState']>(
    () => ({
      loading: signedIn && inboxQuery.isLoading,
      error: signedIn && inboxQuery.isError && inboxQuery.data === undefined,
      retry: () => queryClient.invalidateQueries({ queryKey: qk.inbox }),
    }),
    [signedIn, inboxQuery.isLoading, inboxQuery.isError, inboxQuery.data, queryClient],
  );
  const refetchInbox = useCallback(() => inboxQuery.refetch(), [inboxQuery]);

  // Foreground sweep: a draft request fired before the app was backgrounded may
  // have died with it (iOS suspends JS, so its .then/.catch never ran). On
  // return to foreground, refetch the inbox (a draft that actually completed
  // server-side reconciles to a real row) and fail anything still
  // queued/drafting after 5 minutes so it offers tap-to-retry instead of
  // spinning forever.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      refetchInbox();
      const now = Date.now();
      setOutreach((prev) =>
        prev.map((o) =>
          (o.status === 'drafting' || o.status === 'queued') &&
          typeof o.createdAtMs === 'number' &&
          // People-deck hunts legitimately run up to ~6 minutes in the
          // background fulfiller; job drafts that quiet are dead.
          o.createdAtMs < now - (o.source === 'people' ? 8 : 5) * 60_000
            ? { ...o, status: 'failed', snippet: 'Could not draft, tap to retry' }
            : o,
        ),
      );
    });
    return () => sub.remove();
  }, [refetchInbox]);

  const [loops, setLoops] = useState<Loop[]>(MOCK_PROFILE.loops);
  // Loops fleet from GET /api/agent/loops; re-sync the local list to the server
  // on each fetch (optimistic add/toggle below patch it in the meantime).
  const loopsQuery = useQuery({
    queryKey: qk.loops,
    queryFn: fetchLoops,
    enabled: authStatus === 'signedIn',
    // Loops run server-side on their own schedule — without a poll the screen
    // showed stale counters until a force-quit. Same cadence as me/inbox;
    // pushes (loop cycle done → draft_ready) also invalidate this for the
    // instant version.
    refetchInterval: 60_000,
  });
  useEffect(() => {
    if (loopsQuery.data) setLoops(loopsQuery.data);
  }, [loopsQuery.data]);
  const loopsReady = loopsQuery.isFetched;
  const [meetingPreps, setMeetingPreps] = useState<MeetingPrep[]>(USE_MOCKS ? MOCK_MEETING_PREPS : []);
  // Coffee library from GET /api/coffee-chat-prep/all; re-sync to the server.
  const meetingPrepsQuery = useQuery({
    queryKey: qk.meetingPreps,
    queryFn: fetchMeetingPreps,
    enabled: authStatus === 'signedIn',
    // Poll while any prep is still building. This list was invalidated exactly
    // once — when a prep was CREATED — and never again. So the card said
    // "processing", the prep finished on the server two minutes later, and the
    // list never heard about it: it sat stale until the app was killed. A prep is
    // an async job; the list that shows it has to actually watch it.
    refetchInterval: (query) => {
      const building = (query.state.data ?? []).some((p) => p.status === 'processing');
      return building ? 5000 : false;
    },
  });
  useEffect(() => {
    if (meetingPrepsQuery.data) setMeetingPreps(meetingPrepsQuery.data);
  }, [meetingPrepsQuery.data]);
  // Derived from the real outreach list (no separate fetch): same contacts as
  // the Inbox, shaped for the Network Contacts list.
  const trackerRows = useMemo(() => outreachToTrackerRows(outreach), [outreach]);

  // Credits are the ONLY meter (2026-07-14). The old model ran a swipe-stamina
  // batch with a multi-hour cooldown ALONGSIDE credits, and the two contradicted
  // each other: Free's stamina offered 5 swipes every 5h (up to ~24/day) while
  // Free's 300 credits fund ~30 drafts a MONTH — about one a day. So the bar
  // dangled a rhythm the wallet could never pay for, and locked users out
  // mid-session anyway. It was also client-only state: force-quitting the app
  // handed you a fresh batch, so it protected nothing. One honest number instead.
  // Off at launch (mock), so the prompt shows like a fresh login. Real push
  // permission wires in Phase 3.
  const [notificationsEnabled, setNotificationsEnabledState] = useState(false);
  const [notifPromptDismissed, setNotifPromptDismissed] = useState(false);
  /** Has the async OS permission read come back yet? Until it has, we know
   *  nothing and must not render the prompt (see the effect below). */
  const [notifPermissionResolved, setNotifPermissionResolved] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const idCounter = useRef(0);
  const contactCounter = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Maps an optimistic swipe id (out-new-N) to the real server contact id once
  // the inbox poll surfaces it, so a detail screen opened on the optimistic id
  // can follow the swap instead of showing "no longer exists".
  const reconciledIds = useRef<Record<string, string>>({});

  const lastToastAt = useRef(0);
  const showToast = useCallback((message: string, showInboxAction = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    // Rapid-fire toasts (fast swiping fires one per reveal) get a short
    // life: when another toast showed in the last 4s the reader is mid-
    // rhythm and each one only needs a glance (Rylan 2026-08-27: "when
    // you're swiping pretty fast, it's just kinda a lot"). A lone toast
    // keeps the full read time.
    const now = Date.now();
    const rapid = now - lastToastAt.current < 4000;
    lastToastAt.current = now;
    setToast({ message, showInboxAction });
    toastTimer.current = setTimeout(() => setToast(null), rapid ? 1600 : 3200);
  }, []);

  // Give a swipe-token back when a swipe finds no contact (nothing was actually
  // reached, so it shouldn't cost stamina or trip the cooldown).
  // A swipe that finds nobody costs nothing: the server refunds the credits and
  // /me reconciles them, so there is no token to hand back any more.
  const refundSwipe = useCallback(() => {}, []);

  // The one honest number. A swipe costs creditsPerSwipe per person it reaches,
  // so what a user really has is "how many drafts can I still afford".
  const costPerSwipe = profile.creditsPerSwipe * swipeSettings.contacts;
  const draftsLeft = Math.max(0, Math.floor(profile.credits / Math.max(1, costPerSwipe)));


  const passJob = useCallback((id: string) => {
    setJobs((prev) => {
      const job = prev.find((j) => j.id === id);
      if (job) setPassedEntries((p) => [...p, { job, ts: Date.now() }]);
      return prev.filter((j) => j.id !== id);
    });
    // Tell the server. Without this the pass was local-only: the backend kept
    // re-serving jobs the user had already rejected and the deck could only
    // shrink, never refill — you could swipe left on everything and hit a wall
    // with thousands of unseen jobs still in the catalog. Recording it lets the
    // next rerank drop this job and pull an unseen one into its place.
    // Fire-and-forget; a swipe must never wait on the network.
    void sendJobFeedback(id, 'negative');
  }, []);

  const undoLastPass = useCallback(() => {
    setPassedEntries((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setJobs((js) => [last.job, ...js]);
      return prev.slice(0, -1);
    });
  }, []);

  // Swipe up to save a job for later; it leaves the deck and lands in Saved.
  const saveJob = useCallback((id: string) => {
    setJobs((prev) => {
      const job = prev.find((j) => j.id === id);
      if (job) setSavedJobs((s) => (s.some((j) => j.id === id) ? s : [job, ...s]));
      return prev.filter((j) => j.id !== id);
    });
  }, []);
  const unsaveJob = useCallback((id: string) => {
    setSavedJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);
  // Put a saved job back at the top of the deck (to review / apply / reach out).
  const restoreSavedJob = useCallback((id: string) => {
    setSavedJobs((prev) => {
      const job = prev.find((j) => j.id === id);
      if (job) setJobs((js) => [job, ...js.filter((j) => j.id !== id)]);
      return prev.filter((j) => j.id !== id);
    });
  }, []);

  const restorePassedJob = useCallback((id: string) => {
    setPassedEntries((prev) => {
      const entry = prev.find((e) => e.job.id === id);
      if (entry) setJobs((js) => [entry.job, ...js]);
      return prev.filter((e) => e.job.id !== id);
    });
  }, []);

  const resetDeck = useCallback(() => {
    setPassedEntries([]);
    // Everything pulled this session, not just page 0 — otherwise "restart deck"
    // would silently throw away every page the user had paged in.
    setJobs(loadedJobs.length ? loadedJobs : (feedQuery.data?.jobs ?? MOCK_JOBS));
  }, [loadedJobs, feedQuery.data]);

  // "Show me new roles." Pulls a fresh, deeper slice of the ranked pool
  // (?refresh=true rotates the server-side offset), so the deck refills with
  // jobs the user hasn't seen — including adjacent-field/other-city roles that
  // sit below the default 300-job window. Keeps personalization as the lane
  // while giving an explicit way to reach range. The cache is updated too so
  // Scout's job-matching (reads allJobs) stays in sync with what's on screen.
  const [rerolling, setRerolling] = useState(false);
  const rerollFeed = useCallback(async () => {
    if (rerolling || USE_MOCKS) return;
    setRerolling(true);
    try {
      // A filtered deck has no deeper slice to rotate into: it is already the
      // whole set of roles matching that sentence, so "show me new roles" means
      // run the search again from the top (new postings land there) rather than
      // silently dropping the filter and serving the general feed.
      const page = jobFilter
        ? await fetchFilteredJobsPage(jobFilter)
        : await fetchFeedPage({ refresh: true });
      if (page.jobs.length === 0) {
        showToast(
          jobFilter
            ? 'No new roles matching your filter yet'
            : 'No new roles right now, check back soon',
        );
        return;
      }
      // A reroll rotates the server-side offset to a different slice, so the old
      // cursor points into the previous slice — reset paging to page 0 of the new
      // one, or loadMoreJobs would append cards from the slice we just left.
      queryClient.setQueryData(jobFilter ? [...qk.feed, 'filter', jobFilter] : qk.feed, page);
      setLoadedJobs(page.jobs);
      setFeedCursor(page.nextCursor);
      setPassedEntries([]);
      setJobs(rankJobsByLocation(page.jobs, meQuery.data?.preferredLocations ?? []));
    } catch {
      showToast('Could not load new roles, try again');
    } finally {
      setRerolling(false);
    }
  }, [rerolling, queryClient, meQuery.data?.preferredLocations, showToast, jobFilter]);

  const updateOutreach = useCallback(
    (id: string, patch: Partial<OutreachItem>) => {
      setOutreach((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    [],
  );

  const resolveOutreachId = useCallback((id: string) => reconciledIds.current[id] ?? id, []);

  const toggleOutreachPin = useCallback((id: string) => {
    setOutreach((prev) =>
      prev.map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item)),
    );
  }, []);

  // A Network contact row IS an outreach item (same id), so pinning one pins
  // the underlying conversation — one source of truth, shared with the Inbox.
  const toggleContactPin = useCallback((id: string) => {
    setOutreach((prev) =>
      prev.map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item)),
    );
  }, []);

  // Original swipe args for failed placeholders, so tap-to-retry re-runs the
  // same targeting — including the swipeId, so the server can replay the
  // recorded outcome instead of double-drafting. Session-local (placeholder
  // rows don't survive restarts).
  const failedDraftArgs = useRef<
    Map<
      string,
      {
        company: string;
        jobTitle: string;
        action: 'draft' | 'send';
        priority: SwipeSettings['priority'];
        swipeId?: string;
      }
    >
  >(new Map());

  // Per-gesture idempotency key (safe charset for a Firestore doc id).
  const newSwipeId = () =>
    `swipe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  /**
   * Run one draft request for existing placeholder rows and reconcile them with
   * the result. Shared by the initial swipe and tap-to-retry. Requests go
   * through the module-level queue (one in flight; queued rows flip to
   * 'drafting' when their turn starts).
   */
  const executeDraft = useCallback(
    (
      placeholderIds: string[],
      args: {
        company: string;
        jobTitle: string;
        count: number;
        action: 'draft' | 'send';
        priority: SwipeSettings['priority'];
        swipeId?: string;
      },
      opts: { isRetry?: boolean } = {},
    ) => {
      // Live stage updates from the server draft job → paint the placeholders
      // with what's ACTUALLY happening, including the found person's name the
      // moment the search lands ("Found Sarah Kim — researching…").
      const onProgress = (p: DraftJobProgress) => {
        setOutreach((prev) =>
          prev.map((o) => {
            const k = placeholderIds.indexOf(o.id);
            if (k === -1 || (o.status !== 'drafting' && o.status !== 'queued')) return o;
            const found = p.foundContacts?.[k];
            return {
              ...o,
              status: 'drafting',
              stageLabel: p.stageLabel || o.stageLabel,
              contact: found?.name
                ? {
                    name: found.name,
                    title: found.title,
                    company: found.company || o.company,
                    relation: o.contact?.relation ?? 'Employee',
                  }
                : o.contact,
            };
          }),
        );
      };

      // Employee swipes run as SERVER-side jobs: submit immediately (the
      // server bounds concurrency and queues fairly — that's where "swipe 12
      // and pocket the phone" lives). The client-side queue only remains for
      // the hiring-manager path, which is still a synchronous request.
      const jobBased = args.priority === 'employee';
      const requestPromise = jobBased
        ? runSwipe(args, onProgress)
        : enqueueDraft(
            () => runSwipe(args),
            () => {
              setOutreach((prev) =>
                prev.map((o) =>
                  placeholderIds.includes(o.id) && o.status === 'queued'
                    ? { ...o, status: 'drafting' }
                    : o,
                ),
              );
            },
          );

      requestPromise
        .then(({ items, creditsRemaining }) => {
          placeholderIds.forEach((pid) => failedDraftArgs.current.delete(pid));
          const foundCount = items.length;
          // Activation event — the core action. Lets the CMO measure swipe→draft
          // and segment activation by referral_source / target_track.
          if (foundCount > 0) {
            track('outreach_drafted', { company: args.company, count: foundCount, action: args.action });
            // Flash the Inbox tab badge green ("one finished") for a beat.
            setDraftJustCompleted(true);
            setTimeout(() => setDraftJustCompleted(false), 2500);
          }
          setOutreach((prev) => {
            // Fill placeholders that got a real contact; DROP the rest. A swipe
            // that found no contact shouldn't leave a "No contact found" row in
            // the Inbox — nothing was reached.
            const next = [...prev];
            placeholderIds.forEach((pid, k) => {
              const idx = next.findIndex((o) => o.id === pid);
              if (idx === -1) return;
              const item = items[k];
              if (item) next[idx] = { ...item, id: pid };
              else next.splice(idx, 1);
            });
            return next;
          });
          // No per-swipe "draft ready" bell item: the user is in-app watching
          // the Inbox fill, so a notification per contact is just noise. The
          // bell is reserved for things that happen while they're away (replies,
          // Loop runs), which the backend writes on its own.
          if (foundCount === 0) {
            // No one found — give the swipe-token back and reconcile credits
            // from the server (which charges per contact, so a miss costs 0).
            // A retry never spent a fresh token, so nothing to refund there.
            if (!opts.isRetry) refundSwipe();
            showToast(`No contact found at ${args.company} — no credits used`);
          } else if (foundCount < args.count) {
            // Partial reach: the placeholder rows for the people we couldn't
            // find get dropped above, so say what actually landed instead of
            // letting the Inbox silently show fewer drafts than were promised.
            // Credits are charged per contact found, so the misses cost nothing.
            showToast(
              `Found ${foundCount} of ${args.count} at ${args.company}, only charged for ${
                foundCount === 1 ? 'that one' : 'those'
              }`,
            );
          } else {
            // Full success used to complete silently. This is the real payoff
            // beat (Rylan 2026-08-11): a human came back, so the person leads.
            // Onboarding teaches the mechanic; this moment proves it.
            const firstName = items.find(Boolean)?.contact?.name;
            showToast(
              foundCount === 1 && firstName
                ? `Meet ${firstName}, your intro is ready in your Inbox`
                : `${foundCount} intros ready in your Inbox`,
              true,
            );
          }
          if (typeof creditsRemaining === 'number') {
            patchProfile({ credits: creditsRemaining });
          } else {
            queryClient.invalidateQueries({ queryKey: qk.me });
          }
        })
        .catch((err) => {
          if (isInsufficientCredits(err)) {
            setOutreach((prev) => prev.filter((o) => !placeholderIds.includes(o.id)));
            // The limit hit is the highest-converting purchase moment (spec
            // section 3): open the native IAP sheet instead of a dead-end
            // toast. Builds without IAP keep the old neutral toast.
            if (iapAvailable()) presentPaywall({ context: 'draft' });
            else showToast('Not enough credits for that swipe');
          } else {
            // Remember the args (incl. swipeId) so a retry re-runs the same
            // gesture — the server replays a completed outcome instead of
            // double-drafting.
            placeholderIds.forEach((pid) =>
              failedDraftArgs.current.set(pid, {
                company: args.company,
                jobTitle: args.jobTitle,
                action: args.action,
                priority: args.priority,
                swipeId: args.swipeId,
              }),
            );
            // 409 = the server says this exact swipe is STILL being drafted
            // (e.g. we timed out but the pipeline lives on). Not a failure:
            // keep the row in 'drafting' — the inbox poll picks up the result
            // when it lands, and if it truly died the 5-minute sweep converts
            // the row to tap-to-retry, whose replay returns the stored outcome.
            const stillInFlight = (err as { status?: number })?.status === 409;
            setOutreach((prev) =>
              prev.map((o) =>
                placeholderIds.includes(o.id)
                  ? stillInFlight
                    ? { ...o, status: 'drafting' }
                    : { ...o, status: 'failed', snippet: 'Could not draft, tap to retry' }
                  : o,
              ),
            );
          }
          queryClient.invalidateQueries({ queryKey: qk.me });
        });
    },
    [queryClient, patchProfile, showToast, refundSwipe],
  );

  /**
   * The hero. Optimistically spend a swipe + drop "drafting" placeholders in
   * the Inbox (one per contact), then call the real swipe (find + draft + save
   * via /api/prompt-search) and reconcile each placeholder with the returned
   * contact + draft. The first contact in a multi-reach is the hiring manager
   * ("apply, then warm the team"); the rest are employees. On insufficient
   * credits we roll the placeholders back and point to the web; other failures
   * mark the placeholder failed so the user can retry.
   */
  const beginDraft = useCallback(
    (
      company: string,
      jobTitle: string,
      opts: {
        count?: number;
        action?: SwipeSettings['action'];
        autoApply?: boolean;
        priority?: SwipeSettings['priority'];
        /** Suppress the confirmation toast. Onboarding's demo swipe shows its
         *  own, worded for the lesson rather than for the Inbox. */
        silent?: boolean;
      } = {},
    ) => {
      // AI consent gate (5.1.2(i)): drafting sends profile, resume, and job
      // data to the AI providers. An unconsented tap re-opens the disclosure
      // instead of spending anything.
      if (!hasAIConsent()) {
        promptAIConsent();
        return;
      }
      const count = opts.count ?? 1;
      let action = opts.action ?? 'draft';
      const priority = opts.priority ?? 'employee';

      // Any hiring-manager targeting (mix or hiring_manager) reuses
      // /find-hiring-manager, which only ever drafts (cold outreach to
      // decision-makers should be reviewed before it sends).
      if (priority !== 'employee') action = 'draft';

      // Off-hours guard: a swipe-to-send fired outside good sending hours
      // (8am–10pm device-local) would land an email with a late-night
      // timestamp. Quietly downgrade to a draft and tell the user, so it waits
      // in the Inbox to send (one tap) when the timing is better. Mirrors the
      // Loop scheduler's 8a–10p quiet-hours window (loop_budget.py).
      const hour = new Date().getHours();
      const offHoursDeferred = action === 'send' && (hour < 8 || hour >= 22);
      if (offHoursDeferred) action = 'draft';

      // Optimistic: drop a swipe-token and show credits fall now; reconciled
      // against the server's authoritative count when the swipe returns.
      queryClient.setQueryData<Profile>(qk.me, (prev) => {
        const base = prev ?? MOCK_PROFILE;
        return { ...base, credits: base.credits - base.creditsPerSwipe * count };
      });

      const peopleWord = count === 1 ? 'person' : 'people';
      if (offHoursDeferred) {
        showToast(
          `It's after hours — saved as a draft so it doesn't land overnight. Send from your Inbox when ready.`,
          true,
        );
      } else {
        const verb = action === 'send' ? 'Sending to' : 'Drafted to';
        // Auto-apply is no longer claimed here: it's a separate, user-confirmed
        // submission handled by the review sheet on the feed screen.
        if (!opts.silent) showToast(`${verb} ${count} ${peopleWord} at ${company}`, true);
      }

      // Employee swipes submit to the server job pool immediately → always
      // start as 'drafting' (any waiting shows via the job's own stage label).
      // The hiring-manager path still uses the client queue: if another HM
      // request is cooking, start 'queued' and flip when its turn comes.
      const initialStatus: OutreachItem['status'] =
        priority === 'employee' || draftQueueDepth === 0 ? 'drafting' : 'queued';
      const placeholderIds: string[] = [];
      for (let k = 0; k < count; k++) {
        idCounter.current += 1;
        const outreachId = `out-new-${idCounter.current}`;
        placeholderIds.push(outreachId);
        setOutreach((prev) => [
          {
            id: outreachId,
            jobTitle,
            company,
            status: initialStatus,
            timeLabel: 'Just now',
            createdAtMs: Date.now(),
          },
          ...prev,
        ]);
      }

      executeDraft(placeholderIds, {
        company,
        jobTitle,
        count,
        action,
        priority,
        swipeId: newSwipeId(),
      });

      // Auto-apply submission is handled on the feed screen via the review
      // sheet (real Browserbase submit), not faked here.
    },
    [queryClient, showToast, executeDraft],
  );

  /**
   * Tap-to-retry for a failed Inbox row: flips it back to queued/drafting and
   * re-runs a single-contact draft through the same queue. Uses the original
   * swipe's action/priority when we recorded the failure ourselves; rows
   * failed by the staleness sweep fall back to a plain employee draft. No
   * fresh optimistic credit spend — the server charges per contact found and
   * we reconcile from its authoritative count.
   */
  /**
   * A People-deck swipe that out-ran the email hunt becomes a live Inbox row
   * (Rylan 2026-08-27: fast swiping is the product's rhythm, so every fast
   * swipe should materialize as the "researching" row instead of vanishing
   * into a toast). The server's fulfiller writes the real draft and rings
   * the bell; the inbox reconcile then swaps this ghost for the real row.
   */
  const beginPersonPending = useCallback(
    (person: { name: string; company: string; title?: string }) => {
      idCounter.current += 1;
      const outreachId = `out-new-${idCounter.current}`;
      setOutreach((prev) => [
        {
          id: outreachId,
          jobTitle: person.title || '',
          company: person.company,
          personName: person.name,
          source: 'people' as const,
          status: 'drafting' as const,
          timeLabel: 'Just now',
          createdAtMs: Date.now(),
        },
        ...prev,
      ]);
      return outreachId;
    },
    [],
  );

  const endPersonPending = useCallback((id: string) => {
    setOutreach((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const retryDraft = useCallback(
    (id: string) => {
      const row = outreach.find((o) => o.id === id);
      if (!row || row.status !== 'failed') return;
      // A people-deck hunt has no client-side retry: the server-side
      // fulfiller resumes on the next touch of that deck, and re-running it
      // through the JOB pipeline would draft to the company, not the person.
      // Clear the row; the bell delivers if the hunt lands later.
      if (row.source === 'people') {
        setOutreach((prev) => prev.filter((o) => o.id !== id));
        showToast('Still hunting that address in the background. The bell rings if it lands, and a miss never charges.');
        return;
      }
      const saved = failedDraftArgs.current.get(id);
      const priority = saved?.priority ?? 'employee';
      let action: 'draft' | 'send' = saved?.action ?? 'draft';
      if (priority !== 'employee') action = 'draft';
      // Same off-hours guard as beginDraft: a retried "send" late at night
      // quietly becomes a draft.
      const hour = new Date().getHours();
      if (action === 'send' && (hour < 8 || hour >= 22)) action = 'draft';

      const initialStatus: OutreachItem['status'] =
        priority === 'employee' || draftQueueDepth === 0 ? 'drafting' : 'queued';
      setOutreach((prev) =>
        prev.map((o) =>
          o.id === id
            ? {
                ...o,
                status: initialStatus,
                snippet: undefined,
                stageLabel: undefined,
                timeLabel: 'Just now',
                createdAtMs: Date.now(),
              }
            : o,
        ),
      );
      executeDraft(
        [id],
        {
          company: row.company,
          jobTitle: row.jobTitle,
          count: 1,
          action,
          priority,
          // Reuse the original gesture's id so the server replays a completed
          // outcome (no duplicate drafts); sweep-failed rows get a fresh one.
          swipeId: saved?.swipeId ?? newSwipeId(),
        },
        { isRetry: true },
      );
    },
    [outreach, executeDraft],
  );

  const draftJob = useCallback(
    (id: string, opts: { silent?: boolean } = {}) => {
      const job = jobs.find((j) => j.id === id);
      if (!job) return;
      // Consent check BEFORE the optimistic deck removal: an unconsented
      // swipe must not eat the card, it opens the disclosure and the job
      // stays in the deck for a re-swipe after allowing.
      if (!hasAIConsent()) {
        promptAIConsent();
        return;
      }
      recordSwipedCard(job); // remember the exact card for the company page
      setJobs((prev) => prev.filter((j) => j.id !== id));
      beginDraft(job.company, job.title, {
        count: swipeSettings.contacts,
        action: swipeSettings.action,
        autoApply: swipeSettings.autoApply,
        priority: swipeSettings.priority,
        silent: opts.silent,
      });
    },
    [jobs, beginDraft, swipeSettings, recordSwipedCard],
  );

  // Remember a job as the "card you swiped" for its company (used by the
  // per-company Roles deck, which auto-applies rather than drafting outreach).
  const rememberSwipedCard = useCallback((job: Job) => recordSwipedCard(job), [recordSwipedCard]);

  // Single, deduped entry point for auto-applying to a job — used by every apply
  // surface (feed swipe, ⚡ toggle, card button, company Roles/Applied lists,
  // Saved). Blocks a second application to the same job: in-flight guard (rapid
  // double-tap) + a session set of successes + the applied-jobs cache. (The
  // backend should ALSO dedupe for cross-device safety — client guard only.)
  const applyingRef = useRef<Set<string>>(new Set());
  const appliedIdsRef = useRef<Set<string>>(new Set());
  const autoApplyJob = useCallback(
    (job: Job): void => {
      // Same AI consent gate as beginDraft: auto-apply builds materials from
      // the user's profile via the AI providers.
      if (!hasAIConsent()) {
        promptAIConsent();
        return;
      }
      const id = job.id;
      const cache = queryClient.getQueryData<AppliedJob[]>(['appliedJobs']);
      if (applyingRef.current.has(id) || appliedIdsRef.current.has(id) || alreadyApplied(cache, id)) {
        showToast('You already applied to this role');
        return;
      }
      if (!job.autoApplyEligible) {
        showToast(`${job.title} can't be auto-applied yet`);
        return;
      }
      applyingRef.current.add(id);
      recordSwipedCard(job);
      showToast(`Auto-applying to ${job.title}`, true);
      startAutoApply(id)
        .then((r) => {
          if (r.ok) {
            appliedIdsRef.current.add(id);
            queryClient.invalidateQueries({ queryKey: ['appliedJobs'] });
          } else if (r.code === 'PROFILE_REQUIRED' || r.code === 'WORK_AUTH_REQUIRED') {
            showToast('Set up your application profile to auto-apply');
          } else if (r.code === 'INSUFFICIENT_CREDITS') {
            if (iapAvailable()) presentPaywall({ context: 'auto-apply' });
            else showToast('Not enough credits to auto-apply');
          } else if (r.code === 'INELIGIBLE') {
            // The server couldn't detect a supported application system for this
            // role. Say so honestly instead of showing the optimistic
            // "Auto-applying…" toast and then silently doing nothing.
            showToast(`${job.title} can't be auto-applied — apply on the company site`);
          } else {
            showToast('Could not auto-apply, try again');
          }
        })
        .catch(() => showToast('Could not auto-apply, try again'))
        .finally(() => applyingRef.current.delete(id));
    },
    [queryClient, showToast, recordSwipedCard],
  );

  const draftAnotherContact = useCallback(
    (opts: { company: string; jobTitle?: string }) => {
      beginDraft(opts.company, opts.jobTitle ?? `a role at ${opts.company}`, {
        count: 1,
        action: swipeSettings.action,
        priority: 'employee',
      });
    },
    [beginDraft, swipeSettings.action],
  );

  const updateSwipeSettings = useCallback((patch: Partial<SwipeSettings>) => {
    setSwipeSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const setNotificationsEnabled = useCallback(
    (value: boolean) => {
      if (!value) {
        // We can't revoke OS permission from here; just stop reflecting it on.
        setNotificationsEnabledState(false);
        return;
      }
      // Turning on: ask the OS + register the token. Dismiss the prompt either
      // way so it doesn't reappear; only flip the toggle on if granted.
      setNotifPromptDismissed(true);
      registerForPushNotificationsAsync()
        .then((res) => {
          setNotificationsEnabledState(res.granted);
          showToast(
            res.granted
              ? 'Notifications on'
              : 'Enable notifications for Offerloop in Settings to get reply alerts',
          );
        })
        .catch(() => setNotificationsEnabledState(false));
    },
    [showToast],
  );

  // "Skip for now" must survive restarts: it was session-only state, so
  // every launch re-asked users who had already said no (2026-08-10).
  // Device-level on purpose; asking again on a NEW phone is fine.
  const dismissNotifPrompt = useCallback(() => {
    setNotifPromptDismissed(true);
    AsyncStorage.setItem('offerloop.notifPromptDismissed', '1').catch(() => {});
  }, []);
  useEffect(() => {
    AsyncStorage.getItem('offerloop.notifPromptDismissed')
      .then((v) => {
        if (v === '1') setNotifPromptDismissed(true);
      })
      .catch(() => {});
  }, []);

  // Returning users who already granted permission: silently re-register the
  // push token each launch (Expo tokens can rotate) and suppress the prompt.
  //
  // `notifPermissionResolved` exists because reading the OS permission is ASYNC.
  // notificationsEnabled starts false, so on the very first render the prompt's
  // `!enabled && !dismissed` was already true and the modal painted — then this
  // resolved a beat later, flipped both flags, and yanked it away. Result: the
  // prompt flashed in on EVERY launch for users who had already enabled
  // notifications. Nothing may render until we actually know the answer.
  useEffect(() => {
    if (authStatus !== 'signedIn') return;
    let cancelled = false;
    hasNotificationPermission()
      .then((granted) => {
        if (cancelled) return;
        if (granted) {
          setNotificationsEnabledState(true);
          setNotifPromptDismissed(true);
          registerForPushNotificationsAsync().catch(() => {});
        }
        // Resolved either way — a genuine not-yet-granted user still gets asked.
        setNotifPermissionResolved(true);
      })
      .catch(() => {
        if (!cancelled) setNotifPermissionResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  const markOutreachSent = useCallback(
    (id: string) => {
      updateOutreach(id, {
        status: 'sent',
        snippet: 'Sent from your connected Gmail',
        timeLabel: 'Just now',
      });
    },
    [updateOutreach],
  );

  const markNotificationsRead = useCallback(() => {
    // Optimistic: clear the badge locally, then persist + zero the server
    // unread counters. Re-fetch on settle so a reply that arrived mid-view
    // still shows (just no longer unread).
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    apiMarkNotificationsRead()
      .catch(() => {})
      .finally(() => queryClient.invalidateQueries({ queryKey: qk.notifications }));
  }, [queryClient]);

  const updateProfile = useCallback(
    (patch: Partial<Profile>) => {
      patchProfile(patch);
    },
    [patchProfile],
  );

  const enrichLinkedinProfile = useCallback(
    async (url: string): Promise<EnrichResult> => {
      const clean = url.trim();
      if (!clean) return { enriched: false, error: 'Enter your LinkedIn URL first' };
      try {
        const res = await enrichLinkedin(clean);
        if (res.enriched) {
          // Claim the URL on the profile only on success. It used to patch
          // optimistically before the call, so a failed enrichment still ticked
          // "Add your LinkedIn" complete in the completion card.
          patchProfile({ linkedinUrl: clean });
          // The endpoint wrote linkedinUrl + resumeParsed + linkedinResumeParsed
          // to Firestore; refetch /me so grad year, school, experiences, and the
          // LinkedIn highlights fill in.
          await queryClient.invalidateQueries({ queryKey: qk.me });
          showToast('LinkedIn pulled in, profile updated');
        } else {
          showToast(res.error || 'Could not read that LinkedIn profile');
        }
        return res;
      } catch {
        showToast('Could not reach enrichment, try again');
        return { enriched: false, error: 'network' };
      }
    },
    [patchProfile, queryClient, showToast],
  );

  const addLoop = useCallback(
    (brief: string, people?: LoopPeople, autoSend?: boolean) => {
      idCounter.current += 1;
      // Optimistically show the new Loop, then create it server-side and
      // re-sync from the fleet (which fills in real counts + auto-start state).
      setLoops((prev) => [
        {
          id: `loop-new-${idCounter.current}`,
          brief,
          status: 'Active',
          contactsFound: 0,
          draftsCreated: 0,
          weeklyTarget: 5,
          weeklyDone: 0,
        },
        ...prev,
      ]);
      createLoop(brief, people, autoSend)
        .catch(() => showToast('Could not create the Loop, try again'))
        .finally(() => queryClient.invalidateQueries({ queryKey: qk.loops }));
    },
    [queryClient, showToast],
  );

  const toggleLoop = useCallback(
    (id: string) => {
      let nowPaused = false;
      setLoops((prev) =>
        prev.map((loop) => {
          if (loop.id !== id) return loop;
          nowPaused = loop.status === 'Active';
          return { ...loop, status: nowPaused ? 'Paused' : 'Active' };
        }),
      );
      setLoopPaused(id, nowPaused)
        .catch(() => showToast('Could not update the Loop, try again'))
        .finally(() => queryClient.invalidateQueries({ queryKey: qk.loops }));
    },
    [queryClient, showToast],
  );

  const addMeetingPrep = useCallback(
    async ({ linkedinUrl }: { name: string; linkedinUrl: string }) => {
      // Kick off the real coffee-chat-prep job (15 credits, async); returns the
      // prep id to navigate to. The detail screen polls it to completion, and
      // the library list re-syncs from the server.
      const id = await createMeetingPrep(linkedinUrl.trim());
      queryClient.invalidateQueries({ queryKey: qk.meetingPreps });
      return id;
    },
    [queryClient],
  );

  const unreadCount = notifications.filter((n) => !n.read).length;
  const [draftJustCompleted, setDraftJustCompleted] = useState(false);

  const value = useMemo<AppStore>(
    () => ({
      jobs,
      allJobs,
      outreach,
      notifications,
      trackerRows,
      profile,
      connection,
      bootPending,
      loopsReady,
      feedState,
      inboxState,
      refetchInbox,
      loops,
      // No global Loop-activity feed endpoint yet — empty (honest empty state in
      // the Activity tab) instead of seeding fixture activity.
      loopActivity: [] as LoopActivity[],
      resumeExperiences: profile.resumeExperiences,
      files: MOCK_FILES,
      meetingPreps,
      toast,
      unreadCount,
      draftJustCompleted,
      canUndo: passedJobs.length > 0,
      passedCount: passedJobs.length,
      passedJobs,
      passedPeople,
      addPassedPerson,
      restorePassedPerson,
      savedCount: savedJobs.length,
      savedJobs,
      swipeSettings,
      updateSwipeSettings,
      draftsLeft,
      costPerSwipe,
      notificationsEnabled,
      notifPromptDismissed,
      notifPermissionResolved,
      setNotificationsEnabled,
      dismissNotifPrompt,
      passJob,
      saveJob,
      unsaveJob,
      restoreSavedJob,
      draftJob,
      draftAnotherContact,
      retryDraft,
      beginPersonPending,
      endPersonPending,
      rememberSwipedCard,
      autoApplyJob,
      undoLastPass,
      restorePassedJob,
      resetDeck,
      rerollFeed,
      rerolling,
      updateOutreach,
      resolveOutreachId,
      swipedCardForCompany,
      toggleOutreachPin,
      toggleContactPin,
      markOutreachSent,
      markNotificationsRead,
      updateProfile,
      onboardingDone,
      needsOnboarding,
      completeOnboarding,
      resetOnboarding,
      confirmOnboardingDone,
      enrichLinkedin: enrichLinkedinProfile,
      addLoop,
      toggleLoop,
      addMeetingPrep,
      showToast,
    }),
    [
      jobs,
      outreach,
      notifications,
      trackerRows,
      profile,
      connection,
      bootPending,
      loopsReady,
      feedState,
      inboxState,
      refetchInbox,
      loops,
      meetingPreps,
      passedJobs,
      passedPeople,
      addPassedPerson,
      restorePassedPerson,
      savedJobs,
      swipeSettings,
      draftsLeft,
      costPerSwipe,
      notificationsEnabled,
      notifPromptDismissed,
      notifPermissionResolved,
      toast,
      unreadCount,
      draftJustCompleted,
      passJob,
      saveJob,
      unsaveJob,
      restoreSavedJob,
      draftJob,
      draftAnotherContact,
      retryDraft,
      beginPersonPending,
      endPersonPending,
      rememberSwipedCard,
      autoApplyJob,
      updateSwipeSettings,
      setNotificationsEnabled,
      dismissNotifPrompt,
      undoLastPass,
      restorePassedJob,
      resetDeck,
      rerollFeed,
      rerolling,
      updateOutreach,
      resolveOutreachId,
      swipedCardForCompany,
      toggleOutreachPin,
      toggleContactPin,
      markOutreachSent,
      markNotificationsRead,
      updateProfile,
      onboardingDone,
      needsOnboarding,
      completeOnboarding,
      resetOnboarding,
      confirmOnboardingDone,
      enrichLinkedinProfile,
      addLoop,
      toggleLoop,
      addMeetingPrep,
      showToast,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
