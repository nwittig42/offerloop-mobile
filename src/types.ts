export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  logoUrl?: string;
  compensation?: string;
  workArrangement?: string;
  experienceLevel?: string;
  education?: string;
  companySize?: string;
  description: string;
  requiredQualifications?: string[];
  /** Backend feed flags (jobs.py): can this job be auto-applied to, and which ATS. */
  autoApplyEligible?: boolean;
  atsPlatform?: string;
};

export type CompanyInfo = {
  about: string;
  industry: string;
  size: string;
  hq: string;
  news: { source: string; timeLabel: string; headline: string }[];
};

export type OutreachStatus = 'queued' | 'drafting' | 'ready' | 'sent' | 'replied' | 'failed';

/** Who, in the company, this contact is to you. The clarity on the swipe. */
export type ContactRelation = 'Hiring manager' | 'Recruiter' | 'Employee';

export type Contact = {
  name: string;
  title: string;
  company: string;
  relation?: ContactRelation;
  linkedinUrl?: string;
};

/**
 * A person in the People deck, from GET /api/ranker/candidates.
 *
 * Deliberately NOT a Contact: a Contact is someone you already reached, a
 * Candidate is someone the ranker is offering you. The email is absent until
 * the user pays to reveal it, which is the whole shape of the feed.
 *
 * No hometown field. It is extracted upstream but not wired onto the person
 * yet (ranker handoff, section 6), so there is nothing true to render.
 */
export type Candidate = {
  /** candidate_id — echoed back on every feedback call. */
  id: string;
  name: string;
  title: string;
  company: string;
  location?: string;
  /** The alumni hook: their school, when it matches the user's. */
  school?: string;
  /** Why the ranker surfaced this person. Rendered as chips, never invented. */
  reasons?: string[];
  linkedinUrl?: string;
  photoUrl?: string;
  relation?: ContactRelation;
  /** Position in the deck the server sent. Echoed back on feedback. */
  rank: number;
  /**
   * How close a match this person is to you, 1.0 to 10.0, one decimal.
   *
   * Server-sent only. A person the ranker scored has a number; a person it did
   * not stays undefined and the card renders no badge, because a similarity
   * score the app made up would be the most persuasive fake number in the
   * whole product. Fixture people carry obviously-fake scores, same rule as
   * their obviously-fake names.
   */
  matchScore?: number;
  /** The year they joined their current company, when the ranker sent it.
   *  Real data only; the card derives "Joined this year" style copy from it. */
  joinedYear?: number;
  /**
   * What their title is actually OF — "Investment Banking" next to a bare
   * "Vice President". From PDL's job_title_sub_role, humanized server-side.
   * Absent when PDL had no classification, which is common enough that the
   * card must read fine without it.
   */
  department?: string;
  /** Only present after a paid reveal. */
  email?: string;
  emailVerified?: boolean;
};

/**
 * What a right swipe does, set once (not per card). Apply is an accent, off
 * by default and a few steps down the settings screen, never the headline.
 */
export type SwipeSettings = {
  action: 'draft' | 'send';
  contacts: 1 | 2 | 3;
  autoApply: boolean;
  // Who a swipe targets, on a teammates -> hiring-managers dial.
  //  'employee'      = teammates only (broadest, cheapest, lands most often)
  //  'mix'           = one hiring manager + the rest teammates
  //  'hiring_manager'= hiring managers first (verified), teammates only to fill
  // 'mix'/'hiring_manager' always draft (the HM endpoint never auto-sends).
  priority: 'employee' | 'mix' | 'hiring_manager';
  /** Jobs deck: on a right swipe, also find the hiring manager and draft to
   *  them. Off means a right swipe only submits the application. This is the
   *  feed-level toggle; `priority` stays the finer control in swipe settings. */
  emailHiringManager: boolean;
  /** Voice asks confirm before spending credits (mishears can't burn money).
   *  Zero-touch users can turn it off; obvious-garbage asks confirm anyway. */
  scoutConfirmSpend: boolean;
  /**
   * The prompt-built feed filters, one sentence per deck (Nick 2026-08-16).
   *
   * A filter is just what the user typed: "internships in product management in
   * San Francisco". The decks turn it into a query rather than storing parsed
   * fields, so the thing we persist is the thing the user recognises when it
   * comes back as a chip. Null means the default deck.
   *
   * The ACTIVE filter is session-scoped: it is deliberately not written to
   * disk, so relaunching the app always lands on the normal ranked feed. A
   * filter is something you asked for a minute ago, not a mode to get stuck
   * in, and a deck still narrowed by yesterday's sentence (with no memory of
   * setting it) reads as a broken feed rather than a saved preference.
   *
   * The RECENTS lists DO persist, which is what makes that safe: the sentence
   * is never lost, and getting back to it is one tap in the settings screen.
   * Capped at FILTER_RECENTS_MAX, because a chip row nobody can read is not a
   * shortcut. See the persist effect in store/app for where the split happens.
   */
  jobFilter: string | null;
  jobFilterRecents: string[];
  peopleFilter: string | null;
  peopleFilterRecents: string[];
};

