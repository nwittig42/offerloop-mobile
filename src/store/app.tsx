import AsyncStorage from '@react-native-async-storage/async-storage';
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

import { fetchFeed, rankJobsByLocation } from '@/api/endpoints/feed';
import { fetchInbox } from '@/api/endpoints/inbox';
import { createLoop, fetchLoops, setLoopPaused, type LoopPeople } from '@/api/endpoints/loops';
import { fetchMe } from '@/api/endpoints/me';
import {
  fetchNotifications,
  markNotificationsRead as apiMarkNotificationsRead,
} from '@/api/endpoints/notifications';
import { createMeetingPrep, fetchMeetingPreps } from '@/api/endpoints/meetingPreps';
import { enrichLinkedin, type EnrichResult } from '@/api/endpoints/profile';
import { runSwipe } from '@/api/endpoints/swipe';
import { isInsufficientCredits } from '@/api/errors';
import { qk } from '@/api/queryKeys';
import { useAuth } from '@/auth/AuthProvider';
import { identify, setAnalyticsUser, track } from '@/lib/analytics';
import {
  hasNotificationPermission,
  registerForPushNotificationsAsync,
} from '@/notifications/push';

import {
  MOCK_FILES,
  MOCK_JOBS,
  MOCK_LOOP_ACTIVITY,
  MOCK_MEETING_PREPS,
  MOCK_NOTIFICATIONS_SEED,
  MOCK_OUTREACH_SEED,
  MOCK_PROFILE,
} from '@/mocks/data';
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
} from '@/types';

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
  autoApply: false,
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
    if (o.status === 'drafting' || o.status === 'failed') continue;
    const needsYou = (o.status === 'replied' && !o.attended) || o.status === 'ready';
    let preview: string;
    let statusLabel: string;
    let statusTone: TrackerRow['statusTone'];
    let bucket: TrackerRow['bucket'];
    if (o.status === 'ready') {
      preview = 'Draft ready to review';
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
    status: 'ok' | 'loading' | 'error';
    usingSampleData: boolean;
    retry: () => void;
  };
  /**
   * Per-screen load state for the job feed and inbox. The store falls back to
   * fixtures until each query resolves, so these let the Feed/Inbox render their
   * own skeleton / error placeholder instead of flashing mock cards as real.
   */
  feedState: { loading: boolean; error: boolean; retry: () => void };
  inboxState: { loading: boolean; error: boolean; retry: () => void };
  loops: Loop[];
  loopActivity: LoopActivity[];
  resumeExperiences: ResumeExperience[];
  files: ProfileFile[];
  meetingPreps: MeetingPrep[];
  toast: ToastState;
  unreadCount: number;
  canUndo: boolean;
  passedCount: number;
  passedJobs: Job[];
  swipeSettings: SwipeSettings;
  updateSwipeSettings: (patch: Partial<SwipeSettings>) => void;
  swipesAvailable: number;
  swipeBatchSize: number;
  cooldownSecondsLeft: number;
  rechargeNow: () => void;
  notificationsEnabled: boolean;
  notifPromptDismissed: boolean;
  setNotificationsEnabled: (value: boolean) => void;
  dismissNotifPrompt: () => void;
  passJob: (id: string) => void;
  draftJob: (id: string) => void;
  draftAnotherContact: (opts: { company: string; jobTitle?: string }) => void;
  undoLastPass: () => void;
  restorePassedJob: (id: string) => void;
  resetDeck: () => void;
  updateOutreach: (id: string, patch: Partial<OutreachItem>) => void;
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
  const [outreach, setOutreach] = useState<OutreachItem[]>(MOCK_OUTREACH_SEED);
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    MOCK_NOTIFICATIONS_SEED,
  );
  // Profile + credits are now server-backed: GET /api/mobile/me via React Query.
  // Falls back to the fixture until the first fetch resolves (or offline mocks).
  const { status: authStatus, user } = useAuth();
  const uid = user?.uid;
  const queryClient = useQueryClient();
  const meQuery = useQuery({
    queryKey: qk.me,
    queryFn: fetchMe,
    enabled: authStatus === 'signedIn',
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
  const feedQuery = useQuery({
    queryKey: qk.feed,
    queryFn: fetchFeed,
    enabled: authStatus === 'signedIn',
  });
  const allJobs = feedQuery.data ?? MOCK_JOBS;
  useEffect(() => {
    if (feedQuery.data && !deckSeeded) {
      // Lean the freshly-seeded deck toward the user's preferred locations
      // (with wildcards for volume). Done once at seed so the order doesn't
      // reshuffle mid-swipe.
      setJobs(rankJobsByLocation(feedQuery.data, meQuery.data?.preferredLocations ?? []));
      setDeckSeeded(true);
    }
  }, [feedQuery.data, deckSeeded, meQuery.data?.preferredLocations]);

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
  }, [uid]);

  const resetOnboarding = useCallback(() => {
    setOnboardingDone(false);
    if (uid) AsyncStorage.removeItem(onboardingStorageKey(uid)).catch(() => {});
  }, [uid]);

  // Should the auth gate force this user into onboarding? Only a genuinely-new
  // user: hasn't completed it AND the real /me has no profile data yet. Gated on
  // meQuery.isSuccess so we never force-redirect on the mock fallback (which
  // would trap established users). FORCE_ONBOARDING (dev) overrides for testing.
  const needsOnboarding =
    onboardingDone === false &&
    (FORCE_ONBOARDING || (meQuery.isSuccess && !profile.hasServerProfile));

  // PostHog identity: point analytics at the signed-in user (Firebase uid =
  // the web's distinct_id), and set person properties once /me resolves so the
  // CMO can segment by school/plan. Best-effort; no-op until a key is configured.
  useEffect(() => {
    setAnalyticsUser(uid ?? null);
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
        AsyncStorage.setItem(cacheStorageKey(uid, name), JSON.stringify(data)).catch(() => {});
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
    setOutreach((prev) => {
      const serverIds = new Set(server.map((o) => o.id));
      const inFlight = prev.filter((o) => o.status === 'drafting' && !serverIds.has(o.id));
      return [...inFlight, ...server];
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
    let status: 'ok' | 'loading' | 'error' = 'ok';
    if (signedIn) {
      if (meQuery.isError) status = 'error';
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

  const [loops, setLoops] = useState<Loop[]>(MOCK_PROFILE.loops);
  // Loops fleet from GET /api/agent/loops; re-sync the local list to the server
  // on each fetch (optimistic add/toggle below patch it in the meantime).
  const loopsQuery = useQuery({
    queryKey: qk.loops,
    queryFn: fetchLoops,
    enabled: authStatus === 'signedIn',
  });
  useEffect(() => {
    if (loopsQuery.data) setLoops(loopsQuery.data);
  }, [loopsQuery.data]);
  const [meetingPreps, setMeetingPreps] = useState<MeetingPrep[]>(MOCK_MEETING_PREPS);
  // Coffee library from GET /api/coffee-chat-prep/all; re-sync to the server.
  const meetingPrepsQuery = useQuery({
    queryKey: qk.meetingPreps,
    queryFn: fetchMeetingPreps,
    enabled: authStatus === 'signedIn',
  });
  useEffect(() => {
    if (meetingPrepsQuery.data) setMeetingPreps(meetingPrepsQuery.data);
  }, [meetingPrepsQuery.data]);
  const [passedJobs, setPassedJobs] = useState<Job[]>([]);
  // Derived from the real outreach list (no separate fetch): same contacts as
  // the Inbox, shaped for the Network Contacts list.
  const trackerRows = useMemo(() => outreachToTrackerRows(outreach), [outreach]);
  const [swipeSettings, setSwipeSettings] = useState<SwipeSettings>(DEFAULT_SWIPE_SETTINGS);

  const swipeBatchSize = BATCH_BY_PLAN[profile.plan];
  const [swipesAvailable, setSwipesAvailable] = useState(swipeBatchSize);
  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  // Off at launch (mock), so the prompt shows like a fresh login. Real push
  // permission wires in Phase 3.
  const [notificationsEnabled, setNotificationsEnabledState] = useState(false);
  const [notifPromptDismissed, setNotifPromptDismissed] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const idCounter = useRef(0);
  const contactCounter = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, showInboxAction = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, showInboxAction });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  // Tick every second while a cooldown is running, so the countdown updates.
  useEffect(() => {
    if (cooldownEndsAt === null) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cooldownEndsAt]);

  // The plan (and thus batch size) resolves after the mock default — e.g. an
  // Elite user starts seeded at the Pro number. Keep the available count in
  // lockstep when the batch grows, but never while a cooldown is running (so it
  // doesn't skip the recharge wait). Fires only when the batch size changes, so
  // mid-session spends aren't clobbered.
  useEffect(() => {
    if (cooldownEndsAt === null) {
      setSwipesAvailable((prev) => (prev < swipeBatchSize ? swipeBatchSize : prev));
    }
  }, [swipeBatchSize, cooldownEndsAt]);

  // When the cooldown elapses, refill the batch and ping the user.
  useEffect(() => {
    if (cooldownEndsAt !== null && nowMs >= cooldownEndsAt) {
      setSwipesAvailable(swipeBatchSize);
      setCooldownEndsAt(null);
      idCounter.current += 1;
      setNotifications((prev) => [
        {
          id: `n-recharge-${idCounter.current}`,
          kind: 'loop',
          text: `Your swipes recharged. ${swipeBatchSize} ready to send.`,
          timeLabel: 'Just now',
          read: false,
        },
        ...prev,
      ]);
      showToast(`Swipes recharged, ${swipeBatchSize} ready`);
    }
  }, [nowMs, cooldownEndsAt, swipeBatchSize, showToast]);

  // One swipe spends one swipe-token, regardless of how many contacts it
  // reaches. The contact count is paid in credits, not stamina.
  const spendSwipes = useCallback(() => {
    setSwipesAvailable((prev) => {
      const next = Math.max(0, prev - 1);
      if (next === 0 && prev > 0) {
        setCooldownEndsAt(Date.now() + MOCK_COOLDOWN_SECONDS * 1000);
      }
      return next;
    });
  }, []);

  const rechargeNow = useCallback(() => {
    setSwipesAvailable(swipeBatchSize);
    setCooldownEndsAt(null);
  }, [swipeBatchSize]);

  // Give a swipe-token back when a swipe finds no contact (nothing was actually
  // reached, so it shouldn't cost stamina or trip the cooldown).
  const refundSwipe = useCallback(() => {
    setSwipesAvailable((prev) => Math.min(swipeBatchSize, prev + 1));
    setCooldownEndsAt(null);
  }, [swipeBatchSize]);

  const cooldownSecondsLeft =
    cooldownEndsAt !== null ? Math.max(0, Math.ceil((cooldownEndsAt - nowMs) / 1000)) : 0;

  const passJob = useCallback((id: string) => {
    setJobs((prev) => {
      const job = prev.find((j) => j.id === id);
      if (job) setPassedJobs((p) => [...p, job]);
      return prev.filter((j) => j.id !== id);
    });
  }, []);

  const undoLastPass = useCallback(() => {
    setPassedJobs((prev) => {
      if (prev.length === 0) return prev;
      const job = prev[prev.length - 1];
      setJobs((js) => [job, ...js]);
      return prev.slice(0, -1);
    });
  }, []);

  const restorePassedJob = useCallback((id: string) => {
    setPassedJobs((prev) => {
      const job = prev.find((j) => j.id === id);
      if (job) setJobs((js) => [job, ...js]);
      return prev.filter((j) => j.id !== id);
    });
  }, []);

  const resetDeck = useCallback(() => {
    setPassedJobs([]);
    setJobs(feedQuery.data ?? MOCK_JOBS);
  }, [feedQuery.data]);

  const updateOutreach = useCallback(
    (id: string, patch: Partial<OutreachItem>) => {
      setOutreach((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    [],
  );

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
        firstIsHiringManager?: boolean;
      } = {},
    ) => {
      const count = opts.count ?? 1;
      let action = opts.action ?? 'draft';
      const firstIsHM = opts.firstIsHiringManager ?? true;

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
      spendSwipes();

      const peopleWord = count === 1 ? 'person' : 'people';
      if (offHoursDeferred) {
        showToast(
          `It's after hours — saved as a draft so it doesn't land overnight. Send from your Inbox when ready.`,
          true,
        );
      } else {
        const verb = action === 'send' ? 'Sending to' : 'Drafted to';
        // Auto-apply is no longer claimed here — it's a separate, user-confirmed
        // submission handled by the review sheet on the feed screen.
        showToast(`${verb} ${count} ${peopleWord} at ${company}`, true);
      }

      const placeholderIds: string[] = [];
      for (let k = 0; k < count; k++) {
        idCounter.current += 1;
        const outreachId = `out-new-${idCounter.current}`;
        placeholderIds.push(outreachId);
        setOutreach((prev) => [
          { id: outreachId, jobTitle, company, status: 'drafting', timeLabel: 'Just now' },
          ...prev,
        ]);
      }

      runSwipe({ company, jobTitle, count, action, firstIsHiringManager: firstIsHM })
        .then(({ items, creditsRemaining }) => {
          const foundCount = items.length;
          // Activation event — the core action. Lets the CMO measure swipe→draft
          // and segment activation by referral_source / target_track.
          if (foundCount > 0) track('outreach_drafted', { company, count: foundCount, action });
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
          items.forEach((item, k) => {
            const pid = placeholderIds[k];
            if (!pid) return;
            const who = item.contact?.name ?? 'a contact';
            setNotifications((prev) => [
              {
                id: `n-new-${pid}`,
                kind: 'draft_ready',
                text:
                  action === 'send'
                    ? `Sent to ${who} at ${company}`
                    : `Outreach to ${who} at ${company} is ready to review`,
                timeLabel: 'Just now',
                read: false,
                outreachId: pid,
              },
              ...prev,
            ]);
          });
          if (foundCount === 0) {
            // No one found — give the swipe-token back and reconcile credits
            // from the server (which charges per contact, so a miss costs 0).
            refundSwipe();
            showToast(`No contact found at ${company} — no credits used`);
          }
          if (typeof creditsRemaining === 'number') {
            patchProfile({ credits: creditsRemaining });
          } else {
            queryClient.invalidateQueries({ queryKey: qk.me });
          }
          // The backend just wrote a durable draft_ready bell item; pull it so
          // the optimistic client item is replaced by the persisted one (which
          // survives a reload and deep-links to the real conversation).
          if (foundCount > 0) {
            queryClient.invalidateQueries({ queryKey: qk.notifications });
          }
        })
        .catch((err) => {
          if (isInsufficientCredits(err)) {
            setOutreach((prev) => prev.filter((o) => !placeholderIds.includes(o.id)));
            showToast('Not enough credits. Top up on offerloop.ai');
          } else {
            setOutreach((prev) =>
              prev.map((o) =>
                placeholderIds.includes(o.id)
                  ? { ...o, status: 'failed', snippet: 'Could not draft, tap to retry' }
                  : o,
              ),
            );
          }
          queryClient.invalidateQueries({ queryKey: qk.me });
        });

      // Auto-apply submission is handled on the feed screen via the review
      // sheet (real Browserbase submit), not faked here.
    },
    [queryClient, patchProfile, showToast, spendSwipes, refundSwipe],
  );

  const draftJob = useCallback(
    (id: string) => {
      const job = jobs.find((j) => j.id === id);
      if (!job) return;
      setJobs((prev) => prev.filter((j) => j.id !== id));
      beginDraft(job.company, job.title, {
        count: swipeSettings.contacts,
        action: swipeSettings.action,
        autoApply: swipeSettings.autoApply,
        firstIsHiringManager: true,
      });
    },
    [jobs, beginDraft, swipeSettings],
  );

  const draftAnotherContact = useCallback(
    (opts: { company: string; jobTitle?: string }) => {
      beginDraft(opts.company, opts.jobTitle ?? `a role at ${opts.company}`, {
        count: 1,
        action: swipeSettings.action,
        firstIsHiringManager: false,
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

  const dismissNotifPrompt = useCallback(() => setNotifPromptDismissed(true), []);

  // Returning users who already granted permission: silently re-register the
  // push token each launch (Expo tokens can rotate) and suppress the prompt.
  useEffect(() => {
    if (authStatus !== 'signedIn') return;
    let cancelled = false;
    hasNotificationPermission().then((granted) => {
      if (cancelled || !granted) return;
      setNotificationsEnabledState(true);
      setNotifPromptDismissed(true);
      registerForPushNotificationsAsync().catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  const markOutreachSent = useCallback(
    (id: string) => {
      updateOutreach(id, {
        status: 'sent',
        snippet: 'Sent from your connected Gmail (mock)',
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
      patchProfile({ linkedinUrl: clean }); // optimistic; enrichment persists it server-side
      try {
        const res = await enrichLinkedin(clean);
        if (res.enriched) {
          // The endpoint wrote linkedinUrl + resumeParsed + linkedinResumeParsed
          // to Firestore; refetch /me so grad year, school, experiences, and the
          // LinkedIn highlights fill in.
          await queryClient.invalidateQueries({ queryKey: qk.me });
          showToast('LinkedIn pulled in — profile updated');
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

  const value = useMemo<AppStore>(
    () => ({
      jobs,
      allJobs,
      outreach,
      notifications,
      trackerRows,
      profile,
      connection,
      feedState,
      inboxState,
      loops,
      loopActivity: MOCK_LOOP_ACTIVITY,
      resumeExperiences: profile.resumeExperiences,
      files: MOCK_FILES,
      meetingPreps,
      toast,
      unreadCount,
      canUndo: passedJobs.length > 0,
      passedCount: passedJobs.length,
      passedJobs,
      swipeSettings,
      updateSwipeSettings,
      swipesAvailable,
      swipeBatchSize,
      cooldownSecondsLeft,
      rechargeNow,
      notificationsEnabled,
      notifPromptDismissed,
      setNotificationsEnabled,
      dismissNotifPrompt,
      passJob,
      draftJob,
      draftAnotherContact,
      undoLastPass,
      restorePassedJob,
      resetDeck,
      updateOutreach,
      toggleOutreachPin,
      toggleContactPin,
      markOutreachSent,
      markNotificationsRead,
      updateProfile,
      onboardingDone,
      needsOnboarding,
      completeOnboarding,
      resetOnboarding,
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
      feedState,
      inboxState,
      loops,
      meetingPreps,
      passedJobs,
      swipeSettings,
      swipesAvailable,
      swipeBatchSize,
      cooldownSecondsLeft,
      notificationsEnabled,
      notifPromptDismissed,
      toast,
      unreadCount,
      passJob,
      draftJob,
      draftAnotherContact,
      updateSwipeSettings,
      rechargeNow,
      setNotificationsEnabled,
      dismissNotifPrompt,
      undoLastPass,
      restorePassedJob,
      resetDeck,
      updateOutreach,
      toggleOutreachPin,
      toggleContactPin,
      markOutreachSent,
      markNotificationsRead,
      updateProfile,
      onboardingDone,
      needsOnboarding,
      completeOnboarding,
      resetOnboarding,
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
