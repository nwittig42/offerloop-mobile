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
  /** Voice asks confirm before spending credits (mishears can't burn money).
   *  Zero-touch users can turn it off; obvious-garbage asks confirm anyway. */
  scoutConfirmSpend: boolean;
};

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
};
