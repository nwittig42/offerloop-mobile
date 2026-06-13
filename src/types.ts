export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  workArrangement?: string;
  experienceLevel?: string;
  education?: string;
  description: string;
};

export type OutreachStatus = 'drafting' | 'ready' | 'sent' | 'replied' | 'failed';

export type Contact = {
  name: string;
  title: string;
  company: string;
  linkedinUrl?: string;
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
};

export type NotificationItem = {
  id: string;
  kind: 'draft_ready' | 'reply' | 'loop';
  text: string;
  timeLabel: string;
  read: boolean;
  outreachId?: string;
};

export type TrackerBucket = 'attention' | 'active' | 'done';

export type TrackerRow = {
  id: string;
  contactName: string;
  company: string;
  lastActivity: string;
  bucket: TrackerBucket;
  statusLabel: string;
  statusTone: 'positive' | 'waiting' | 'accent';
};
