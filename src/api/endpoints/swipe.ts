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

function mapContact(
  c: RawContact,
  idx: number,
  args: SwipeArgs,
): OutreachItem {
  const relation: ContactRelation =
    (args.firstIsHiringManager ?? true) && idx === 0 ? 'Hiring manager' : 'Employee';
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

  const res = await apiFetch<PromptSearchResponse>('/api/prompt-search', {
    method: 'POST',
    body: {
      prompt: `${args.jobTitle} at ${args.company}`,
      batchSize: args.count,
      mode: args.action === 'send' ? 'send' : 'draft',
    },
  });

  const contacts = (res.contacts || []).slice(0, args.count);
  const items = contacts.map((c, i) => mapContact(c, i, args));
  return { items, creditsRemaining: res.credits_remaining };
}