/** How many past prompts each deck keeps as one-tap chips. */
export const FILTER_RECENTS_MAX = 5;

/**
 * Fold a just-used prompt into the recents list: newest first, no duplicates
 * (case-insensitively, since "Finance in NYC" and "finance in nyc" are the same
 * search to a human), capped at FILTER_RECENTS_MAX.
 */
export function withRecentFilter(recents: string[], prompt: string): string[] {
  const trimmed = prompt.trim();
  if (!trimmed) return recents;
  const key = trimmed.toLowerCase();
  return [trimmed, ...recents.filter((r) => r.trim().toLowerCase() !== key)].slice(
    0,
    FILTER_RECENTS_MAX,
  );
}

export type ScoutChat = {
  id: string;
  title: string;
  timeLabel: string;
};

export type ThreadMessage = {
  from: 'me' | 'them';
  text: string;
  timeLabel: string;
};

export type OutreachItem = {
  id: string;
  jobTitle: string;
  company: string;
  status: OutreachStatus;
  contact?: Contact;
  subject?: string;
  body?: string;
  snippet?: string;
  timeLabel: string;
  thread?: ThreadMessage[];
  /** A replied item the user has opened, so it no longer needs attention. */
  attended?: boolean;
  /** Pinned to the top of the Inbox (iMessage-style). */
  pinned?: boolean;
  /** Deep link to the Gmail draft, for the cold-open send (no in-app send-draft endpoint). */
  gmailDraftUrl?: string;
  /** When a queued/drafting placeholder was created — lets the foreground sweep
   *  fail rows whose request died while the app was backgrounded. */
  createdAtMs?: number;
  /** Live stage from the server draft job ("Researching their background…") —
   *  shown on the drafting row instead of the canned rotating phrases. */
  stageLabel?: string;
};

export type NotificationItem = {
  id: string;
  kind: 'draft_ready' | 'reply' | 'loop' | 'auto_apply_attention' | 'auto_apply_result';
  text: string;
  timeLabel: string;
  read: boolean;
  outreachId?: string;
  /** For auto_apply_attention / auto_apply_result: the application to open. */
  autoApplyId?: string;
  /** For auto_apply_result: submitted | needs_verification | failed. */
  outcome?: string;
};

export type Loop = {
  id: string;
  brief: string;
  status: 'Active' | 'Paused';
  contactsFound: number;
  draftsCreated: number;
  /** Weekly goal, drives the progress bar. */
  weeklyTarget: number;
  weeklyDone: number;
};

export type LoopActivity = {
  id: string;
  kind: 'run' | 'draft' | 'sent' | 'reply';
  text: string;
  timeLabel: string;
};

export type TrackerBucket = 'attention' | 'active' | 'done';

export type TrackerRow = {
  id: string;
  contactName: string;
  company: string;
  lastActivity: string;
  /** The conversation this contact opens into (the email string). */
  outreachId: string;
  /** iMessage-style preview line and short timestamp. */
  preview: string;
  timeShort: string;
  /** Whether they are waiting on you (shows the blue unread dot). */
  unread: boolean;
  bucket: TrackerBucket;
  statusLabel: string;
  statusTone: 'positive' | 'waiting' | 'accent';
  /** Pinned to the top of the Contacts list (iMessage-style). */
  pinned?: boolean;
};

/** Parsed straight out of the resume, the "here is what we gathered" view. */
export type ResumeExperience = {
  id: string;
  role: string;
  org: string;
  dates: string;
  location?: string;
  bullets: string[];
};

export type ProfileFile = {
  id: string;
  name: string;
  kind: 'resume' | 'transcript' | 'other';
  updatedLabel: string;
};

export type MeetingPrep = {
  id: string;
  name: string;
  title: string;
  company: string;
  linkedinUrl?: string;
  summary: string;
  talkingPoints: string[];
  createdLabel: string;
  /** Async prep job state (coffee-chat-prep runs in the background). */
  status?: 'processing' | 'completed' | 'failed';
  /** Link to the generated full prep PDF, when done. */
  pdfUrl?: string;
  // Richer sections from the coffee-chat-prep backend, surfaced in the detail.
  commonGround?: string; // similaritySummary — why you two connect
  conversationStrategy?: string; // how to steer the chat
  companyCheatSheet?: string; // quick company brief
  research?: {
    companyNews: string[];
    companyOverview: string[];
    personMentions: string[];
    industryTrends: string[];
  };
  /** Streaming progress while the prep builds (sections land one at a time). */
  progressPct?: number;
  stageLabel?: string;

};
