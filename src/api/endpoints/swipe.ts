import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';
import type { ContactRelation, OutreachItem } from '@/types';

/**
 * The swipe = one call to the existing /api/prompt-search with mode 'draft'
 * (or 'send'), which finds the contact(s), generates the email, creates the
 * Gmail draft, and saves the contact server-side. We force batchSize = the
 * number of people the swipe should reach and map the returned contacts onto
 * the inbox's OutreachItem shape. First contact is treated as the hiring
 * manager, the rest as employees (the app's "apply, then warm the team" web).
 */
type RawContact = Record<string, any>;

type PromptSearchResponse = {
  contacts?: RawContact[];
  credits_remaining?: number;
  mode?: string;
};

export type SwipeResult = {
  items: OutreachItem[];
  creditsRemaining?: number;
};

type SwipeArgs = {
  company: string;
  jobTitle: string;
  count: number;
  action: 'draft' | 'send';
  firstIsHiringManager?: boolean;
};

let mockSeq = 0;

function contactName(c: RawContact): string {
  const full = `${c.FirstName || c.firstName || ''} ${c.LastName || c.lastName || ''}`.trim();
  return full || c.Name || c.name || 'New contact';
}

/** Classify a contact by their ACTUAL title — honest, not by list position.
 *  Recruiters/TA → Recruiter; managers/leads/heads → Hiring manager; else
 *  Employee. */
function relationFor(title: string): ContactRelation {
  const t = (title || '').toLowerCase();
  if (/recruit|talent|sourcer|\bhr\b|human resources|people ops|people operations/.test(t)) {
    return 'Recruiter';
  }
  if (/manager|lead\b|head of|director|\bvp\b|vice president|chief|founder|president|owner/.test(t)) {
    return 'Hiring manager';
  }
  return 'Employee';
}

function dedupeKey(c: RawContact): string {
  return (
    (c.Email || c.email || '').toLowerCase() ||
    String(c.pdlId || c.id || '') ||
    `${contactName(c)}|${(c.Company || c.company || '').toLowerCase()}`
  );
}

async function promptSearch(
  prompt: string,
  batchSize: number,
  mode: string,
): Promise<{ contacts: RawContact[]; creditsRemaining?: number }> {
  const res = await apiFetch<PromptSearchResponse>('/api/prompt-search', {
    method: 'POST',
    // notify_draft_ready: persist a durable "draft ready" bell item + push,
    // keyed to the real saved contact (web doesn't set this).
    body: { prompt, batchSize, mode, notify_draft_ready: true },
  });
  return { contacts: res.contacts || [], creditsRemaining: res.credits_remaining };
}

function mapContact(
  c: RawContact,
  idx: number,
  args: SwipeArgs,
): OutreachItem {
  const title = c.Title || c.JobTitle || c.title || '';
  const relation: ContactRelation = relationFor(title);
  const sent = args.action === 'send';
  const subject = c.emailSubject || c.email_subject || `Reaching out about ${args.jobTitle}`;
  const body = c.emailBody || c.email_body || '';
  return {
    id: String(c.pdlId || c.id || `out-${Date.now()}-${idx}`),
    jobTitle: args.jobTitle,
    company: args.company,
    status: sent ? 'sent' : 'ready',
    contact: {
      name: contactName(c),
      title: c.Title || c.JobTitle || c.title || '',
      company: c.Company || c.company || args.company,
      relation,
      linkedinUrl: c.LinkedIn || c.linkedinUrl || undefined,
    },
    subject,
    body,
    snippet: sent ? 'Sent from your connected Gmail' : 'Draft is ready for your review',
    timeLabel: 'Just now',
  };
}

export async function runSwipe(args: SwipeArgs): Promise<SwipeResult> {
  if (USE_MOCKS) {
    mockSeq += 1;
    const items: OutreachItem[] = Array.from({ length: args.count }, (_, i) =>
      mapContact(
        { FirstName: 'Sample', LastName: `Contact ${mockSeq}.${i}`, Title: 'Recruiter' },
        i,
        args,
      ),
    );
    return { items };
  }

  const mode = args.action === 'send' ? 'send' : 'draft';

  // Prefer a recruiter / hiring manager at the company (the highest-value cold
  // outreach target). Each prompt-search call finds + drafts + saves + charges
  // per contact, so a miss costs nothing.
  const primary = await promptSearch(`recruiter or hiring manager at ${args.company}`, args.count, mode);
  let contacts = primary.contacts;
  let creditsRemaining = primary.creditsRemaining;

  // Fallback: fill the rest of the batch from the role's team (employees), so a
  // swipe rarely comes back empty even when no recruiter is indexed.
  if (contacts.length < args.count) {
    const need = args.count - contacts.length;
    const seen = new Set(contacts.map(dedupeKey));
    const fallback = await promptSearch(`${args.jobTitle} at ${args.company}`, need, mode);
    for (const c of fallback.contacts) {
      const key = dedupeKey(c);
      if (key && seen.has(key)) continue;
      seen.add(key);
      contacts.push(c);
    }
    if (typeof fallback.creditsRemaining === 'number') creditsRemaining = fallback.creditsRemaining;
  }

  const items = contacts.slice(0, args.count).map((c, i) => mapContact(c, i, args));
  return { items, creditsRemaining };
}
