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

import {
  MOCK_FILES,
  MOCK_JOBS,
  MOCK_LOOP_ACTIVITY,
  MOCK_MEETING_PREPS,
  MOCK_NOTIFICATIONS_SEED,
  MOCK_OUTREACH_SEED,
  MOCK_PROFILE,
  MOCK_RESUME_EXPERIENCES,
  MOCK_TRACKER_ROWS,
} from '@/mocks/data';
import type {
  ContactRelation,
  Job,
  Loop,
  LoopActivity,
  MeetingPrep,
  NotificationItem,
  OutreachItem,
  ProfileFile,
  ResumeExperience,
  SwipeSettings,
} from '@/types';

/**
 * Phase 1 in-memory store, mock data only. The shape mirrors what the real
 * backend endpoints will return in Phase 3 so screens swap cleanly later.
 * A right swipe runs the locked optimistic flow: instant confirmation,
 * a "drafting" placeholder in the Inbox, then the item fills in after a
 * simulated async delay.
 */

const DRAFT_SIMULATION_MS = 4500;

// Index 0 is always the hiring manager, the rest are employees on the team,
// so a multi-contact swipe builds the "apply, then warm up the team" web.
const FIXTURE_CONTACTS = [
  { name: 'Riley Mockwell', title: 'Director, Hiring Manager' },
  { name: 'Alex Fixture', title: 'Senior Associate' },
  { name: 'Casey Specimen', title: 'Associate' },
  { name: 'Morgan Sampleton', title: 'Analyst' },
];

const DEFAULT_SWIPE_SETTINGS: SwipeSettings = {
  action: 'draft',
  contacts: 1,
  autoApply: false,
};

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
const REAL_COOLDOWN_HOURS: Record<'Free' | 'Pro' | 'Elite', number> = { Free: 5, Pro: 4, Elite: 3 };
const MOCK_COOLDOWN_SECONDS = 60; // demo timer, stands in for REAL_COOLDOWN_HOURS

function relationFor(index: number): ContactRelation {
  return index === 0 ? 'Hiring manager' : 'Employee';
}

type ToastState = { message: string; showInboxAction: boolean } | null;

type Profile = typeof MOCK_PROFILE;

type AppStore = {
  jobs: Job[];
  allJobs: Job[];
  outreach: OutreachItem[];
  notifications: NotificationItem[];
  trackerRows: typeof MOCK_TRACKER_ROWS;
  profile: Profile;
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
  markOutreachSent: (id: string) => void;
  markNotificationsRead: () => void;
  updateProfile: (patch: Partial<Profile>) => void;
  addLoop: (brief: string) => void;
  toggleLoop: (id: string) => void;
  addMeetingPrep: (input: { name: string; linkedinUrl: string }) => string;
  showToast: (message: string, showInboxAction?: boolean) => void;
};

