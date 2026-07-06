import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';
import type { ContactRelation, OutreachItem } from '@/types';

/**
 * The swipe finds real people at the company, drafts (or sends) tailored
 * outreach, and saves the contact server-side. Two targeting modes:
 *
 *  - 'employee' (DEFAULT): one /api/prompt-search pass on the role at the
 *    company. Teammates/alumni vastly outnumber recruiters in the index, so
 *    this lands far more often and is the cheapest path. Warmth scoring floats
 *    alumni/shared-school people to the top, so it's "best-matched teammate,"
 *    not random. A no-title fallback pass makes an empty swipe rare.
 *
 *  - 'hiring_manager': the intent upgrade. Routes targeting through the
 *    production /api/job-board/find-hiring-manager (recruiter_finder's curated
 *    titles + tier scoring + verification), then fills any remainder from the
 *    team via prompt-search. Always drafts (that endpoint doesn't send) so cold
 *    outreach to decision-makers is reviewed first.
 *
 * Both charge 5 credits per contact. Relation is derived from each contact's
 * real title (no fabricated "Hiring manager" label).
 */
type RawContact = Record<string, any>;

type PromptSearchResponse = {
  contacts?: RawContact[];
  credits_remaining?: number;
  mode?: string;
};

type HiringManagerResponse = {
  hiringManagers?: RawContact[];
  emails?: { to_email?: string; subject?: string; plain_body?: string; body?: string }[];
  creditsRemaining?: number;
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
  priority: 'employee' | 'mix' | 'hiring_manager';
  jobDescription?: string;
  /** Per-GESTURE idempotency key. The server records the outcome under this id,
   *  so a retry of the same gesture (tap-to-retry, timeout ambiguity) replays
   *  the recorded result instead of re-running the pipeline — no duplicate
   *  Gmail drafts, no double credit charge. Persisted across retries by the
   *  store (failedDraftArgs). */
  swipeId?: string;
};

let mockSeq = 0;

/** Draft calls run a 25–60s server pipeline; the staging gunicorn allows up to
 *  300s. If nothing came back in 150s the request is effectively lost — abort
 *  so the Inbox row can fail-with-retry instead of spinning forever. */
const DRAFT_TIMEOUT_MS = 150_000;

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
  swipeId?: string,
): Promise<{ contacts: RawContact[]; creditsRemaining?: number }> {
  const res = await apiFetch<PromptSearchResponse>('/api/prompt-search', {
    method: 'POST',
    // notify_draft_ready stays OFF for manual swipes: the user is in-app
    // watching the Inbox fill, so a "draft ready" bell item + push per contact
    // is just noise. The bell is reserved for async/away events (Loops, replies).
    body: { prompt, batchSize, mode, notify_draft_ready: false, swipe_id: swipeId },
    timeoutMs: DRAFT_TIMEOUT_MS,
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

/** HM mode: reuse the production hiring-manager endpoint (recruiter_finder's
 *  curated targeting + verification + draft + charge + save), then attach the
 *  generated email text onto each manager so mapContact can render it. */
async function findHiringManagers(
  args: SwipeArgs,
  count: number,
): Promise<{ contacts: RawContact[]; creditsRemaining?: number }> {
  const res = await apiFetch<HiringManagerResponse>('/api/job-board/find-hiring-manager', {
    method: 'POST',
    body: {
      company: args.company,
      jobTitle: args.jobTitle,
      jobDescription: args.jobDescription || '',
      maxResults: count,
      generateEmails: true,
      createDrafts: true,
    },
    timeoutMs: DRAFT_TIMEOUT_MS,
  });
  const byEmail = new Map<string, { subject?: string; plain_body?: string }>();
  for (const e of res.emails || []) {
    const k = (e.to_email || '').toLowerCase();
    if (k) byEmail.set(k, e);
  }
  const contacts = (res.hiringManagers || []).map((m) => {
    const k = (m.Email || m.email || m.WorkEmail || '').toLowerCase();
    const e = byEmail.get(k);
    return { ...m, emailSubject: e?.subject, emailBody: e?.plain_body };
  });
  return { contacts, creditsRemaining: res.creditsRemaining };
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

  // Any hiring-manager targeting: 'mix' gets ONE verified HM then fills the rest
  // with teammates; 'hiring_manager' targets up to `count` HMs, teammates only to
  // fill. Both always draft (the HM endpoint never sends).
  if (args.priority === 'mix' || args.priority === 'hiring_manager') {
    const hmTarget = args.priority === 'mix' ? 1 : args.count;
    const hm = await findHiringManagers(args, hmTarget);
    const contacts = hm.contacts;
    let creditsRemaining = hm.creditsRemaining;

    if (contacts.length < args.count) {
      const need = args.count - contacts.length;
      const seen = new Set(contacts.map(dedupeKey));
      // HM endpoint always drafts, so fill from the team as drafts too.
      const fallback = await promptSearch(
        `${args.jobTitle} at ${args.company}`,
        need,
        'draft',
        args.swipeId ? `${args.swipeId}-f` : undefined,
      );
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

  // Employee mode (default): broad pass on the role, cheap + high hit rate.
  // The primary and fallback passes get DISTINCT idempotency ids (-p / -f):
  // sharing one id would make the fallback replay the primary's stored
  // empty result instead of actually searching.
  const primary = await promptSearch(
    `${args.jobTitle} at ${args.company}`,
    args.count,
    mode,
    args.swipeId ? `${args.swipeId}-p` : undefined,
  );
  let contacts = primary.contacts;
  let creditsRemaining = primary.creditsRemaining;

  // Miss-proofing: if the titled search found nobody (title too specific, small
  // co), one no-title pass so a swipe almost never comes back empty.
  if (contacts.length === 0) {
    const fallback = await promptSearch(
      `people at ${args.company}`,
      args.count,
      mode,
      args.swipeId ? `${args.swipeId}-f` : undefined,
    );
    contacts = fallback.contacts;
    if (typeof fallback.creditsRemaining === 'number') creditsRemaining = fallback.creditsRemaining;
  }

  const items = contacts.slice(0, args.count).map((c, i) => mapContact(c, i, args));
  return { items, creditsRemaining };
}
