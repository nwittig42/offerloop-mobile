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
};

export type CompanyInfo = {
  about: string;
  industry: string;
  size: string;
  hq: string;
  news: { source: string; timeLabel: string; headline: string }[];
};

export type OutreachStatus = 'drafting' | 'ready' | 'sent' | 'replied' | 'failed';

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
};

export type NotificationItem = {
  id: string;
  kind: 'draft_ready' | 'reply' | 'loop';
  text: string;
  timeLabel: string;
  read: boolean;
  outreachId?: string;
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
};