const AppContext = createContext<AppStore | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>(MOCK_JOBS);
  const [outreach, setOutreach] = useState<OutreachItem[]>(MOCK_OUTREACH_SEED);
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    MOCK_NOTIFICATIONS_SEED,
  );
  const [profile, setProfile] = useState<Profile>(MOCK_PROFILE);
  const [loops, setLoops] = useState<Loop[]>(MOCK_PROFILE.loops);
  const [meetingPreps, setMeetingPreps] = useState<MeetingPrep[]>(MOCK_MEETING_PREPS);
  const [passedJobs, setPassedJobs] = useState<Job[]>([]);
  const [swipeSettings, setSwipeSettings] = useState<SwipeSettings>(DEFAULT_SWIPE_SETTINGS);

  const swipeBatchSize = BATCH_BY_PLAN[MOCK_PROFILE.plan];
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
    setJobs(MOCK_JOBS);
  }, []);

  const updateOutreach = useCallback(
    (id: string, patch: Partial<OutreachItem>) => {
      setOutreach((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    [],
  );

  /**
   * Shared core of the optimistic flow: spend credits, drop "drafting"
   * placeholders in the Inbox (one per contact), then fill them in after the
   * simulated delay. Honors the swipe settings: how many contacts to reach,
   * whether to draft or auto-send, and whether to also apply. The first
   * contact in a multi-reach is the hiring manager (the "apply, then warm up
   * the team" web); the rest are employees.
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
      const action = opts.action ?? 'draft';
      const autoApply = opts.autoApply ?? false;
      const firstIsHM = opts.firstIsHiringManager ?? true;
      const filledStatus: OutreachItem['status'] = action === 'send' ? 'sent' : 'ready';

      setProfile((prev) => ({
        ...prev,
        credits: prev.credits - prev.creditsPerSwipe * count,
      }));
      spendSwipes();

      const peopleWord = count === 1 ? 'person' : 'people';
      const verb = action === 'send' ? 'Sending to' : 'Drafted to';
      showToast(`${verb} ${count} ${peopleWord} at ${company}${autoApply ? ', applied' : ''}`, true);

      for (let k = 0; k < count; k++) {
        idCounter.current += 1;
        const outreachId = `out-new-${idCounter.current}`;
        const relation: ContactRelation = firstIsHM && k === 0 ? 'Hiring manager' : 'Employee';
        const fixture = FIXTURE_CONTACTS[k % FIXTURE_CONTACTS.length];

        setOutreach((prev) => [
          { id: outreachId, jobTitle, company, status: 'drafting', timeLabel: 'Just now' },
          ...prev,
        ]);

        setTimeout(() => {
          setOutreach((prev) =>
            prev.map((item) =>
              item.id === outreachId
                ? {
                    ...item,
                    status: filledStatus,
                    contact: { name: fixture.name, title: fixture.title, company, relation },
                    subject: `Student reaching out about ${jobTitle}`,
                    snippet:
                      action === 'send'
                        ? 'Sent from your connected Gmail (mock)'
                        : 'Draft is ready for your review (mock)',
                    body: `Hi ${fixture.name.split(' ')[0]},\n\nFixture draft body generated by the mock service for the ${jobTitle} role at ${company}. Edit me to test the editor.\n\nBest,\nSample Student`,
                  }
                : item,
            ),
          );
          setNotifications((prev) => [
            {
              id: `n-new-${outreachId}`,
              kind: 'draft_ready',
              text:
                action === 'send'
                  ? `Sent to ${fixture.name} (${relation}) at ${company}`
                  : `Outreach to ${fixture.name} (${relation}) at ${company} is ready to review`,
              timeLabel: 'Just now',
              read: false,
              outreachId,
            },
            ...prev,
          ]);
        }, DRAFT_SIMULATION_MS + k * 700);
      }

      if (autoApply) {
        idCounter.current += 1;
        setNotifications((prev) => [
          {
            id: `n-apply-${idCounter.current}`,
            kind: 'loop',
            text: `Applied to ${jobTitle} at ${company} (mock)`,
            timeLabel: 'Just now',
            read: false,
          },
          ...prev,
        ]);
      }
    },
    [profile.creditsPerSwipe, showToast, spendSwipes],
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

  const setNotificationsEnabled = useCallback((value: boolean) => {
    setNotificationsEnabledState(value);
    if (value) setNotifPromptDismissed(true);
  }, []);

  const dismissNotifPrompt = useCallback(() => setNotifPromptDismissed(true), []);

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
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    setProfile((prev) => ({ ...prev, ...patch }));
  }, []);

  const addLoop = useCallback((brief: string) => {
    idCounter.current += 1;
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
  }, []);

  const toggleLoop = useCallback((id: string) => {
    setLoops((prev) =>
      prev.map((loop) =>
        loop.id === id
          ? { ...loop, status: loop.status === 'Active' ? 'Paused' : 'Active' }
          : loop,
      ),
    );
  }, []);

  const addMeetingPrep = useCallback(
    ({ name, linkedinUrl }: { name: string; linkedinUrl: string }) => {
      idCounter.current += 1;
      const id = `prep-new-${idCounter.current}`;
      const display = name.trim() || 'New contact';
      setMeetingPreps((prev) => [
        {
          id,
          name: display,
          title: 'Pulled from LinkedIn (mock)',
          company: 'Pulled from LinkedIn (mock)',
          linkedinUrl: linkedinUrl.trim() || undefined,
          summary: `Fixture brief for ${display}. The real prep reads their LinkedIn and recent activity, then writes a tailored synopsis and opener. This preview shows the shape.`,
          talkingPoints: [
            'Fixture talking point about their career path.',
            'Fixture talking point about a shared connection or interest.',
            'Fixture question to ask in the meeting.',
          ],
          createdLabel: 'Prepped just now',
        },
        ...prev,
      ]);
      return id;
    },
    [],
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const value = useMemo<AppStore>(
    () => ({
      jobs,
      allJobs: MOCK_JOBS,
      outreach,
      notifications,
      trackerRows: MOCK_TRACKER_ROWS,
      profile,
      loops,
      loopActivity: MOCK_LOOP_ACTIVITY,
      resumeExperiences: MOCK_RESUME_EXPERIENCES,
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
      markOutreachSent,
      markNotificationsRead,
      updateProfile,
      addLoop,
      toggleLoop,
      addMeetingPrep,
      showToast,
    }),
    [
      jobs,
      outreach,
      notifications,
      profile,
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
      markOutreachSent,
      markNotificationsRead,
      updateProfile,
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
